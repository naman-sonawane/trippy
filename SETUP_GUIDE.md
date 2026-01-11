# Trippy - Setup Guide

## Overview
Your app now has:
1. **User database** with fields: Username, Age, Budget, Walk, DayNight, Solo
2. **Itinerary saving** (renamed from schedule)
3. **Algorithm integration** with Tinder-style swipe interface

## Database Structure

### User Model
```
- name (username)
- email
- age
- budget (low/medium/high)
- walk (minimal/moderate/a lot)
- dayNight (day/night/both)
- solo (true/false)
- preferences:
  - likedItems: [item IDs]
  - dislikedItems: [item IDs]
  - travelHistory: [destinations]
```

### Trip Model
```
- userId
- destination
- startDate
- endDate
- activities: [...]
- itinerary: [schedule items]
```

### Algorithm Data (Python)
See algorithm/data/mock_db.json for Places, Activities, and Interactions

## Workflow

1. **User creates trip** → Enter destination, start date, end date

2. **User swipes** on recommendations (Tinder-style)
   - Algorithm provides personalized recommendations
   - Likes/dislikes are saved to database
   - Algorithm learns from preferences

3. **Itinerary creation** → User can build itinerary at /schedule?tripId=XXX&days=3

## Setup Instructions

### 1. Install Python Dependencies
```bash
cd algorithm
pip install -r requirements.txt
```

### 2. Start Python API (Port 8000)
```bash
cd algorithm
python api.py
```

### 3. Environment Variables
Add to your .env.local:
```
MONGODB_URI=your_mongodb_uri
PYTHON_API_URL=http://localhost:8000
```

### 4. Start Next.js App (Port 3000)
```bash
npm run dev
```

## API Endpoints

### Next.js Routes
- POST /api/user/preferences - Update user preferences
- POST /api/recommendations - Get personalized recommendations
- POST /api/swipe - Record like/dislike
- GET/POST /api/schedule - Load/save itinerary

### Python API (Port 8000)
- POST /api/recommendations - Get recommendations from algorithm
- POST /api/swipe - Record user interactions
- GET /api/health - Health check

## Testing the Flow

1. Visit http://localhost:3000/new-trip
2. Enter trip details (destination, dates)
3. Swipe through recommendations at /recommendations
4. Create an itinerary at /schedule

## Notes

- The algorithm uses collaborative filtering, content-based filtering, and Pinecone for semantic search
- User preferences are stored in MongoDB and synced with the Python algorithm
- Itineraries are automatically saved to the database as you edit them
- The swipe interface shows match scores based on the hybrid recommendation algorithm
