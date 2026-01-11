"""Database interface for MongoDB only."""
import json
import os
from typing import List, Optional, Dict, Any
from models import User, Place, Activity, Interaction

try:
    from pymongo import MongoClient
    from pymongo.errors import ConnectionFailure, ConfigurationError
    MONGODB_AVAILABLE = True
except ImportError:
    MONGODB_AVAILABLE = False


class Database:
    """Database interface supporting MongoDB only."""
    
    def __init__(self, db_path: str = None):
        """Initialize database with path to JSON file only."""
        if db_path is None:
            # Default to data/new_db.json relative to this file
            script_dir = os.path.dirname(os.path.abspath(__file__))
            db_path = os.path.join(script_dir, "data", "new_db.json")
        self.db_path = db_path
        self._ensure_data_dir()
        self._load_db()
    
    def _init_mongodb(self):
        """Initialize MongoDB connection if available."""
        if not MONGODB_AVAILABLE:
            return
        
        mongodb_uri = os.getenv("MONGODB_URI")
        if not mongodb_uri:
            return
        
        try:
            self.mongo_client = MongoClient(mongodb_uri, serverSelectionTimeoutMS=5000)
            # Test connection
            self.mongo_client.admin.command('ping')
            # Extract database name from URI or use default
            # MongoDB URI format: mongodb://[user:pass@]host[:port]/[database][?options]
            try:
                from urllib.parse import urlparse
                parsed = urlparse(mongodb_uri)
                db_name = parsed.path[1:] if parsed.path else 'trippy'  # Remove leading '/'
                if not db_name or '?' in db_name:
                    db_name = db_name.split('?')[0] if db_name else 'trippy'
                if not db_name:
                    db_name = 'trippy'
            except Exception:
                db_name = 'trippy'
            self.mongo_db = self.mongo_client[db_name]
        except (ConnectionFailure, ConfigurationError, Exception):
            # MongoDB not available, continue with JSON only
            self.mongo_client = None
            self.mongo_db = None
    
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
    
    def _get_places_from_mongodb(self, destination: str) -> List[Place]:
        """Get places from MongoDB by destination."""
        if self.mongo_db is None:
            return []
        
        try:
            places_collection = self.mongo_db.places
            cursor = places_collection.find({"location": {"$regex": f"^{destination}$", "$options": "i"}})
            places = []
            for doc in cursor:
                # Convert MongoDB document to Place model
                doc_dict = {k: v for k, v in doc.items() if k != "_id"}
                places.append(Place(**doc_dict))
            return places
        except Exception:
            return []
    
    def _get_activities_from_mongodb(self, destination: str) -> List[Activity]:
        """Get activities from MongoDB by destination."""
        if self.mongo_db is None:
            return []
        
        try:
            # First get place IDs for this destination
            places = self._get_places_from_mongodb(destination)
            place_ids = {place.id for place in places}
            
            if not place_ids:
                return []
            
            activities_collection = self.mongo_db.activities
            cursor = activities_collection.find({"place_id": {"$in": list(place_ids)}})
            activities = []
            for doc in cursor:
                # Convert MongoDB document to Activity model
                doc_dict = {k: v for k, v in doc.items() if k != "_id"}
                activities.append(Activity(**doc_dict))
            return activities
        except Exception:
            return []
    
    def _save_places_to_mongodb(self, places: List[Place]):
        """Save places to MongoDB."""
        if self.mongo_db is None:
            return
        
        try:
            places_collection = self.mongo_db.places
            for place in places:
                place_dict = {
                    "id": place.id,
                    "name": place.name,
                    "location": place.location,
                    "category": place.category,
                    "features": place.features,
                    "description": place.description
                }
                # Upsert: update if exists, insert if not
                places_collection.update_one(
                    {"id": place.id},
                    {"$set": place_dict},
                    upsert=True
                )
        except Exception:
            pass  # Fail silently
    
    def _save_activities_to_mongodb(self, activities: List[Activity]):
        """Save activities to MongoDB."""
        if self.mongo_db is None:
            return
        
        try:
            activities_collection = self.mongo_db.activities
            for activity in activities:
                activity_dict = {
                    "id": activity.id,
                    "name": activity.name,
                    "place_id": activity.place_id,
                    "category": activity.category,
                    "features": activity.features,
                    "description": activity.description
                }
                # Upsert: update if exists, insert if not
                activities_collection.update_one(
                    {"id": activity.id},
                    {"$set": activity_dict},
                    upsert=True
                )
        except Exception:
            pass  # Fail silently
    
    def get_places_by_destination(self, destination: str) -> List[Place]:
        """Get all places in a destination from JSON only."""
        return [
            Place(**place_data)
            for place_data in self.db["places"]
            if place_data.get("location", "").lower() == destination.lower()
        ]
    
    def get_activities_by_destination(self, destination: str) -> List[Activity]:
        """Get all activities in places within a destination from JSON only."""
        places = self.get_places_by_destination(destination)
        place_ids = {place.id for place in places}
        
        if not place_ids:
            return []
        
        return [
            Activity(**activity_data)
            for activity_data in self.db["activities"]
            if activity_data.get("place_id") in place_ids
        ]
    
    def save_places(self, places: List[Place]):
        """Save places to JSON file only."""
        for place in places:
            place_dict = {
                "id": place.id,
                "name": place.name,
                "location": place.location,
                "category": place.category,
                "features": place.features,
                "description": place.description
            }
            
            # Check if place already exists in JSON
            existing_index = None
            for i, existing_place in enumerate(self.db["places"]):
                if existing_place["id"] == place.id:
                    existing_index = i
                    break
            
            if existing_index is not None:
                self.db["places"][existing_index] = place_dict
            else:
                self.db["places"].append(place_dict)
        
        self._save_db()
        print(f"Saved {len(places)} places to new_db.json")
    
    def save_activities(self, activities: List[Activity]):
        """Save activities to JSON file only."""
        for activity in activities:
            activity_dict = {
                "id": activity.id,
                "name": activity.name,
                "place_id": activity.place_id,
                "category": activity.category,
                "features": activity.features,
                "description": activity.description
            }
            
            # Check if activity already exists in JSON
            existing_index = None
            for i, existing_activity in enumerate(self.db["activities"]):
                if existing_activity["id"] == activity.id:
                    existing_index = i
                    break
            
            if existing_index is not None:
                self.db["activities"][existing_index] = activity_dict
            else:
                self.db["activities"].append(activity_dict)
        
        self._save_db()
        print(f"Saved {len(activities)} activities to new_db.json")
    
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

