"""Data models for the recommendation system."""
from dataclasses import dataclass
from typing import List, Optional, Dict, Any
from datetime import datetime


@dataclass
class User:
    """User model."""
    id: str
    age: int
    preferences: List[str]  # List of liked place/activity IDs
    travel_history: List[str]  # List of destinations visited


@dataclass
class Place:
    """Place model."""
    id: str
    name: str
    location: str  # Destination/city
    category: str
    features: Dict[str, Any]  # tags, price_range, energy_level, age_suitability_profile
    description: Optional[str] = None


@dataclass
class Activity:
    """Activity model."""
    id: str
    name: str
    place_id: str
    category: str
    features: Dict[str, Any]  # tags, energy_level, age_suitability_profile
    description: Optional[str] = None


@dataclass
class Interaction:
    """User interaction with place/activity."""
    user_id: str
    item_id: str  # place_id or activity_id
    item_type: str  # "place" or "activity"
    rating: int  # 1 for like, -1 for dislike
    timestamp: str

