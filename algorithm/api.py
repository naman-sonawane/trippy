"""FastAPI server for recommendation engine."""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

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


class ConfidenceCheckRequest(BaseModel):
    userId: str
    destination: str


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
        
        # Determine item type by checking if it's a place or activity
        places = db.get_places_by_destination(action.destination)
        activities = db.get_activities_by_destination(action.destination)
        place_ids = {p.id for p in places}
        activity_ids = {a.id for a in activities}
        
        item_type = "place" if action.itemId in place_ids else "activity"
        
        interaction = Interaction(
            user_id=action.userId,
            item_id=action.itemId,
            item_type=item_type,
            rating=rating,
            timestamp=datetime.now().isoformat()
        )
        
        db.add_interaction(interaction)
        
        return {"success": True}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/confidence-check")
async def check_confidence(request: ConfidenceCheckRequest):
    """Check user confidence metrics."""
    try:
        user = db.get_user(request.userId)
        if not user:
            return {
                "likes": 0,
                "dislikes": 0,
                "total": 0,
                "confidence_ratio": 0.0,
                "meets_threshold": False
            }
        
        # Get all interactions for user
        all_interactions = db.get_user_interactions(request.userId)
        
        # Get items in destination
        places = db.get_places_by_destination(request.destination)
        activities = db.get_activities_by_destination(request.destination)
        destination_item_ids = {p.id for p in places} | {a.id for a in activities}
        
        # Filter interactions to destination items only
        destination_interactions = [
            inter for inter in all_interactions
            if inter.item_id in destination_item_ids
        ]
        
        # Count likes and dislikes
        likes = sum(1 for inter in destination_interactions if inter.rating == 1)
        dislikes = sum(1 for inter in destination_interactions if inter.rating == -1)
        total = likes + dislikes
        
        # Calculate confidence ratio
        confidence_ratio = (likes / total) if total > 0 else 0.0
        
        # Check threshold: >= 20 likes AND >= 95% confidence ratio
        meets_threshold = likes >= 20 and confidence_ratio >= 0.95
        
        return {
            "likes": likes,
            "dislikes": dislikes,
            "total": total,
            "confidence_ratio": confidence_ratio,
            "meets_threshold": meets_threshold
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/high-confidence-items")
async def get_high_confidence_items(request: ConfidenceCheckRequest):
    """Get liked items + high-confidence recommendations (score >= 0.8)."""
    try:
        user = db.get_user(request.userId)
        if not user:
            return {"items": []}
        
        # Get all interactions for user
        all_interactions = db.get_user_interactions(request.userId)
        
        # Get items in destination
        places = db.get_places_by_destination(request.destination)
        activities = db.get_activities_by_destination(request.destination)
        
        # Get user's liked item IDs
        liked_item_ids = {inter.item_id for inter in all_interactions if inter.rating == 1}
        
        # Get all user-interacted item IDs
        user_item_ids = {inter.item_id for inter in all_interactions}
        
        # Get high-confidence recommendations (score >= 0.8)
        recommendations = engine.get_recommendations(user, request.destination, top_n=100)
        high_confidence_items = [
            (item, score) for item, score in recommendations
            if score >= 0.8 and item.id not in user_item_ids
        ]
        
        # Combine: liked items + high-confidence recommendations
        result_items = []
        item_ids_added = set()
        
        # Add liked items first
        for item_id in liked_item_ids:
            item = None
            if item_id in {p.id for p in places}:
                item = next((p for p in places if p.id == item_id), None)
            elif item_id in {a.id for a in activities}:
                item = next((a for a in activities if a.id == item_id), None)
            
            if item and item_id not in item_ids_added:
                item_dict = {
                    "id": item.id,
                    "name": item.name,
                    "category": item.category,
                    "description": item.description or "",
                    "features": item.features,
                    "score": 1.0,  # Liked items get max score
                }
                
                if hasattr(item, 'location'):
                    item_dict["location"] = item.location
                    item_dict["type"] = "place"
                else:
                    item_dict["placeId"] = item.place_id
                    item_dict["type"] = "activity"
                
                result_items.append(item_dict)
                item_ids_added.add(item_id)
        
        # Add high-confidence recommendations
        for item, score in high_confidence_items:
            if item.id not in item_ids_added:
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
                
                result_items.append(item_dict)
                item_ids_added.add(item.id)
        
        return {"items": result_items}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
