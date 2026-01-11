# Gesture-Controlled Recommendation Swiper

AI-powered gesture control system for swiping through travel recommendations using MediaPipe hand tracking and Gemini AI.

## Features

- **Hand Gesture Control**: Swipe left/right with your hand to pass or like recommendations
- **Real-Time AI**: Uses Gemini AI to fetch actual places and activities for any destination
- **Visual Feedback**: Live camera feed with recommendation overlay
- **Database Integration**: Records all interactions for personalized recommendations
- **Fallback System**: Uses database places → Gemini AI → generic fallbacks

## Quick Start

### Windows
```bash
start_gesture_swiper.bat user_test Paris
```

### Linux/Mac
```bash
chmod +x start_gesture_swiper.sh
./start_gesture_swiper.sh user_test Paris
```

### Python Direct
```bash
python gesture_server.py <user_id> <destination>
```

## How It Works

1. **Camera Initialization**: Opens webcam with MediaPipe hand tracking
2. **Load Recommendations**: 
   - First checks database for existing places
   - If none found, queries Gemini AI for real locations
   - Falls back to generic recommendations if API fails
3. **Gesture Detection**: Tracks hand movement to detect left/right swipes
4. **Record Interactions**: Saves likes/dislikes to database for ML recommendations

## Controls

- **Swipe LEFT**: Pass/Dislike (red ✕)
- **Swipe RIGHT**: Like (green ❤️)
- **Press 'q'**: Quit

## Requirements

```bash
pip install opencv-python mediapipe numpy requests
```

## Environment Variables

- `AI_API_KEY`: Hackclub AI API key for Gemini access

## How Gestures Work

The system uses MediaPipe Hands to track your hand position:
- Detects hand center (wrist landmark)
- Tracks movement over 8+ frames
- Requires 40% consistency in direction
- Minimum horizontal movement: 12% of screen width
- Cooldown: 0.8 seconds between swipes

## Gemini AI Integration

When no database entries exist for a destination, the system:
1. Sends destination to Gemini 2.0 Flash
2. Requests 15 real tourist attractions/activities
3. Parses structured JSON response
4. Generates unique IDs and metadata
5. Displays in swiper interface

## Database Structure

Interactions are saved as:
```json
{
  "user_id": "user_test",
  "item_id": "gemini_Paris_5",
  "item_type": "place",
  "rating": 1,
  "timestamp": "2026-01-10T19:00:00"
}
```

## Troubleshooting

**Camera not opening:**
- Check if camera is already in use
- Try different `cam_index` (0, 1, 2...)
- Ensure camera permissions are granted

**No gestures detected:**
- Ensure good lighting
- Keep hand clearly visible
- Move hand smoothly across camera view
- Check MediaPipe detection confidence settings

**Gemini API errors:**
- Verify `AI_API_KEY` environment variable
- Check internet connection
- System falls back to generic recommendations

**No places showing:**
- Database may be empty for destination
- Gemini may need better internet connection
- Generic fallbacks will still work

## Architecture

```
gesture_server.py
├── GestureRecommendationSwiper
│   ├── VisualTracking (MediaPipe)
│   ├── Database (JSON storage)
│   └── Gemini AI (place fetching)
└── Main Loop
    ├── Read camera frame
    ├── Detect gestures
    ├── Display current card
    └── Record swipes
```

## Integration with Main App

The gesture swiper works standalone but integrates with:
- `/api/recommendations` - Fetches personalized recommendations
- `/api/swipe` - Records user preferences
- Database - Stores all interactions for ML models
