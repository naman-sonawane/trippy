"""Age suitability scoring for recommendations."""
from typing import Dict, Any
from models import Place, Activity


class AgeScorer:
    """Calculate age suitability multipliers for places and activities."""
    
    def __init__(self):
        """Initialize age scorer with scoring rules."""
        pass
    
    def calculate_multiplier(self, age: int, item: Place | Activity) -> float:
        """
        Calculate suitability multiplier based on age and item characteristics.
        
        Returns multiplier in range 0.5 to 1.5.
        """
        features = item.features
        energy_level = features.get("energy_level", "medium").lower()
        age_suitability = features.get("age_suitability_profile", "").lower()
        category = item.category.lower()
        
        multiplier = 1.0  # Base neutral multiplier
        
        # High-energy activities (nightlife, clubs, extreme sports)
        if energy_level == "high" or "nightlife" in age_suitability or "club" in category:
            if 18 <= age <= 35:
                multiplier = 1.3  # Boost for young adults
            elif 36 <= age <= 50:
                multiplier = 1.0  # Neutral
            else:  # 51+
                multiplier = 0.6  # Penalty for older users
        
        # Low-energy activities (museums, parks, cultural sites)
        elif energy_level == "low" or "cultural" in age_suitability or "museum" in category:
            if age >= 30:
                multiplier = 1.1  # Slight boost for mature users
            else:
                multiplier = 1.0  # Neutral for all ages
        
        # Family-friendly activities
        elif "family" in age_suitability or "family-friendly" in category:
            if 25 <= age <= 45:
                multiplier = 1.2  # Boost for family age range
            elif age < 25:
                multiplier = 0.9  # Slight penalty for very young
            else:  # 46+
                multiplier = 1.1  # Slight boost for grandparents
        
        # Educational/cultural activities
        elif "educational" in age_suitability or "educational" in category:
            if age >= 40:
                multiplier = 1.15  # Boost for older users
            else:
                multiplier = 1.0  # Neutral for all ages
        
        # Medium energy - age-dependent
        elif energy_level == "medium":
            if 25 <= age <= 45:
                multiplier = 1.1  # Slight boost for middle-aged
            else:
                multiplier = 1.0  # Neutral
        
        # Ensure multiplier stays in valid range
        return max(0.5, min(1.5, multiplier))
    
    def get_multiplier_for_place(self, age: int, place: Place) -> float:
        """Get multiplier for a place."""
        return self.calculate_multiplier(age, place)
    
    def get_multiplier_for_activity(self, age: int, activity: Activity) -> float:
        """Get multiplier for an activity."""
        return self.calculate_multiplier(age, activity)

