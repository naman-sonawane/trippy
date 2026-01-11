"""
Merged FastAPI server:
1) Recommendation engine API + image scraping endpoint
2) Hand-tracking camera API (MediaPipe + OpenCV) for swipe + view-adjust endpoints

Speed changes applied (keeps your logic):
- MediaPipe inference is throttled to a fixed FPS (default 15) instead of every camera loop tick
- Frames are downscaled before MediaPipe (default target width 640)
- MediaPipe model_complexity lowered to 0 (faster)
- Lock scope is kept small (only around shared-state writes/reads)
- Camera loop no longer sleeps a fixed 33ms (uses tiny sleep to avoid pegging CPU)
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional, Dict, Any
from collections import deque
import time
import threading

import cv2
import mediapipe as mp
import numpy as np

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from database import Database
from recommendation_engine import RecommendationEngine
from models import User, Interaction
from webscraper import webscrape_location, ActivityGenerator


# -----------------------------------------------------------------------------
# App setup
# -----------------------------------------------------------------------------

app = FastAPI(title="Trippy Merged API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db = Database()
engine = RecommendationEngine(db)


# -----------------------------------------------------------------------------
# Recommendation engine models
# -----------------------------------------------------------------------------

class UserPreferences(BaseModel):
    userId: str
    age: Optional[int] = 25
    likedItems: List[str] = []
    dislikedItems: List[str] = []
    travelHistory: List[str] = []


class RecommendationRequest(BaseModel):
    user: UserPreferences
    destination: str
    topN: int = 20


class SwipeAction(BaseModel):
    userId: str
    itemId: str
    action: str
    destination: str


class ConfidenceCheckRequest(BaseModel):
    userId: str
    destination: str


class MultiUserRecommendationRequest(BaseModel):
    userId: str
    participantPreferences: List[UserPreferences]
    destination: str
    topN: int = 20


class MultiUserConfidenceCheckRequest(BaseModel):
    participantIds: List[str]
    destination: str


# -----------------------------------------------------------------------------
# Hand tracker (camera + mediapipe)
# -----------------------------------------------------------------------------

class HandTracker:
    FINGER_TIPS = {
        "thumb": 4,
        "index": 8,
        "middle": 12,
        "ring": 16,
        "pinky": 20,
    }

    def __init__(
        self,
        cam_index: int = 0,
        queue_len: int = 10,
        infer_fps: float = 15.0,
        target_width: int = 640,
    ):
        # Camera setup
        self.cap = cv2.VideoCapture(cam_index)
        if not self.cap.isOpened():
            raise RuntimeError("Failed to open camera")

        # -------------------------
        # Speed knobs
        # -------------------------
        self._infer_fps = float(max(1.0, infer_fps))
        self._infer_period = 1.0 / self._infer_fps
        self._last_infer_t = 0.0

        self._target_width = int(max(160, target_width))
        self._downscale_interpolation = cv2.INTER_AREA

        # MediaPipe setup (speed: complexity=0)
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=1,
            model_complexity=0,               # speed change
            min_detection_confidence=0.60,    # speed change (less strict)
            min_tracking_confidence=0.60,     # speed change (less strict)
        )

        # Swipe detection state
        self.swipe_queue = deque(maxlen=queue_len)
        self._last_swipe_time = 0.0
        self._swipe_cooldown_s = 1.5
        self.last_n_frames = deque(maxlen=12)

        # Position state
        self.last_known_x = 0.50
        self.last_known_y = 0.50

        # Current swipe state
        self.current_swipe = 0
        self.current_direction = "none"
        
        self._event_id = 0
        self._pending_swipe: int = 0          # 0|1|2
        self._pending_direction: str = "none"
        self._pending_event_id: int = 0
        self._pending_set_time: float = 0.0
        self._pending_ttl_s: float = 1.25     # how long we keep an un-acked swipe available

        # Thread control
        self.running = False
        self.thread = None
        self.lock = threading.Lock()

    @staticmethod
    def _lm_xy(hand_lms, idx, w, h):
        lm = hand_lms.landmark[idx]
        return np.array([lm.x * w, lm.y * h], dtype=np.float32)

    def _compute_hand_center_wrist(self, hand_lms, w, h):
        """For swipe detection - uses wrist"""
        wrist = self._lm_xy(hand_lms, 0, w, h)
        return wrist / np.array([w, h], dtype=np.float32)

    def _compute_hand_center_fingertips(self, hand_lms, w, h):
        """For position tracking - uses fingertips average"""
        fingertip_positions = []
        for _, tip_idx in self.FINGER_TIPS.items():
            tip_pos = self._lm_xy(hand_lms, tip_idx, w, h)
            fingertip_positions.append(tip_pos)

        avg_position = np.mean(fingertip_positions, axis=0)
        return avg_position / np.array([w, h], dtype=np.float32)

    def _downscale_for_inference(self, frame_bgr: np.ndarray):
        """Downscale frame before MediaPipe for speed. Returns (small_frame, scale)."""
        h, w = frame_bgr.shape[:2]
        if w <= self._target_width:
            return frame_bgr, 1.0
        scale = self._target_width / float(w)
        new_w = self._target_width
        new_h = int(round(h * scale))
        small = cv2.resize(
            frame_bgr, (new_w, new_h), interpolation=self._downscale_interpolation
        )
        return small, scale

    def detect_swipe(
        self,
        min_frames: int = 8,
        required_fraction: float = 0.40,
        min_total_dx_norm: float = 0.12,
        max_total_dy_norm: float = 0.12,
    ):
        # Snapshot quickly (lock only for copying)
        with self.lock:
            if len(self.swipe_queue) < min_frames:
                return 0
            samples = list(self.swipe_queue)[-min_frames:]

        xs = np.empty((min_frames,), dtype=np.float32)
        ys = np.empty((min_frames,), dtype=np.float32)

        for i, s in enumerate(samples):
            center = s.get("center")
            if center is None:
                return 0
            xs[i] = center[0]
            ys[i] = center[1]

        total_dx = float(xs[-1] - xs[0])
        total_dy = float(ys[-1] - ys[0])

        if abs(total_dx) < min_total_dx_norm or abs(total_dy) > max_total_dy_norm:
            return 0

        step_dx = xs[1:] - xs[:-1]
        direction = 1.0 if total_dx > 0 else -1.0
        if float(np.mean((step_dx * direction) > 0)) < required_fraction:
            return 0

        return 1 if total_dx > 0 else 2  # 1=right, 2=left

    def process_frame(self):
        """Process one frame from the camera (fast path)."""
        ok, frame = self.cap.read()
        if not ok or frame is None or frame.size == 0:
            return

        frame = cv2.flip(frame, 1)

        # Speed change: run MediaPipe only at fixed infer FPS
        now = time.time()
        if (now - self._last_infer_t) < self._infer_period:
            return
        self._last_infer_t = now

        # Speed change: downscale before inference
        small_bgr, _scale = self._downscale_for_inference(frame)
        sh, sw = small_bgr.shape[:2]

        rgb = cv2.cvtColor(small_bgr, cv2.COLOR_BGR2RGB)
        rgb.flags.writeable = False
        result = self.hands.process(rgb)
        rgb.flags.writeable = True

        swipe = 0

        if result.multi_hand_landmarks:
            hand_lms = result.multi_hand_landmarks[0]

            # Position (fingertips avg) on SMALL frame, normalized => equivalent
            center_norm = self._compute_hand_center_fingertips(hand_lms, sw, sh)
            x_frac = float(center_norm[0])
            y_frac = float(center_norm[1])

            x_frac = min(1.0, max(0.0, x_frac))
            y_frac = min(1.0, max(0.0, y_frac))

            # Swipe detection (wrist) on SMALL frame, normalized => equivalent
            wrist_norm = self._compute_hand_center_wrist(hand_lms, sw, sh)

            # Lock only around shared-state writes
            with self.lock:
                self.last_known_x = x_frac
                self.last_known_y = y_frac
                self.swipe_queue.append({"center": wrist_norm})

            swipe = self.detect_swipe()

            # Cooldown + debouncing (tiny lock)
            now2 = time.time()
            with self.lock:
                if swipe != 0 and (now2 - self._last_swipe_time) >= self._swipe_cooldown_s:
                    self._last_swipe_time = now2
                else:
                    swipe = 0

                if swipe != 0 and any(s != 0 for s in self.last_n_frames):
                    swipe = 0
                self.last_n_frames.append(swipe)

                self.current_swipe = swipe
                self.current_direction = "right" if swipe == 1 else "left" if swipe == 2 else "none"

                # --- NEW: latch swipe as an event (so polling can't miss it) ---
                if swipe != 0:
                    # Don't allow a second swipe to overwrite an un-acked one
                    if self._pending_swipe == 0:
                        self._event_id += 1
                        self._pending_swipe = int(swipe)
                        self._pending_direction = self.current_direction
                        self._pending_event_id = int(self._event_id)
                        self._pending_set_time = time.time()
        else:
            # No hand detected
            with self.lock:
                self.swipe_queue.clear()
                self.current_swipe = 0
                self.current_direction = "none"

    def get_swipe_event(self):
        """Return a latched swipe event until consumed or TTL expires."""
        with self.lock:
            if self._pending_swipe != 0:
                # TTL expiry safety (prevents a stuck swipe if client disappears)
                if (time.time() - self._pending_set_time) > self._pending_ttl_s:
                    self._pending_swipe = 0
                    self._pending_direction = "none"
                    self._pending_event_id = 0

            return (
                int(self._pending_swipe),
                str(self._pending_direction),
                int(self._pending_event_id),
            )

    def consume_swipe_event(self, event_id: int) -> bool:
        """Consume only if the event_id matches the currently pending one."""
        with self.lock:
            if self._pending_swipe == 0:
                return True
            if int(event_id) != int(self._pending_event_id):
                return False
            self._pending_swipe = 0
            self._pending_direction = "none"
            self._pending_event_id = 0
            return True

    def camera_loop(self):
        print("Camera loop started")
        while self.running:
            try:
                self.process_frame()
                # Speed change: tiny sleep only (keeps latency low, avoids 100% CPU spin)
                time.sleep(0.002)
            except Exception as e:
                print(f"Error in camera loop: {e}")
                time.sleep(0.05)
        print("Camera loop stopped")

    def start(self):
        if self.running:
            return
        self.running = True
        self.thread = threading.Thread(target=self.camera_loop, daemon=True)
        self.thread.start()
        print("Hand tracker started")

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join(timeout=2.0)
        print("Hand tracker stopped")

    def get_position(self):
        with self.lock:
            return self.last_known_x, self.last_known_y

    def get_swipe(self):
        with self.lock:
            return self.current_swipe, self.current_direction

    def close(self):
        self.stop()
        self.cap.release()
        self.hands.close()


tracker: Optional[HandTracker] = None


@app.on_event("startup")
async def startup_event():
    """Initialize tracker and start camera on startup"""
    global tracker
    try:
        # You can tune infer_fps/target_width here without touching logic
        tracker = HandTracker(cam_index=0, queue_len=10, infer_fps=15.0, target_width=640)
        tracker.start()
        print("✓ Hand tracking initialized with camera")
    except Exception as e:
        print(f"✗ Failed to initialize hand tracker: {e}")
        tracker = None


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    global tracker
    if tracker:
        tracker.close()
        print("✓ Hand tracker closed")


# -----------------------------------------------------------------------------
# Root + Health
# -----------------------------------------------------------------------------

@app.get("/")
async def root():
    return {
        "status": "Merged API is running",
        "subsystems": {
            "recommendations": True,
            "hand_tracking": tracker is not None and tracker.running,
        },
    }


@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}


# -----------------------------------------------------------------------------
# Recommendation endpoints
# -----------------------------------------------------------------------------

@app.post("/api/recommendations")
async def get_recommendations(request: RecommendationRequest):
    """Get recommendations for a user at a destination."""
    try:
        user = db.get_user(request.user.userId)

        if not user:
            user = User(
                id=request.user.userId,
                age=request.user.age or 25,
                preferences=request.user.likedItems,
                travel_history=request.user.travelHistory or [request.destination],
            )
            db.save_user(user)

        places = db.get_places_by_destination(request.destination)
        activities = db.get_activities_by_destination(request.destination)

        if not places or not activities:
            webscrape_location(db, request.destination, max_activities=10)

        recommendations = engine.get_recommendations(user, request.destination, request.topN)

        result = []
        for item, score in recommendations:
            item_dict = {
                "id": item.id,
                "name": item.name,
                "category": item.category,
                "description": item.description or "",
                "features": item.features,
                "score": float(score),
            }

            if hasattr(item, "location"):
                item_dict["location"] = item.location
                item_dict["type"] = "place"
            else:
                item_dict["placeId"] = item.place_id
                item_dict["type"] = "activity"

            result.append(item_dict)

        return {"recommendations": result}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/swipe")
async def handle_swipe(action: SwipeAction):
    """Handle user swipe action (like/dislike)."""
    try:
        user = db.get_user(action.userId)

        if not user:
            user = User(
                id=action.userId,
                age=25,
                preferences=[],
                travel_history=[action.destination],
            )
            db.save_user(user)

        rating = 1 if action.action == "like" else -1

        places = db.get_places_by_destination(action.destination)
        activities = db.get_activities_by_destination(action.destination)
        place_ids = {p.id for p in places}
        activity_ids = {a.id for a in activities}

        item_type = "place" if action.itemId in place_ids else "activity"

        interaction = Interaction(
            user_id=action.userId,
            item_id=action.itemId,
            item_type=item_type,
            rating=rating,
            timestamp=datetime.now().isoformat(),
        )

        db.add_interaction(interaction)

        return {"success": True}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/confidence-check")
async def check_confidence(request: ConfidenceCheckRequest):
    """Check user confidence metrics."""
    try:
        user = db.get_user(request.userId)
        if not user:
            return {"likes": 0, "dislikes": 0, "total": 0, "confidence_ratio": 0.0, "meets_threshold": False}

        all_interactions = db.get_user_interactions(request.userId)

        places = db.get_places_by_destination(request.destination)
        activities = db.get_activities_by_destination(request.destination)
        destination_item_ids = {p.id for p in places} | {a.id for a in activities}

        destination_interactions = [inter for inter in all_interactions if inter.item_id in destination_item_ids]

        likes = sum(1 for inter in destination_interactions if inter.rating == 1)
        dislikes = sum(1 for inter in destination_interactions if inter.rating == -1)
        total = likes + dislikes

        confidence_ratio = (likes / total) if total > 0 else 0.0
        meets_threshold = likes >= 20 and confidence_ratio >= 0.95

        return {
            "likes": likes,
            "dislikes": dislikes,
            "total": total,
            "confidence_ratio": confidence_ratio,
            "meets_threshold": meets_threshold,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/high-confidence-items")
async def get_high_confidence_items(request: ConfidenceCheckRequest):
    """Get liked items + high-confidence recommendations (score >= 0.8)."""
    try:
        user = db.get_user(request.userId)
        if not user:
            return {"items": []}

        all_interactions = db.get_user_interactions(request.userId)

        places = db.get_places_by_destination(request.destination)
        activities = db.get_activities_by_destination(request.destination)

        liked_item_ids = {inter.item_id for inter in all_interactions if inter.rating == 1}
        user_item_ids = {inter.item_id for inter in all_interactions}

        recommendations = engine.get_recommendations(user, request.destination, top_n=100)
        high_confidence_items = [
            (item, score) for item, score in recommendations
            if score >= 0.8 and item.id not in user_item_ids
        ]

        result_items = []
        item_ids_added = set()

        place_id_set = {p.id for p in places}
        activity_id_set = {a.id for a in activities}

        for item_id in liked_item_ids:
            item = None
            if item_id in place_id_set:
                item = next((p for p in places if p.id == item_id), None)
            elif item_id in activity_id_set:
                item = next((a for a in activities if a.id == item_id), None)

            if item and item_id not in item_ids_added:
                item_dict = {
                    "id": item.id,
                    "name": item.name,
                    "category": item.category,
                    "description": item.description or "",
                    "features": item.features,
                    "score": 1.0,
                }

                if hasattr(item, "location"):
                    item_dict["location"] = item.location
                    item_dict["type"] = "place"
                else:
                    item_dict["placeId"] = item.place_id
                    item_dict["type"] = "activity"

                result_items.append(item_dict)
                item_ids_added.add(item_id)

        for item, score in high_confidence_items:
            if item.id in item_ids_added:
                continue

            item_dict = {
                "id": item.id,
                "name": item.name,
                "category": item.category,
                "description": item.description or "",
                "features": item.features,
                "score": float(score),
            }

            if hasattr(item, "location"):
                item_dict["location"] = item.location
                item_dict["type"] = "place"
            else:
                item_dict["placeId"] = item.place_id
                item_dict["type"] = "activity"

            result_items.append(item_dict)
            item_ids_added.add(item.id)

        return {"items": result_items}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/multi-user-recommendations")
async def get_multi_user_recommendations(request: MultiUserRecommendationRequest):
    """Get recommendations for a user considering all trip participants."""
    try:
        requesting_user = db.get_user(request.userId)
        if not requesting_user:
            requesting_user = User(
                id=request.userId,
                age=25,
                preferences=[],
                travel_history=[request.destination],
            )
            db.save_user(requesting_user)

        places = db.get_places_by_destination(request.destination)
        activities = db.get_activities_by_destination(request.destination)

        if len(places) == 0 and len(activities) == 0:
            return {"recommendations": []}

        participant_ages = []
        for pref in request.participantPreferences:
            if pref.age:
                participant_ages.append(pref.age)

        _avg_age = participant_ages[0] if participant_ages else requesting_user.age

        recommendations = engine.get_recommendations(
            requesting_user, request.destination, request.topN * 2
        )

        item_boost: Dict[str, float] = {}
        for pref in request.participantPreferences:
            for item_id in pref.likedItems:
                item_boost[item_id] = item_boost.get(item_id, 0.0) + 0.1

        boosted_recommendations = []
        for item, score in recommendations:
            boost = min(item_boost.get(item.id, 0.0), 0.5)
            boosted_recommendations.append((item, score * (1.0 + boost)))

        boosted_recommendations.sort(key=lambda x: x[1], reverse=True)

        result = []
        for item, score in boosted_recommendations[:request.topN]:
            item_dict = {
                "id": item.id,
                "name": item.name,
                "category": item.category,
                "description": item.description or "",
                "features": item.features,
                "score": float(score),
            }

            if hasattr(item, "location"):
                item_dict["location"] = item.location
                item_dict["type"] = "place"
            else:
                item_dict["placeId"] = item.place_id
                item_dict["type"] = "activity"

            result.append(item_dict)

        return {"recommendations": result}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/multi-user-confidence-check")
async def check_multi_user_confidence(request: MultiUserConfidenceCheckRequest):
    """Check confidence metrics for all participants - all must reach 95%."""
    try:
        places = db.get_places_by_destination(request.destination)
        activities = db.get_activities_by_destination(request.destination)
        destination_item_ids = {p.id for p in places} | {a.id for a in activities}

        participant_results = []
        all_ready = True

        for participant_id in request.participantIds:
            user = db.get_user(participant_id)

            if not user:
                participant_results.append(
                    {
                        "userId": participant_id,
                        "likes": 0,
                        "dislikes": 0,
                        "total": 0,
                        "confidenceRatio": 0.0,
                        "meetsThreshold": False,
                    }
                )
                all_ready = False
                continue

            all_interactions = db.get_user_interactions(participant_id)

            destination_interactions = [
                inter for inter in all_interactions
                if inter.item_id in destination_item_ids
            ]

            likes = sum(1 for inter in destination_interactions if inter.rating == 1)
            dislikes = sum(1 for inter in destination_interactions if inter.rating == -1)
            total = likes + dislikes

            confidence_ratio = (likes / total) if total > 0 else 0.0
            meets_threshold = likes >= 20 and confidence_ratio >= 0.95

            participant_results.append(
                {
                    "userId": participant_id,
                    "likes": likes,
                    "dislikes": dislikes,
                    "total": total,
                    "confidenceRatio": confidence_ratio,
                    "meetsThreshold": meets_threshold,
                }
            )

            if not meets_threshold:
                all_ready = False

        return {"allReady": all_ready, "participants": participant_results}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/scrape-image")
async def scrape_image(request: Dict[str, Any]):
    """Scrape images for a search query."""
    try:
        query = request.get("query", "")
        if not query:
            raise HTTPException(status_code=400, detail="Query parameter required")

        generator = ActivityGenerator()

        image_url = generator._get_pexels_image(query)
        if not image_url:
            image_url = generator._get_google_image(query)
        if not image_url:
            image_url = generator._get_duckduckgo_image(query)
        if not image_url:
            image_url = generator._get_unsplash_image(query)

        return {"image_url": image_url}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------------------------------------------------------
# Hand-tracking endpoints
# -----------------------------------------------------------------------------

from fastapi import Query

@app.get("/api/finger-track")
async def finger_track(
    consume: int = Query(0, ge=0, le=1),
    event_id: int = Query(0, ge=0),
):
    """
    Latched swipe event:
    - Normal poll: GET /api/finger-track -> returns pending swipe until consumed
    - Ack:         GET /api/finger-track?consume=1&event_id=123 -> clears if matches
    Returns: {"swipe": 0|1|2, "direction": str, "event_id": int}
    """
    global tracker
    if not tracker:
        raise HTTPException(status_code=500, detail="Tracker not initialized")

    try:
        if consume == 1:
            ok = tracker.consume_swipe_event(event_id)
            return JSONResponse({"ok": ok})

        swipe, direction, eid = tracker.get_swipe_event()
        return JSONResponse({"swipe": swipe, "direction": direction, "event_id": eid})

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting swipe: {str(e)}")

@app.get("/api/view-adjust")
async def view_adjust_get():
    """Get current hand position. Returns: {"x_frac": float, "y_frac": float}"""
    global tracker
    if not tracker:
        raise HTTPException(status_code=500, detail="Tracker not initialized")
    try:
        x_frac, y_frac = tracker.get_position()
        return JSONResponse({"x_frac": 1 - x_frac, "y_frac": y_frac})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting position: {str(e)}")


@app.get("/api/status")
async def get_status():
    """Get tracker status"""
    global tracker
    if not tracker:
        return JSONResponse({"running": False, "error": "Tracker not initialized"})

    x_frac, y_frac = tracker.get_position()
    swipe, direction = tracker.get_swipe()

    return JSONResponse(
        {
            "running": tracker.running,
            "position": {"x": x_frac, "y": y_frac},
            "swipe": {"value": swipe, "direction": direction},
        }
    )


# -----------------------------------------------------------------------------
# Entrypoint
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)