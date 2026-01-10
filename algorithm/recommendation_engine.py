"""Main recommendation engine orchestrating hybrid approach."""
from typing import List, Dict, Tuple
from models import User, Place, Activity
from database import Database
from collaborative_filter import CollaborativeFilter
from content_based import ContentBasedFilter
from pinecone_service import PineconeService
from age_scorer import AgeScorer


class RecommendationEngine:
    """Hybrid recommendation engine."""
    
    def __init__(self, db: Database):
        """Initialize recommendation engine."""
        self.db = db
        self.collab_filter = CollaborativeFilter(db)
        self.content_filter = ContentBasedFilter(db)
        self.pinecone_service = PineconeService()
        self.age_scorer = AgeScorer()
    
    def get_recommendations(
        self,
        user: User,
        destination: str,
        top_n: int = 10
    ) -> List[Tuple[Place | Activity, float]]:
        """
        Get hybrid recommendations for a user.
        
        Returns list of (item, final_score) tuples sorted by score descending.
        """
        # Get items in destination
        places = self.db.get_places_by_destination(destination)
        activities = self.db.get_activities_by_destination(destination)
        
        if len(places) == 0 and len(activities) == 0:
            return []
        
        # Upsert items to Pinecone (if available)
        self.pinecone_service.upsert_items(places, activities)
        
        # Get recommendations from each method
        collab_scores = self.collab_filter.get_recommendations(
            user, places, activities, top_n * 3
        )
        
        content_scores = self.content_filter.get_recommendations(
            user, places, activities, top_n * 3
        )
        
        user_interactions = self.db.get_user_interactions(user.id)
        pinecone_scores = self.pinecone_service.get_recommendations(
            user_interactions, places, activities, destination, top_n * 3
        )
        
        # Combine scores with weights
        # collab: 0.4, content: 0.3, pinecone: 0.3
        all_item_ids = set(collab_scores.keys()) | set(content_scores.keys()) | set(pinecone_scores.keys())
        
        combined_scores: Dict[str, float] = {}
        
        for item_id in all_item_ids:
            collab_score = collab_scores.get(item_id, 0.0)
            content_score = content_scores.get(item_id, 0.0)
            pinecone_score = pinecone_scores.get(item_id, 0.0)
            
            # Weighted combination
            base_score = (
                collab_score * 0.4 +
                content_score * 0.3 +
                pinecone_score * 0.3
            )
            
            # Apply age suitability multiplier
            item = None
            if item_id in {p.id for p in places}:
                item = next((p for p in places if p.id == item_id), None)
            elif item_id in {a.id for a in activities}:
                item = next((a for a in activities if a.id == item_id), None)
            
            if item:
                if isinstance(item, Place):
                    age_multiplier = self.age_scorer.get_multiplier_for_place(user.age, item)
                else:
                    age_multiplier = self.age_scorer.get_multiplier_for_activity(user.age, item)
                
                final_score = base_score * age_multiplier
                combined_scores[item_id] = final_score
        
        # Sort by final score
        sorted_items = sorted(combined_scores.items(), key=lambda x: x[1], reverse=True)
        
        # Convert to (item, score) tuples
        results = []
        for item_id, score in sorted_items[:top_n]:
            item = None
            if item_id in {p.id for p in places}:
                item = next((p for p in places if p.id == item_id), None)
            elif item_id in {a.id for a in activities}:
                item = next((a for a in activities if a.id == item_id), None)
            
            if item:
                results.append((item, score))
        
        return results

