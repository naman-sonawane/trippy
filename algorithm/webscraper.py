"""Web scraper for activities using RapidAPI with Gemini parsing."""
import re
import time
import random
import os
import json
from typing import List, Dict, Any, Optional, Tuple
import requests
from models import Place, Activity

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False


class RapidAPIScraper:
    """Scraper for activities using RapidAPI (Foursquare Places API)."""
    
    def __init__(self, api_key: str = None):
        """Initialize scraper with RapidAPI key."""
        self.api_key = api_key or os.getenv("RAPIDAPI_KEY", "4e260aebc6mshdb19f055d84393fp172533jsn4d079431bff5")
        self.base_url = "https://foursquare-com.p.rapidapi.com/v3/places/search"
        self.headers = {
            "X-RapidAPI-Key": self.api_key,
            "X-RapidAPI-Host": "foursquare-com.p.rapidapi.com",
            "Accept": "application/json"
        }
        
        # Initialize Gemini
        if GEMINI_AVAILABLE:
            gemini_key = os.getenv("GEMINI_API_KEY")
            if gemini_key:
                genai.configure(api_key=gemini_key)
                self.model = genai.GenerativeModel('gemini-1.5-pro')
            else:
                self.model = None
        else:
            self.model = None
    
    def _normalize_location(self, location: str) -> str:
        """Normalize location name for consistent lookups."""
        return location.strip().title()
    
    def _parse_with_gemini(self, scraped_items: List[Dict[str, Any]], location: str) -> List[Dict[str, Any]]:
        """Parse scraped data using Gemini to extract structured information."""
        if not self.model:
            # Fallback: use basic parsing if Gemini not available
            return self._parse_basic(scraped_items, location)
        
        try:
            # Prepare prompt for Gemini
            prompt = f"""You are a travel activity data parser. Parse the following scraped activity data from {location} into a structured JSON format.

For each activity, extract and structure:
- name: The activity name
- description: A concise description (max 200 chars)
- category: One of: Tour, Museum, Park, Entertainment, Restaurant, Landmark, Temple, Wellness, Workshop, Recreation, Attraction
- tags: List of 3-5 relevant tags (e.g., ["scenic", "cultural", "outdoor"])
- energy_level: One of: "low", "medium", "high"
- age_suitability_profile: One of: "cultural", "family-friendly", "nightlife", "educational"
- image_url: The image URL if provided

Return ONLY a valid JSON array of objects, no markdown, no explanation.

Scraped data:
{self._format_scraped_data(scraped_items)}

Return JSON array format:
[
  {{
    "name": "...",
    "description": "...",
    "category": "...",
    "tags": ["...", "..."],
    "energy_level": "...",
    "age_suitability_profile": "...",
    "image_url": "..."
  }},
  ...
]
"""
            
            # Call Gemini
            response = self.model.generate_content(prompt)
            text = response.text.strip()
            
            # Extract JSON from response
            json_match = re.search(r'\[[\s\S]*\]', text)
            if json_match:
                json_text = json_match.group(0)
            else:
                json_text = text
            
            # Parse JSON
            parsed_data = json.loads(json_text)
            
            # Validate and format
            structured_items = []
            for item in parsed_data:
                structured_item = {
                    "name": item.get("name", ""),
                    "description": item.get("description", ""),
                    "category": item.get("category", "Attraction"),
                    "tags": item.get("tags", []),
                    "energy_level": item.get("energy_level", "medium"),
                    "age_suitability_profile": item.get("age_suitability_profile", "cultural"),
                    "image_url": item.get("image_url", ""),
                    "location": location
                }
                structured_items.append(structured_item)
            
            return structured_items
            
        except Exception as e:
            print(f"Error parsing with Gemini: {e}")
            # Fallback to basic parsing
            return self._parse_basic(scraped_items, location)
    
    def _format_scraped_data(self, scraped_items: List[Dict[str, Any]]) -> str:
        """Format scraped data for Gemini prompt."""
        formatted = []
        for i, item in enumerate(scraped_items[:50], 1):
            formatted.append(f"Activity {i}:")
            formatted.append(f"  Name: {item.get('name', 'N/A')}")
            formatted.append(f"  Description: {item.get('description', 'N/A')}")
            formatted.append(f"  Category: {item.get('category', 'N/A')}")
            formatted.append(f"  Image URL: {item.get('image_url', 'N/A')}")
            formatted.append("")
        return "\n".join(formatted)
    
    def _parse_basic(self, scraped_items: List[Dict[str, Any]], location: str) -> List[Dict[str, Any]]:
        """Basic parsing fallback without Gemini."""
        structured_items = []
        for item in scraped_items:
            name = item.get("name", f"Activity in {location}")
            description = item.get("description", "")
            category = item.get("category", "")
            
            structured_item = {
                "name": name,
                "description": description or f"Popular activity in {location}",
                "category": self._infer_category(name, description) if not category else category,
                "tags": self._infer_tags(name, description, category),
                "energy_level": self._infer_energy_level(name, description, category),
                "age_suitability_profile": self._infer_age_suitability(name, description, category, "medium"),
                "image_url": item.get("image_url", ""),
                "location": location
            }
            structured_items.append(structured_item)
        
        return structured_items
    
    def _infer_category(self, name: str, description: str) -> str:
        """Infer category from name and description."""
        text = (name + " " + (description or "")).lower()
        
        category_keywords = {
            "Tour": ["tour", "walking tour", "guided tour", "cruise", "sightseeing"],
            "Museum": ["museum", "gallery", "art", "exhibition", "collection"],
            "Park": ["park", "garden", "nature reserve", "botanical"],
            "Entertainment": ["show", "theater", "concert", "entertainment", "performance", "karaoke", "nightlife"],
            "Restaurant": ["restaurant", "dining", "cafe", "bistro", "food"],
            "Landmark": ["tower", "bridge", "monument", "statue", "landmark", "iconic"],
            "Temple": ["temple", "church", "cathedral", "mosque", "shrine", "religious"],
            "Wellness": ["spa", "wellness", "meditation", "yoga", "relaxation"],
            "Workshop": ["workshop", "class", "lesson", "course"],
            "Recreation": ["recreation", "activity", "adventure", "sport"],
        }
        
        for category, keywords in category_keywords.items():
            if any(keyword in text for keyword in keywords):
                return category
        
        return "Attraction"
    
    def _infer_energy_level(self, name: str, description: str, category: str) -> str:
        """Infer energy level from activity data."""
        text = (name + " " + (description or "")).lower()
        
        high_energy = ["nightlife", "party", "dance", "adventure", "sport", "hiking", "biking", 
                      "climbing", "running", "active", "intense", "extreme", "karaoke", "bar crawl"]
        low_energy = ["museum", "gallery", "spa", "relaxation", "meditation", "yoga", "sitting", 
                     "cruise", "show", "theater", "restaurant", "cafe", "peaceful", "calm"]
        
        if any(keyword in text for keyword in high_energy):
            return "high"
        elif any(keyword in text for keyword in low_energy):
            return "low"
        else:
            return "medium"
    
    def _infer_age_suitability(self, name: str, description: str, category: str, energy_level: str) -> str:
        """Infer age suitability profile."""
        text = (name + " " + (description or "")).lower()
        
        nightlife_keywords = ["nightlife", "bar", "club", "party", "karaoke", "pub", "night", "drinks"]
        if any(keyword in text for keyword in nightlife_keywords) or energy_level == "high":
            return "nightlife"
        
        family_keywords = ["family", "kids", "children", "playground", "picnic"]
        if any(keyword in text for keyword in family_keywords):
            return "family-friendly"
        
        educational_keywords = ["workshop", "class", "lesson", "course", "learn", "educational"]
        if any(keyword in text for keyword in educational_keywords):
            return "educational"
        
        return "cultural"
    
    def _infer_tags(self, name: str, description: str, category: str) -> List[str]:
        """Infer tags from activity data."""
        text = (name + " " + (description or "")).lower()
        tags = []
        
        tag_keywords = {
            "iconic": ["iconic", "famous", "landmark", "must-see"],
            "scenic": ["scenic", "view", "panoramic", "vista", "beautiful"],
            "outdoor": ["outdoor", "outside", "open air", "nature"],
            "indoor": ["indoor", "inside", "museum", "gallery"],
            "architecture": ["architecture", "architectural", "building", "structure"],
            "art": ["art", "artistic", "gallery", "exhibition"],
            "history": ["history", "historical", "ancient", "heritage"],
            "culture": ["culture", "cultural", "traditional", "local"],
            "relaxing": ["relaxing", "peaceful", "calm", "spa"],
            "educational": ["educational", "learn", "museum", "tour"],
            "entertainment": ["entertainment", "show", "performance", "fun"],
            "food": ["food", "dining", "restaurant", "cafe", "cuisine"],
            "walking": ["walking", "walk", "stroll"],
            "views": ["view", "views", "panoramic", "vista"],
            "spiritual": ["spiritual", "temple", "church", "religious"],
        }
        
        for tag, keywords in tag_keywords.items():
            if any(keyword in text for keyword in keywords):
                tags.append(tag)
        
        if len(tags) < 2:
            tags.extend(["attraction", "tourist"])
        
        return tags[:5]
    
    def _geocode_location(self, location: str) -> Optional[Tuple[float, float]]:
        """Geocode location to get coordinates using RapidAPI geocoding."""
        try:
            # Use a simple geocoding approach - you might want to use a geocoding API
            # For now, return None and let the search API handle location by name
            return None
        except Exception:
            return None
    
    def scrape_activities(self, location: str, max_activities: int = 50) -> List[Dict[str, Any]]:
        """Scrape activities using RapidAPI (Foursquare Places API)."""
        location = self._normalize_location(location)
        scraped_items = []
        
        try:
            # Search for places using Foursquare Places API via RapidAPI
            url = self.base_url
            
            params = {
                "query": location,
                "limit": min(max_activities, 50),  # API typically limits to 50
                "near": location,
                "fields": "fsq_id,name,description,categories,location,photos,rating"
            }
            
            response = requests.get(url, headers=self.headers, params=params, timeout=15)
            response.raise_for_status()
            data = response.json()
            
            # Parse Foursquare API response (adjust structure based on actual API response)
            results = data.get("results", [])
            if not results and isinstance(data, list):
                results = data
            
            for result in results[:max_activities]:
                try:
                    name = result.get("name", "")
                    if not name:
                        continue
                    
                    # Get description
                    description = result.get("description", "")
                    if not description:
                        # Try to get from categories
                        categories = result.get("categories", [])
                        if categories:
                            description = categories[0].get("name", "")
                    
                    # Get category
                    category_name = ""
                    categories = result.get("categories", [])
                    if categories:
                        category_name = categories[0].get("name", "")
                    
                    # Get image URL
                    image_url = ""
                    photos = result.get("photos", [])
                    if photos and len(photos) > 0:
                        photo = photos[0]
                        prefix = photo.get("prefix", "")
                        suffix = photo.get("suffix", "")
                        if prefix and suffix:
                            image_url = f"{prefix}original{suffix}"
                    
                    scraped_items.append({
                        "name": name,
                        "description": description,
                        "category": category_name,
                        "image_url": image_url,
                        "location": location
                    })
                    
                except Exception as e:
                    print(f"Error parsing result: {e}")
                    continue
            
            # If we got some items, parse with Gemini
            if scraped_items:
                structured_items = self._parse_with_gemini(scraped_items, location)
                return structured_items[:max_activities]
            
            return []
            
        except Exception as e:
            print(f"Error scraping activities from RapidAPI: {e}")
            # If Foursquare doesn't work, try alternative approach
            return self._try_alternative_api(location, max_activities)
    
    def _try_alternative_api(self, location: str, max_activities: int) -> List[Dict[str, Any]]:
        """Try alternative RapidAPI endpoint if primary fails."""
        try:
            # Try using Expedia Rapid Activities API or another service
            # For now, return empty list - implement alternative if needed
            return []
        except Exception:
            return []


