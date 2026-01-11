"""
Python GUI camera window for finger tracking visualization.
Shows camera feed with hand tracking overlay.
"""

import cv2
import mediapipe as mp
import threading
import time
from typing import Optional

class CameraGUI:
    def __init__(self, cam_index: int = 0):
        self.cap = cv2.VideoCapture(cam_index)
        if not self.cap.isOpened():
            raise RuntimeError("Failed to open camera")

        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=1,
            model_complexity=1,
            min_detection_confidence=0.75,
            min_tracking_confidence=0.75,
        )
        self.mp_drawing = mp.solutions.drawing_utils

        self.running = False
        self.thread: Optional[threading.Thread] = None

    def run(self):
        """Run the camera GUI in a separate thread."""
        if self.running:
            return
        
        self.running = True
        self.thread = threading.Thread(target=self._camera_loop, daemon=True)
        self.thread.start()
        print("Camera GUI started")

    def _camera_loop(self):
        """Main camera loop."""
        cv2.namedWindow("Finger Tracking Camera", cv2.WINDOW_NORMAL)
        cv2.resizeWindow("Finger Tracking Camera", 640, 480)

        while self.running:
            ret, frame = self.cap.read()
            if not ret or frame is None:
                break

            frame = cv2.flip(frame, 1)
            h, w = frame.shape[:2]

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            rgb.flags.writeable = False
            results = self.hands.process(rgb)
            rgb.flags.writeable = True

            if results.multi_hand_landmarks:
                for hand_landmarks in results.multi_hand_landmarks:
                    self.mp_drawing.draw_landmarks(
                        frame,
                        hand_landmarks,
                        self.mp_hands.HAND_CONNECTIONS,
                        self.mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=2, circle_radius=2),
                        self.mp_drawing.DrawingSpec(color=(0, 0, 255), thickness=2),
                    )

            cv2.putText(
                frame,
                "Finger Tracking - Swipe left/right to control cards",
                (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (255, 255, 255),
                2,
            )
            cv2.putText(
                frame,
                "Press 'q' to close",
                (10, h - 20),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (255, 255, 255),
                2,
            )

            cv2.imshow("Finger Tracking Camera", frame)

            if cv2.waitKey(1) & 0xFF == ord('q'):
                self.stop()
                break

            time.sleep(0.033)

        cv2.destroyAllWindows()

    def stop(self):
        """Stop the camera GUI."""
        self.running = False
        if self.thread:
            self.thread.join(timeout=2.0)
        self.cap.release()
        self.hands.close()
        print("Camera GUI stopped")

    def close(self):
        """Close and cleanup."""
        self.stop()


if __name__ == "__main__":
    try:
        gui = CameraGUI(cam_index=0)
        gui.run()
        
        print("Camera GUI running. Press 'q' in the window to close.")
        
        while gui.running:
            time.sleep(0.1)
            
    except KeyboardInterrupt:
        print("\nStopping camera GUI...")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if 'gui' in locals():
            gui.close()
