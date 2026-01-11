"""FastAPI server for recommendation engine."""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import os
import requests

from database import Database
from recommendation_engine import RecommendationEngine
from models import User, Interaction

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db = Database()
engine = RecommendationEngine(db)


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


def get_gemini_recommendations(destination: str, age: int) -> List[dict]:
    """Fetch real places using Gemini AI."""
    gemini_api_key = os.getenv('AI_API_KEY', '')
    if not gemini_api_key:
        print("No AI_API_KEY found, using generic fallback")
        return get_fallback_recommendations(destination, age)
    
    prompt = f"""You are a travel expert. Provide 15 real, popular tourist attractions, restaurants, and activities in {destination}.

For each place, return JSON in this exact format:
{{
  "name": "exact place name",
  "category": "Landmark|Restaurant|Museum|Park|Beach|Shopping|Nightlife|Activity",
  "description": "brief 1-sentence description",
  "tags": ["tag1", "tag2", "tag3"],
  "price_range": "$|$$|$$$",
  "energy_level": "Low|Medium|High"
}}

Return ONLY a JSON array of 15 places. No other text."""

    try:
        response = requests.post(
            'https://ai.hackclub.com/proxy/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {gemini_api_key}',
                'Content-Type': 'application/json',
            },
            json={
                'model': 'google/gemini-2.0-flash-exp:free',
                'messages': [
                    {
                        'role': 'system',
                        'content': 'You are a travel data assistant. Return only valid JSON arrays.'
                    },
                    {
                        'role': 'user',
                        'content': prompt
                    }
                ],
                'temperature': 0.7,
            },
            timeout=30
        )
        
        if response.ok:
            data = response.json()
            content = data.get('choices', [{}])[0].get('message', {}).get('content', '[]')
            
            json_content = content
            if '```json' in content:
                json_content = content.split('```json')[1].split('```')[0].strip()
            elif '```' in content:
                json_content = content.split('```')[1].split('```')[0].strip()
            
            import json
            places = json.loads(json_content)
            
            result = []
            for idx, place_data in enumerate(places):
                result.append({
                    'id': f'gemini_{destination}_{idx}',
                    'name': place_data.get('name', 'Unknown'),
                    'category': place_data.get('category', 'Attraction'),
                    'description': place_data.get('description', ''),
                    'location': destination,
                    'type': 'place',
                    'features': {
                        'tags': place_data.get('tags', []),
                        'price_range': place_data.get('price_range', '$$'),
                        'energy_level': place_data.get('energy_level', 'Medium')
                    },
                    'score': 0.7 - (idx * 0.02)
                })
            
            return result
        else:
            print(f"Gemini API error: {response.status_code}")
            return get_fallback_recommendations(destination, age)
            
    except Exception as e:
        print(f"Error fetching from Gemini: {e}")
        return get_fallback_recommendations(destination, age)


