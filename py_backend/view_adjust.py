import cv2
import mediapipe as mp
import numpy as np
from collections import deque

class HandPositionTracking:
    FINGER_TIPS = {
        "thumb": 4,
        "index": 8,
        "middle": 12,
        "ring": 16,
        "pinky": 20,
    }

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

        # Store last known good measurements
        self.last_known_x = 0.50
        self.last_known_y = 0.50

    @staticmethod
    def _lm_xy(hand_lms, idx, w, h):
        lm = hand_lms.landmark[idx]
        return np.array([lm.x * w, lm.y * h], dtype=np.float32)

    def _compute_hand_center(self, hand_lms, w, h):
        fingertip_positions = []
        for finger_name, tip_idx in self.FINGER_TIPS.items():
            tip_pos = self._lm_xy(hand_lms, tip_idx, w, h)
            fingertip_positions.append(tip_pos)
        
        avg_position = np.mean(fingertip_positions, axis=0)
        return avg_position / np.array([w, h])

    def get_fracs(self):
        ok, frame = self.cap.read()
        if not ok or frame is None or frame.size == 0:
            return None, self.last_known_x, self.last_known_y

        frame = cv2.flip(frame, 1)
        h, w = frame.shape[:2]

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        rgb.flags.writeable = False
        result = self.hands.process(rgb)
        rgb.flags.writeable = True

        x_frac = self.last_known_x  # Default to last known
        y_frac = self.last_known_y

        if result.multi_hand_landmarks:
            hand_lms = result.multi_hand_landmarks[0]

            self.mp_draw.draw_landmarks(
                frame, hand_lms,
                self.mp_hands.HAND_CONNECTIONS,
                self.mp_styles.get_default_hand_landmarks_style(),
                self.mp_styles.get_default_hand_connections_style(),
            )

            center_norm = self._compute_hand_center(hand_lms, w, h)
            x_frac = float(center_norm[0])
            y_frac = float(center_norm[1])
            
            # Clamp to [0, 1] range
            x_frac = min(1.0, max(0.0, x_frac))
            y_frac = min(1.0, max(0.0, y_frac))
            
            # Update last known good values
            self.last_known_x = x_frac
            self.last_known_y = y_frac

            # Draw position indicator
            center_px = (int(x_frac * w), int(y_frac * h))
            cv2.circle(frame, center_px, 15, (0, 255, 0), -1)
            cv2.circle(frame, center_px, 20, (255, 255, 255), 2)
        else:
            # Hand not detected - use last known values
            # Optionally draw indicator in different color
            center_px = (int(self.last_known_x * w), int(self.last_known_y * h))
            cv2.circle(frame, center_px, 15, (0, 165, 255), -1)  # Orange for "last known"
            cv2.circle(frame, center_px, 20, (255, 255, 255), 2)

        return frame, x_frac, y_frac

    def close(self):
        self.cap.release()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    tracker = HandPositionTracking(queue_len=5)

    while True:
        frame, x_frac, y_frac = tracker.get_fracs()
        
        if frame is None:
            continue
            
        h, w = frame.shape[:2]
        percent_text = f"({x_frac*100:.1f}%, {y_frac*100:.1f}%)"
        cv2.putText(frame, percent_text, (20, 70),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

        cv2.imshow("[Hand Position Tracking]", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    tracker.close()