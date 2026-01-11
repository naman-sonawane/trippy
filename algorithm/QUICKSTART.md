# Quick Start - Gesture Swiper

## 1. Install Dependencies

```bash
pip install opencv-python mediapipe numpy requests
```

## 2. Set Environment Variable (Optional but Recommended)

Get your API key from https://hackclub.com/ai

**Windows (PowerShell):**
```powershell
$env:AI_API_KEY="your_api_key_here"
```

**Windows (CMD):**
```cmd
set AI_API_KEY=your_api_key_here
```

**Linux/Mac:**
```bash
export AI_API_KEY=your_api_key_here
```

## 3. Test Your System

```bash
cd algorithm
python check_system.py
```

## 4. Run the Gesture Swiper

**Easy Way (Windows):**
```bash
start_gesture_swiper.bat user_test Tokyo
```

**Easy Way (Linux/Mac):**
```bash
chmod +x start_gesture_swiper.sh
./start_gesture_swiper.sh user_test Tokyo
```

**Direct Python:**
```bash
python gesture_server.py user_test Tokyo
```

## 5. How to Use

1. A camera window will open showing your hand tracking
2. Hold your hand up in front of the camera
3. **Swipe RIGHT** to like a place (heart)
4. **Swipe LEFT** to pass on a place (X)
5. Press **'q'** to quit anytime

## What Happens Behind the Scenes

### For Destinations in Database (Paris, Tokyo, New York, Barcelona):
- Loads real places from mock_db.json
- Shows actual attractions like Eiffel Tower, Shibuya Crossing, etc.

### For New Destinations (anywhere else):
- Uses Gemini AI to fetch 15 real tourist spots
- Examples: Rome, London, Dubai, Sydney, etc.
- AI provides actual place names, categories, descriptions

### If Gemini Fails:
- Falls back to generic recommendations
- Still functional, just less specific

## Troubleshooting

**Camera not working?**
- Make sure no other app is using it
- Try closing Zoom, Teams, etc.
- Check camera permissions in Windows settings

**Hand not detected?**
- Ensure good lighting
- Keep hand clearly visible
- Don't move too fast

**No places showing?**
- Check internet connection (for Gemini)
- Verify AI_API_KEY is set
- Fallback will still work without API key

## Example Usage

```bash
python gesture_server.py test_user "New York"
python gesture_server.py john_doe Paris
python gesture_server.py user123 Tokyo
python gesture_server.py travel_fan "San Francisco"
```

## What Gets Saved

All your swipes are saved to `algorithm/data/mock_db.json`:
- User preferences
- Liked/disliked places
- Timestamps
- Used for ML recommendations later