def get_fallback_recommendations(destination: str, age: int) -> List[dict]:
    """Generate fallback recommendations for destinations with no data."""
    fallback_places = [
        {
            "id": f"fallback_{destination}_1",
            "name": f"Historic City Center",
            "category": "Landmark",
            "description": f"Explore the heart of {destination} with its historic architecture and local charm",
            "features": {
                "tags": ["Historic", "Photography", "Walking"],
                "price_range": "$$",
                "energy_level": "Medium"
            },
            "location": destination,
            "type": "place",
            "score": 0.75
        },
        {
            "id": f"fallback_{destination}_2",
            "name": f"Local Market",
            "category": "Shopping",
            "description": f"Experience authentic local culture at {destination}'s vibrant marketplace",
            "features": {
                "tags": ["Culture", "Shopping", "Food"],
                "price_range": "$",
                "energy_level": "Medium"
            },
            "location": destination,
            "type": "place",
            "score": 0.72
        },
        {
            "id": f"fallback_{destination}_3",
            "name": f"Waterfront Promenade",
            "category": "Outdoor",
            "description": f"Scenic views and relaxing walks along {destination}'s waterfront",
            "features": {
                "tags": ["Scenic", "Walking", "Relaxation"],
                "price_range": "Free",
                "energy_level": "Low"
            },
            "location": destination,
            "type": "place",
            "score": 0.70
        },
        {
            "id": f"fallback_{destination}_4",
            "name": f"Popular Local Restaurant",
            "category": "Dining",
            "description": f"Taste authentic local cuisine at one of {destination}'s highly-rated restaurants",
            "features": {
                "tags": ["Food", "Local Cuisine", "Dining"],
                "price_range": "$$",
                "energy_level": "Low"
            },
            "location": destination,
            "type": "place",
            "score": 0.68
        },
        {
            "id": f"fallback_{destination}_5",
            "name": f"City Museum",
            "category": "Museum",
            "description": f"Learn about {destination}'s rich history and culture",
            "features": {
                "tags": ["Culture", "History", "Indoor"],
                "price_range": "$$",
                "energy_level": "Low"
            },
            "location": destination,
            "type": "place",
            "score": 0.65
        },
        {
            "id": f"fallback_{destination}_6",
            "name": f"Scenic Viewpoint",
            "category": "Nature",
            "description": f"Capture breathtaking panoramic views of {destination}",
            "features": {
                "tags": ["Scenic", "Photography", "Nature"],
                "price_range": "Free",
                "energy_level": "Medium"
            },
            "location": destination,
            "type": "place",
            "score": 0.63
        },
        {
            "id": f"fallback_{destination}_7",
            "name": f"Local Café",
            "category": "Café",
            "description": f"Relax with coffee and watch local life in {destination}",
            "features": {
                "tags": ["Coffee", "Relaxation", "Local"],
                "price_range": "$",
                "energy_level": "Low"
            },
            "location": destination,
            "type": "place",
            "score": 0.60
        },
        {
            "id": f"fallback_{destination}_8",
            "name": f"Nightlife District",
            "category": "Nightlife",
            "description": f"Experience {destination}'s vibrant evening entertainment scene",
            "features": {
                "tags": ["Nightlife", "Entertainment", "Social"],
                "price_range": "$$",
                "energy_level": "High"
            },
            "location": destination,
            "type": "place",
            "score": 0.58 if age >= 21 and age <= 35 else 0.45
        },
        {
            "id": f"fallback_{destination}_9",
            "name": f"Public Park",
            "category": "Park",
            "description": f"Enjoy green space and outdoor activities in {destination}",
            "features": {
                "tags": ["Nature", "Outdoor", "Relaxation"],
                "price_range": "Free",
                "energy_level": "Low"
            },
            "location": destination,
            "type": "place",
            "score": 0.55
        },
        {
            "id": f"fallback_{destination}_10",
            "name": f"Art Gallery",
            "category": "Art",
            "description": f"Discover local and international art at {destination}'s galleries",
            "features": {
                "tags": ["Art", "Culture", "Indoor"],
                "price_range": "$$",
                "energy_level": "Low"
            },
            "location": destination,
            "type": "place",
            "score": 0.52
        }
    ]
    
    return sorted(fallback_places, key=lambda x: x["score"], reverse=True)


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
                travel_history=request.user.travelHistory or [request.destination]
            )
            db.save_user(user)
        
        recommendations = engine.get_recommendations(
            user, request.destination, request.topN
        )
        
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
            
            if hasattr(item, 'location'):
                item_dict["location"] = item.location
                item_dict["type"] = "place"
            else:
                item_dict["placeId"] = item.place_id
                item_dict["type"] = "activity"
            
            result.append(item_dict)
        
        if len(result) == 0:
            result = get_gemini_recommendations(
                request.destination, 
                request.user.age or 25
            )[:request.topN]
        
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
                travel_history=[action.destination]
            )
            db.save_user(user)
        
        rating = 1 if action.action == "like" else -1
        
        interaction = Interaction(
            user_id=action.userId,
            item_id=action.itemId,
            item_type="place",
            rating=rating,
            timestamp=datetime.now().isoformat()
        )
        
        db.add_interaction(interaction)
        
        return {"success": True}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    print("Running")
    uvicorn.run(app, host="0.0.0.0", port=8000)
