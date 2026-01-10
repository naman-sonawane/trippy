"""Database interface for JSON-based mock database."""
import json
import os
from typing import List, Optional, Dict, Any
from models import User, Place, Activity, Interaction


class Database:
    """JSON-based database interface."""
    
    def __init__(self, db_path: str = None):
        """Initialize database with path to JSON file."""
        if db_path is None:
            # Default to data/mock_db.json relative to this file
            script_dir = os.path.dirname(os.path.abspath(__file__))
            db_path = os.path.join(script_dir, "data", "mock_db.json")
        self.db_path = db_path
        self._ensure_data_dir()
        self._load_db()
    
    def _ensure_data_dir(self):
        """Ensure data directory exists."""
        data_dir = os.path.dirname(self.db_path)
        if data_dir and not os.path.exists(data_dir):
            os.makedirs(data_dir, exist_ok=True)
    
    def _load_db(self):
        """Load database from JSON file."""
        if os.path.exists(self.db_path):
            with open(self.db_path, 'r') as f:
                self.db = json.load(f)
        else:
            # Initialize empty database
            self.db = {
                "users": [],
                "places": [],
                "activities": [],
                "interactions": []
            }
            self._save_db()
    
    def _save_db(self):
        """Save database to JSON file."""
        with open(self.db_path, 'w') as f:
            json.dump(self.db, f, indent=2)
    
    def get_user(self, user_id: str) -> Optional[User]:
        """Get user by ID."""
        for user_data in self.db["users"]:
            if user_data["id"] == user_id:
                return User(**user_data)
        return None
    
    def get_places_by_destination(self, destination: str) -> List[Place]:
        """Get all places in a destination."""
        return [
            Place(**place_data)
            for place_data in self.db["places"]
            if place_data["location"].lower() == destination.lower()
        ]
    
    def get_activities_by_destination(self, destination: str) -> List[Activity]:
        """Get all activities in places within a destination."""
        place_ids = {place.id for place in self.get_places_by_destination(destination)}
        return [
            Activity(**activity_data)
            for activity_data in self.db["activities"]
            if activity_data["place_id"] in place_ids
        ]
    
    def get_user_interactions(self, user_id: str) -> List[Interaction]:
        """Get all interactions for a user."""
        return [
            Interaction(**interaction_data)
            for interaction_data in self.db["interactions"]
            if interaction_data["user_id"] == user_id
        ]
    
    def get_all_users(self) -> List[User]:
        """Get all users."""
        return [User(**user_data) for user_data in self.db["users"]]
    
    def get_all_places(self) -> List[Place]:
        """Get all places."""
        return [Place(**place_data) for place_data in self.db["places"]]
    
    def get_all_activities(self) -> List[Activity]:
        """Get all activities."""
        return [Activity(**activity_data) for activity_data in self.db["activities"]]
    
    def add_interaction(self, interaction: Interaction):
        """Add a new interaction."""
        interaction_dict = {
            "user_id": interaction.user_id,
            "item_id": interaction.item_id,
            "item_type": interaction.item_type,
            "rating": interaction.rating,
            "timestamp": interaction.timestamp
        }
        self.db["interactions"].append(interaction_dict)
        self._save_db()
    
    def get_place_by_id(self, place_id: str) -> Optional[Place]:
        """Get place by ID."""
        for place_data in self.db["places"]:
            if place_data["id"] == place_id:
                return Place(**place_data)
        return None
    
    def get_activity_by_id(self, activity_id: str) -> Optional[Activity]:
        """Get activity by ID."""
        for activity_data in self.db["activities"]:
            if activity_data["id"] == activity_id:
                return Activity(**activity_data)
        return None
    
    def save_user(self, user: User):
        """Save or update a user in the database."""
        user_dict = {
            "id": user.id,
            "age": user.age,
            "preferences": user.preferences,
            "travel_history": user.travel_history
        }
        
        # Check if user exists
        user_index = None
        for i, existing_user in enumerate(self.db["users"]):
            if existing_user["id"] == user.id:
                user_index = i
                break
        
        if user_index is not None:
            # Update existing user
            self.db["users"][user_index] = user_dict
        else:
            # Add new user
            self.db["users"].append(user_dict)
        
        self._save_db()

