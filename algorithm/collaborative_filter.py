"""Collaborative filtering recommendation engine."""
import numpy as np
from typing import List, Dict, Tuple
from models import User, Place, Activity, Interaction
from database import Database


class CollaborativeFilter:
    """User-user collaborative filtering."""
    
    def __init__(self, db: Database):
        """Initialize collaborative filter with database."""
        self.db = db
    
    def calculate_user_similarity(self, user1: User, user2: User) -> float:
        """
        Calculate cosine similarity between two users based on their interactions.
        
        Returns similarity score between 0 and 1.
        """
        interactions1 = self.db.get_user_interactions(user1.id)
        interactions2 = self.db.get_user_interactions(user2.id)
        
        # Create item rating vectors
        items1 = {inter.item_id: inter.rating for inter in interactions1}
        items2 = {inter.item_id: inter.rating for inter in interactions2}
        
        # Find common items
        common_items = set(items1.keys()) & set(items2.keys())
        
        if len(common_items) == 0:
            return 0.0
        
        # Build vectors for common items
        vec1 = np.array([items1[item] for item in common_items])
        vec2 = np.array([items2[item] for item in common_items])
        
        # Calculate cosine similarity
        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        similarity = dot_product / (norm1 * norm2)
        return max(0.0, similarity)  # Ensure non-negative
    
    def find_similar_users(self, target_user: User, top_k: int = 10) -> List[Tuple[User, float]]:
        """Find top K most similar users."""
        all_users = self.db.get_all_users()
        similarities = []
        
        for user in all_users:
            if user.id == target_user.id:
                continue
            
            similarity = self.calculate_user_similarity(target_user, user)
            if similarity > 0:
                similarities.append((user, similarity))
        
        # Sort by similarity descending
        similarities.sort(key=lambda x: x[1], reverse=True)
        return similarities[:top_k]
    
    def get_recommendations(
        self, 
        target_user: User, 
        places: List[Place], 
        activities: List[Activity],
        top_n: int = 20
    ) -> Dict[str, float]:
        """
        Get collaborative filtering recommendations.
        
        Returns dictionary mapping item_id to recommendation score.
        """
        similar_users = self.find_similar_users(target_user)
        
        if len(similar_users) == 0:
            return {}
        
        # Get items user hasn't interacted with
        user_interactions = self.db.get_user_interactions(target_user.id)
        user_item_ids = {inter.item_id for inter in user_interactions}
        
        # Collect recommendations from similar users
        item_scores: Dict[str, float] = {}
        
        for similar_user, similarity in similar_users:
            similar_interactions = self.db.get_user_interactions(similar_user.id)
            
            for inter in similar_interactions:
                if inter.item_id not in user_item_ids and inter.rating > 0:
                    # Weight by similarity and rating
                    score = similarity * inter.rating
                    if inter.item_id not in item_scores:
                        item_scores[inter.item_id] = 0.0
                    item_scores[inter.item_id] += score
        
        # Normalize scores
        if item_scores:
            max_score = max(item_scores.values())
            if max_score > 0:
                item_scores = {k: v / max_score for k, v in item_scores.items()}
        
        # Filter to only include items in provided lists
        valid_item_ids = {p.id for p in places} | {a.id for a in activities}
        item_scores = {k: v for k, v in item_scores.items() if k in valid_item_ids}
        
        # Return top N
        sorted_items = sorted(item_scores.items(), key=lambda x: x[1], reverse=True)
        return dict(sorted_items[:top_n])

