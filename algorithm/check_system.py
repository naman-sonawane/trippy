"""Test script for gesture recommendation system."""
import os
import sys

print("="*60)
print("Gesture Recommendation System - Environment Check")
print("="*60)

print("\n1. Checking Python packages...")
try:
    import cv2
    print("   [OK] OpenCV installed")
except ImportError:
    print("   [X] OpenCV missing: pip install opencv-python")

try:
    import mediapipe
    print("   [OK] MediaPipe installed")
except ImportError:
    print("   [X] MediaPipe missing: pip install mediapipe")

try:
    import numpy
    print("   [OK] NumPy installed")
except ImportError:
    print("   [X] NumPy missing: pip install numpy")

try:
    import requests
    print("   [OK] Requests installed")
except ImportError:
    print("   [X] Requests missing: pip install requests")

print("\n2. Checking environment variables...")
ai_key = os.getenv('AI_API_KEY', '')
if ai_key:
    print(f"   [OK] AI_API_KEY set (length: {len(ai_key)})")
else:
    print("   [!] AI_API_KEY not set (will use fallback recommendations)")

print("\n3. Checking camera...")
try:
    import cv2
    cap = cv2.VideoCapture(0)
    if cap.isOpened():
        ret, frame = cap.read()
        if ret and frame is not None:
            print(f"   [OK] Camera working (resolution: {frame.shape[1]}x{frame.shape[0]})")
        else:
            print("   [X] Camera opened but cannot read frames")
        cap.release()
    else:
        print("   [X] Cannot open camera")
except Exception as e:
    print(f"   [X] Camera check failed: {e}")

print("\n4. Checking database...")
try:
    from database import Database
    db = Database()
    places = db.get_all_places()
    users = db.get_all_users()
    print(f"   [OK] Database loaded: {len(places)} places, {len(users)} users")
except Exception as e:
    print(f"   [X] Database error: {e}")

print("\n5. Checking finger tracking module...")
try:
    sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'danielz_test_files'))
    from finger_track import VisualTracking
    print("   [OK] VisualTracking module found")
except Exception as e:
    print(f"   [X] Cannot import VisualTracking: {e}")

print("\n" + "="*60)
print("System Check Complete")
print("="*60)

print("\nTo start the gesture swiper:")
print("  Windows: start_gesture_swiper.bat user_test Paris")
print("  Linux:   ./start_gesture_swiper.sh user_test Paris")
print("  Python:  python gesture_server.py user_test Paris")
