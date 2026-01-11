"""FastAPI server for recommendation engine."""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime

from database import Database
from recommendation_engine import RecommendationEngine
from models import User, Interaction
from webscraper import webscrape_location

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


class MultiUserRecommendationRequest(BaseModel):
    userId: str
    participantPreferences: List[UserPreferences]
    destination: str
    topN: int = 20


class MultiUserConfidenceCheckRequest(BaseModel):
    participantIds: List[str]
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
        
        # Check if activities exist, if not, webscrape
        places = db.get_places_by_destination(request.destination)
        activities = db.get_activities_by_destination(request.destination)
        
        if not places or not activities:
            # Webscrape location if data doesn't exist
            webscrape_location(db, request.destination, max_activities=50)
        
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


@app.post("/api/multi-user-recommendations")
async def get_multi_user_recommendations(request: MultiUserRecommendationRequest):
    """Get recommendations for a user considering all trip participants."""
    try:
        # Get requesting user
        requesting_user = db.get_user(request.userId)
        if not requesting_user:
            requesting_user = User(
                id=request.userId,
                age=25,
                preferences=[],
                travel_history=[request.destination]
            )
            db.save_user(requesting_user)
        
        # Get items in destination
        places = db.get_places_by_destination(request.destination)
        activities = db.get_activities_by_destination(request.destination)
        
        if len(places) == 0 and len(activities) == 0:
            return {"recommendations": []}
        
        # Aggregate preferences from all participants
        all_liked_items = set()
        participant_ages = []
        
        for pref in request.participantPreferences:
            all_liked_items.update(pref.likedItems)
            if pref.age:
                participant_ages.append(pref.age)
        
        # Get average age for age scoring (use requesting user's age if no others)
        avg_age = participant_ages[0] if participant_ages else requesting_user.age
        
        # Generate recommendations for requesting user (personalized)
        recommendations = engine.get_recommendations(
            requesting_user, request.destination, request.topN * 2
        )
        
        # Boost scores for items liked by multiple participants
        item_boost: Dict[str, float] = {}
        for pref in request.participantPreferences:
            for item_id in pref.likedItems:
                if item_id not in item_boost:
                    item_boost[item_id] = 0.0
                item_boost[item_id] += 0.1  # Small boost per participant who liked it
        
        # Apply boosts and re-sort
        boosted_recommendations = []
        for item, score in recommendations:
            boost = item_boost.get(item.id, 0.0)
            # Cap boost at 0.5 (50% increase max)
            boost = min(boost, 0.5)
            final_score = score * (1.0 + boost)
            boosted_recommendations.append((item, final_score))
        
        # Re-sort by boosted score
        boosted_recommendations.sort(key=lambda x: x[1], reverse=True)
        
        # Convert to result format
        result = []
        for item, score in boosted_recommendations[:request.topN]:
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


@app.post("/api/multi-user-confidence-check")
async def check_multi_user_confidence(request: MultiUserConfidenceCheckRequest):
    """Check confidence metrics for all participants - all must reach 95%."""
    try:
        # Get items in destination
        places = db.get_places_by_destination(request.destination)
        activities = db.get_activities_by_destination(request.destination)
        destination_item_ids = {p.id for p in places} | {a.id for a in activities}
        
        participant_results = []
        all_ready = True
        
        for participant_id in request.participantIds:
            user = db.get_user(participant_id)
            
            if not user:
                participant_results.append({
                    "userId": participant_id,
                    "likes": 0,
                    "dislikes": 0,
                    "total": 0,
                    "confidenceRatio": 0.0,
                    "meetsThreshold": False
                })
                all_ready = False
                continue
            
            # Get all interactions for user
            all_interactions = db.get_user_interactions(participant_id)
            
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
            
            participant_results.append({
                "userId": participant_id,
                "likes": likes,
                "dislikes": dislikes,
                "total": total,
                "confidenceRatio": confidence_ratio,
                "meetsThreshold": meets_threshold
            })
            
            if not meets_threshold:
                all_ready = False
        
        return {
            "allReady": all_ready,
            "participants": participant_results
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
