import cv2
import mediapipe as mp
import numpy as np
from collections import deque

class VisualTracking:
    
    FINGER_JOINTS = {
        "thumb":  {"mcp": 2,  "pip": 3,  "dip": 3,  "tip": 4},
        "index":  {"mcp": 5,  "pip": 6,  "dip": 7,  "tip": 8},
        "middle": {"mcp": 9,  "pip": 10, "dip": 11, "tip": 12},
        "ring":   {"mcp": 13, "pip": 14, "dip": 15, "tip": 16},
        "pinky":  {"mcp": 17, "pip": 18, "dip": 19, "tip": 20},
    }

    def __init__(self):
        self.cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
        if not self.cap.isOpened():
            raise RuntimeError("Issue initializing cap")

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

        self.q = deque(maxlen=10)

    @staticmethod
    def _lm_xy(hand_lms, idx, w, h):
        lm = hand_lms.landmark[idx]
        return np.array([lm.x * w, lm.y * h], dtype=np.float32)

    @staticmethod
    def _angle_deg(a, b, c):
        """
        Returns angle ABC in degrees (angle at point b).
        a, b, c are 2D points (numpy arrays).
        """
        ba = a - b
        bc = c - b
        denom = (np.linalg.norm(ba) * np.linalg.norm(bc)) + 1e-9
        cosang = float(np.dot(ba, bc) / denom)
        cosang = np.clip(cosang, -1.0, 1.0)
        return float(np.degrees(np.arccos(cosang)))

    def compute_finger_angles(self, hand_lms, w, h):
        """
        Returns angles dict:
        angles[finger]["pip"] = angle(MCP, PIP, DIP)
        angles[finger]["dip"] = angle(PIP, DIP, TIP)
        """
        angles = {}
        for finger, j in self.FINGER_JOINTS.items():
            mcp = self._lm_xy(hand_lms, j["mcp"], w, h)
            pip = self._lm_xy(hand_lms, j["pip"], w, h)
            dip = self._lm_xy(hand_lms, j["dip"], w, h)
            tip = self._lm_xy(hand_lms, j["tip"], w, h)

            # For non-thumb fingers this is meaningful.
            pip_ang = self._angle_deg(mcp, pip, dip)
            dip_ang = self._angle_deg(pip, dip, tip)

            angles[finger] = {"pip": pip_ang, "dip": dip_ang}
        return angles

    def read_store_frame(self):
        ok, frame = self.cap.read()
        if not ok or frame is None or frame.size == 0:
            return None, None

        frame = cv2.flip(frame, 1)
        h, w = frame.shape[:2]

        # MediaPipe wants RGB
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        rgb.flags.writeable = False
        result = self.hands.process(rgb)
        rgb.flags.writeable = True

        angles = None

        if result.multi_hand_landmarks:
            hand_lms = result.multi_hand_landmarks[0]

            # Draw landmarks on the BGR frame (so imshow looks correct)
            self.mp_draw.draw_landmarks(
                frame, hand_lms,
                self.mp_hands.HAND_CONNECTIONS,
                self.mp_styles.get_default_hand_landmarks_style(),
                self.mp_styles.get_default_hand_connections_style(),
            )

            # Compute angles
            angles = self.compute_finger_angles(hand_lms, w, h)

            # Visualize: show index PIP/DIP angles
            idx_pip = angles["index"]["pip"]
            idx_dip = angles["index"]["dip"]
            cv2.putText(frame, f"Index PIP: {idx_pip:.1f}", (20, 40),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
            cv2.putText(frame, f"Index DIP: {idx_dip:.1f}", (20, 75),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)

            self.q.append(angles)

        return frame, angles


if __name__ == "__main__":
    tracker = VisualTracking()

    while True:
        frame, angles = tracker.read_store_frame()
        if frame is None:
            continue

        if angles is not None:
            # Example print (all fingers)
            print({k: {kk: round(vv, 1) for kk, vv in v.items()} for k, v in angles.items()})

        cv2.imshow("[Test Render]", frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    tracker.cap.release()
    cv2.destroyAllWindows()