def webscrape_location(database, location: str, max_activities: int = 50) -> Tuple[List[Place], List[Activity]]:
    """
    Webscrape location: Check MongoDB -> Scrape via RapidAPI -> Parse with Gemini -> Save to MongoDB.
    
    Args:
        database: Database instance
        location: Country/city name
        max_activities: Maximum number of activities to scrape
    
    Returns:
        Tuple of (places, activities) lists
    """
    location = location.strip().title()
    
    # Step 1: Check MongoDB only (no JSON fallback)
    places = database._get_places_from_mongodb(location)
    activities = database._get_activities_from_mongodb(location)
    
    if places and activities:
        return places, activities
    
    # Step 2: Scrape if no data in MongoDB
    scraper = RapidAPIScraper()
    scraped_data = scraper.scrape_activities(location, max_activities)
    
    if not scraped_data:
        return [], []
    
    # Step 3: Convert scraped data to Place and Activity models
    places_dict = {}  # name -> Place
    activities_list = []
    
    # Generate unique IDs
    place_counter = 1
    activity_counter = 1
    
    for item in scraped_data:
        # Create or get place
        place_name = item.get("name", f"Place in {location}")
        
        # Try to find existing place by name
        place_id = None
        for existing_place in places_dict.values():
            if existing_place.name == place_name:
                place_id = existing_place.id
                break
        
        if not place_id:
            place_id = f"place_{location.lower().replace(' ', '_')}_{place_counter}"
            place_counter += 1
            
            # Create place
            place = Place(
                id=place_id,
                name=place_name,
                location=location,
                category=item.get("category", "Attraction"),
                features={
                    "tags": item.get("tags", []),
                    "price_range": "medium",
                    "energy_level": item.get("energy_level", "medium"),
                    "age_suitability_profile": item.get("age_suitability_profile", "cultural"),
                    "image_url": item.get("image_url", "")
                },
                description=item.get("description", "")
            )
            places_dict[place_id] = place
        
        # Create activity
        activity_id = f"activity_{location.lower().replace(' ', '_')}_{activity_counter}"
        activity_counter += 1
        
        activity = Activity(
            id=activity_id,
            name=item.get("name", f"Activity in {location}"),
            place_id=place_id,
            category=item.get("category", "Attraction"),
            features={
                "tags": item.get("tags", []),
                "energy_level": item.get("energy_level", "medium"),
                "age_suitability_profile": item.get("age_suitability_profile", "cultural"),
                "image_url": item.get("image_url", "")
            },
            description=item.get("description", "")
        )
        activities_list.append(activity)
    
    places_list = list(places_dict.values())
    
    # Step 4: Save to MongoDB only (no JSON)
    if places_list:
        database.save_places(places_list)
    if activities_list:
        database.save_activities(activities_list)
    
    return places_list, activities_list
