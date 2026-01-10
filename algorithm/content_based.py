"""Content-based filtering recommendation engine."""
from typing import List, Dict
from models import User, Place, Activity, Interaction
from database import Database


class ContentBasedFilter:
    """Content-based recommendation using item features."""
    
    def __init__(self, db: Database):
        """Initialize content-based filter with database."""
        self.db = db
    
    def extract_user_preferences(self, user: User) -> Dict[str, float]:
        """
        Extract user preferences from interaction history.
        
        Returns dictionary of feature -> preference weight.
        """
        interactions = self.db.get_user_interactions(user.id)
        
        if len(interactions) == 0:
            return {}
        
        feature_weights: Dict[str, float] = {}
        total_weight = 0.0
        
        for inter in interactions:
            if inter.rating <= 0:
                continue
            
            # Get item features
            if inter.item_type == "place":
                item = self.db.get_place_by_id(inter.item_id)
            else:
                item = self.db.get_activity_by_id(inter.item_id)
            
            if item is None:
                continue
            
            # Extract features
            features = item.features
            category = item.category.lower()
            energy_level = features.get("energy_level", "medium").lower()
            tags = features.get("tags", [])
            age_suitability = features.get("age_suitability_profile", "").lower()
            
            # Weight features by rating
            weight = inter.rating
            
            # Add category preference
            if category not in feature_weights:
                feature_weights[category] = 0.0
            feature_weights[category] += weight
            
            # Add energy level preference
            if energy_level not in feature_weights:
                feature_weights[energy_level] = 0.0
            feature_weights[energy_level] += weight
            
            # Add tag preferences
            for tag in tags:
                tag_lower = tag.lower()
                if tag_lower not in feature_weights:
                    feature_weights[tag_lower] = 0.0
                feature_weights[tag_lower] += weight
            
            # Add age suitability preference
            if age_suitability:
                if age_suitability not in feature_weights:
                    feature_weights[age_suitability] = 0.0
                feature_weights[age_suitability] += weight
            
            total_weight += weight
        
        # Normalize weights
        if total_weight > 0:
            feature_weights = {k: v / total_weight for k, v in feature_weights.items()}
        
        return feature_weights
    
    def calculate_item_score(self, item: Place | Activity, user_preferences: Dict[str, float]) -> float:
        """Calculate content-based score for an item."""
        if not user_preferences:
            return 0.5  # Default neutral score
        
        features = item.features
        category = item.category.lower()
        energy_level = features.get("energy_level", "medium").lower()
        tags = features.get("tags", [])
        age_suitability = features.get("age_suitability_profile", "").lower()
        
        score = 0.0
        matches = 0
        
        # Match category
        if category in user_preferences:
            score += user_preferences[category]
            matches += 1
        
        # Match energy level
        if energy_level in user_preferences:
            score += user_preferences[energy_level]
            matches += 1
        
        # Match tags
        for tag in tags:
            tag_lower = tag.lower()
            if tag_lower in user_preferences:
                score += user_preferences[tag_lower] * 0.5  # Tags weighted less
                matches += 1
        
        # Match age suitability
        if age_suitability and age_suitability in user_preferences:
            score += user_preferences[age_suitability]
            matches += 1
        
        # Normalize by number of matches
        if matches > 0:
            score = score / (matches + 1)  # Add 1 to prevent division by zero
        
        return min(1.0, max(0.0, score))  # Clamp between 0 and 1
    
    def get_recommendations(
        self,
        user: User,
        places: List[Place],
        activities: List[Activity],
        top_n: int = 20
    ) -> Dict[str, float]:
        """
        Get content-based recommendations.
        
        Returns dictionary mapping item_id to recommendation score.
        """
        user_preferences = self.extract_user_preferences(user)
        
        item_scores: Dict[str, float] = {}
        
        # Score places
        for place in places:
            score = self.calculate_item_score(place, user_preferences)
            item_scores[place.id] = score
        
        # Score activities
        for activity in activities:
            score = self.calculate_item_score(activity, user_preferences)
            item_scores[activity.id] = score
        
        # Sort and return top N
        sorted_items = sorted(item_scores.items(), key=lambda x: x[1], reverse=True)
        return dict(sorted_items[:top_n])

