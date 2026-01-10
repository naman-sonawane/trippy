# Trippy - Setup Guide

## Overview
Your app now has:
1. **User database** with fields: Username, Age, Budget, Walk, DayNight, Solo
2. **Itinerary saving** (renamed from schedule)
3. **Algorithm integration** with Tinder-style swipe interface
4. **Tavus AI agent** that asks travel preference questions

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

1. **User visits /agent** → Tavus AI asks questions:
   - Age
   - Budget (low/medium/high)
   - Walk preference (minimal/moderate/a lot)
   - Day/Night preference
   - Solo or group travel

2. **After conversation** → Button to go to /recommendations

3. **User swipes** on recommendations (Tinder-style)
   - Algorithm provides personalized recommendations
   - Likes/dislikes are saved to database
   - Algorithm learns from preferences

4. **Itinerary creation** → User can build itinerary at /schedule?tripId=XXX&days=3

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
TAVUS_API_KEY=your_tavus_key
TAVUS_REPLICA_ID=your_replica_id
TAVUS_PERSONA_ID=your_persona_id
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

1. Visit http://localhost:3000/agent
2. Talk to Tavus AI and answer the questions
3. Click "Start Swiping" button
4. Swipe through recommendations
5. Create an itinerary at /schedule

## Notes

- The algorithm uses collaborative filtering, content-based filtering, and Pinecone for semantic search
- User preferences are stored in MongoDB and synced with the Python algorithm
- Itineraries are automatically saved to the database as you edit them
- The swipe interface shows match scores based on the hybrid recommendation algorithm
