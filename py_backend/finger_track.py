import cv2
import mediapipe as mp
import numpy as np
import time
from collections import deque

class FingerTracking:
    def __init__(self, cam_index: int = 0, queue_len: int = 10):
        self.cap = cv2.VideoCapture(cam_index, cv2.CAP_DSHOW)
        if not self.cap.isOpened():
            raise RuntimeError("Issue initializing cap (camera not opened)")

        self.mp_hands = mp.solutions.hands
        self.mp_draw = mp.solutions.drawing_utils
        self.mp_styles = mp.solutions.drawing_styles

        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=1,
            model_complexity=1,
            min_detection_confidence=0.75,
            min_tracking_confidence=0.75
        )

        self.q = deque(maxlen=queue_len)

        self._last_swipe_time = 0.0
        self._swipe_cooldown_s = 1.5
        self._last_swipe_direction = None
        self._swipe_display_time = 0.0
        self._swipe_display_duration = 0.8
        self.last_n_frames = deque(maxlen=12)

    @staticmethod
    def _lm_xy(hand_lms, idx, w, h):
        lm = hand_lms.landmark[idx]
        return np.array([lm.x * w, lm.y * h], dtype=np.float32)

    def _compute_hand_center(self, hand_lms, w, h):
        wrist = self._lm_xy(hand_lms, 0, w, h)
        return wrist / np.array([w, h])

    def detect_swipe(self, min_frames: int = 8, required_fraction: float = 0.40,
                     min_total_dx_norm: float = 0.12, max_total_dy_norm: float = 0.12):
        if len(self.q) < min_frames:
            return 0

        samples = list(self.q)[-min_frames:]

        xs, ys = [], []
        for s in samples:
            center = s.get("center")
            if center is None:
                return None
            xs.append(center[0])
            ys.append(center[1])

        xs = np.array(xs, dtype=np.float32)
        ys = np.array(ys, dtype=np.float32)

        total_dx = float(xs[-1] - xs[0])
        total_dy = float(ys[-1] - ys[0])

        if abs(total_dx) < min_total_dx_norm or abs(total_dy) > max_total_dy_norm:
            return 0

        step_dx = np.diff(xs)
        direction = 1.0 if total_dx > 0 else -1.0
        if float(np.mean((step_dx * direction) > 0)) < required_fraction:
            return 0

        return 1 if total_dx > 0 else 2

    def read_store_frame(self):
        ok, frame = self.cap.read()
        if not ok or frame is None or frame.size == 0:
            return None, 0

        frame = cv2.flip(frame, 1)
        h, w = frame.shape[:2]

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        rgb.flags.writeable = False
        result = self.hands.process(rgb)
        rgb.flags.writeable = True

        swipe = 0

        if result.multi_hand_landmarks:
            hand_lms = result.multi_hand_landmarks[0]

            self.mp_draw.draw_landmarks(
                frame, hand_lms,
                self.mp_hands.HAND_CONNECTIONS,
                self.mp_styles.get_default_hand_landmarks_style(),
                self.mp_styles.get_default_hand_connections_style(),
            )

            center_norm = self._compute_hand_center(hand_lms, w, h)
            self.q.append({"center": center_norm, "w": w, "h": h})

            swipe = self.detect_swipe()
            now = time.time()
            if swipe == 0 and (now - self._last_swipe_time) >= self._swipe_cooldown_s:
                self._last_swipe_time = now
                self._last_swipe_direction = swipe
                self._swipe_display_time = now
        else:
            self.q.clear()

        if swipe != 0 and any(s != 0 for s in self.last_n_frames):
            swipe = 0
        self.last_n_frames.append(swipe)
        return frame, swipe

    def get_cooldown_remaining(self):
        elapsed = time.time() - self._last_swipe_time
        remaining = max(0, self._swipe_cooldown_s - elapsed)
        return remaining

    def close(self):
        self.cap.release()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    tracker = FingerTracking(queue_len=10)

    while True:
        frame, swipe = tracker.read_store_frame()
        if swipe != 0:
            print("LEFT" if swipe == 2 else "RIGHT")

        cv2.imshow("[Hand Swipe Detection]", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    tracker.close()