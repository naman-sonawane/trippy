"""Activity data generator using Gemini AI."""
import os
import json
import pickle
import time
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import requests
from bs4 import BeautifulSoup
from models import Place, Activity


class ActivityGenerator:
    """Generate activities using Gemini AI through Hack Club endpoint."""
    
    def __init__(self):
        """Initialize generator with Gemini."""
        self.cache_dir = Path("cache")
        self.cache_dir.mkdir(exist_ok=True)
        self.cache_ttl = 7 * 24 * 60 * 60  # 7 days in seconds
        
        # Use Hack Club AI endpoint
        self.api_url = "https://ai.hackclub.com/proxy/v1/chat/completions"
        self.api_key = "sk-hc-v1-0980dcafe29d477fa757a2c1c7f0e2200ccad811c41549f592e8219f20bc7c32"
        
        if not self.api_key:
            print("Warning: AI_API_KEY not set. Using fallback data generation.")
            self.model = None
        else:
            self.model = True  # Flag to indicate API is available
    
    def _normalize_location(self, location: str) -> str:
        """Normalize location name for consistent lookups."""
        return location.strip().title()
    
    def _get_google_image(self, query: str) -> str:
        """Get first image URL from Google Images search."""
        try:
            import re
            import urllib.parse
            
            search_url = f"https://www.google.com/search?q={urllib.parse.quote(query)}&tbm=isch"
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
            }
            response = requests.get(search_url, headers=headers, timeout=15)
            response.raise_for_status()
            
            html_content = response.text
            
            # method 1: extract from AF_initDataCallback (google's data structure)
            pattern = r'AF_initDataCallback\([^)]*key:\'ds:1\'[^)]*data:([^,}]+)'
            matches = re.findall(pattern, html_content)
            
            if matches:
                try:
                    import json
                    # try to parse json data
                    for match in matches:
                        try:
                            # clean up the match
                            data_str = match.strip()
                            if data_str.startswith('['):
                                data = json.loads(data_str)
                                # navigate through google's nested structure
                                if isinstance(data, list) and len(data) > 0:
                                    images = data[0] if isinstance(data[0], list) else data
                                    for item in images:
                                        if isinstance(item, list) and len(item) > 1:
                                            img_url = item[1] if isinstance(item[1], str) else (item[1][0] if isinstance(item[1], list) and len(item[1]) > 0 else None)
                                            if img_url and img_url.startswith('http') and not any(d in img_url for d in ['google.com', 'gstatic.com']):
                                                return img_url
                        except:
                            continue
                except:
                    pass
            
            # method 2: extract from oimg tag data
            oimg_pattern = r'"ou":"([^"]+)"'
            oimg_matches = re.findall(oimg_pattern, html_content)
            for url in oimg_matches:
                if url.startswith('http') and not any(d in url for d in ['google.com', 'gstatic.com', 'googleusercontent.com']):
                    if any(ext in url.lower() for ext in ['.jpg', '.jpeg', '.png', '.webp']) or 'image' in url.lower():
                        return url
            
            # method 3: extract from imgurl pattern
            imgurl_pattern = r'"imgurl":"([^"]+)"'
            imgurl_matches = re.findall(imgurl_pattern, html_content)
            for url in imgurl_matches:
                if url.startswith('http') and not any(d in url for d in ['google.com', 'gstatic.com', 'googleusercontent.com']):
                    return url
            
            # method 4: use beautifulsoup as fallback
            soup = BeautifulSoup(html_content, 'html.parser')
            img_tags = soup.find_all('img')
            for img in img_tags:
                src = img.get('src') or img.get('data-src') or img.get('data-lazy-src')
                if src and src.startswith('http') and not any(d in src for d in ['google.com', 'gstatic.com']):
                    if any(ext in src.lower() for ext in ['.jpg', '.jpeg', '.png', '.webp']):
                        return src
            
            return ""
        except Exception as e:
            print(f"Error scraping Google image for {query}: {e}")
            return ""
    
    def _get_duckduckgo_image(self, query: str) -> str:
        """Get image URL from DuckDuckGo image search (reliable, no API key needed)."""
        try:
            import urllib.parse
            search_url = f"https://duckduckgo.com/?q={urllib.parse.quote(query)}&iax=images&ia=images"
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
            response = requests.get(search_url, headers=headers, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            img_tags = soup.find_all('img', {'data-src': True})
            
            for img in img_tags[:5]:  # check first 5 images
                src = img.get('data-src') or img.get('src')
                if src and src.startswith('http') and not any(d in src for d in ['duckduckgo.com']):
                    if any(ext in src.lower() for ext in ['.jpg', '.jpeg', '.png', '.webp', '.gif']):
                        return src
            
            # also try finding images in script tags
            scripts = soup.find_all('script')
            import re
            for script in scripts:
                if script.string:
                    # look for image urls
                    urls = re.findall(r'https?://[^\s"\'<>]+\.(?:jpg|jpeg|png|webp)', script.string, re.IGNORECASE)
                    for url in urls:
                        if not any(d in url for d in ['duckduckgo.com', 'google.com']):
                            return url
            
            return ""
        except Exception as e:
            print(f"Error scraping DuckDuckGo image for {query}: {e}")
            return ""
    
    def _get_pexels_image(self, query: str) -> str:
        """Get image URL from Pexels API using official API."""
        try:
            api_key = os.getenv("PEXELS_API_KEY", "")
            if not api_key:
                return ""
            
            import urllib.parse
            encoded_query = urllib.parse.quote(query)
            search_url = f"https://api.pexels.com/v1/search?query={encoded_query}&per_page=1"
            headers = {"Authorization": api_key}
            response = requests.get(search_url, headers=headers, timeout=10)
            
            if response.ok:
                data = response.json()
                if data.get('photos') and len(data['photos']) > 0:
                    photo = data['photos'][0]
                    # use large size for good quality
                    return photo.get('src', {}).get('large', photo.get('src', {}).get('original', ''))
            return ""
        except Exception as e:
            print(f"Error fetching Pexels image for {query}: {e}")
            return ""
    
    def _get_unsplash_image(self, query: str) -> str:
        """Get image URL from Unsplash API (fallback)."""
        try:
            # return empty instead of broken unsplash source url
            return ""
        except Exception:
            return ""
    
    def _call_gemini(self, prompt: str) -> str:
        """Call Gemini API through Hack Club endpoint."""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": "google/gemini-3-pro-preview",
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.7
        }
        
        response = requests.post(self.api_url, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        return data["choices"][0]["message"]["content"]
    
    def _generate_with_gemini(self, location: str, num_activities: int = 10) -> List[Dict[str, Any]]:
        """Generate activities using Gemini AI."""
        if not self.model:
            return self._generate_fallback(location, num_activities)
        
        try:
            prompt = f"""Generate {num_activities} real, popular tourist activities and attractions in {location}.

For each activity, provide:
- name: Actual name of the place/activity (e.g., "Eiffel Tower", "Louvre Museum")
- description: Engaging 1-2 sentence description (max 150 chars)
- category: One of: Tour, Museum, Park, Entertainment, Restaurant, Landmark, Temple, Wellness, Workshop, Recreation, Attraction
- tags: 3-5 relevant descriptive tags (e.g., ["iconic", "architecture", "scenic"])
- energy_level: "low", "medium", or "high" based on physical activity required
- age_suitability_profile: "cultural", "family-friendly", "nightlife", or "educational"
- budget: estimated cost in USD (e.g., "free", "$10", "$25", "$50", "$100+")
- search_term: A short search term for finding images (e.g., "eiffel tower paris")

Include a mix of:
- Famous landmarks and monuments
- Museums and cultural sites
- Parks and outdoor spaces
- Restaurants and cafes
- Entertainment venues
- Tours and experiences

Return ONLY valid JSON array, no markdown formatting:
[
  {{
    "name": "...",
    "description": "...",
    "category": "...",
    "tags": ["...", "..."],
    "energy_level": "...",
    "age_suitability_profile": "...",
    "budget": "...",
    "search_term": "..."
  }}
]
"""
            
            response_text = self._call_gemini(prompt)
            
            # Clean up markdown if present
            text = response_text.strip()
            text = text.replace("```json", "").replace("```", "").strip()
            
            # Extract JSON
            start = text.find("[")
            end = text.rfind("]") + 1
            if start != -1 and end > start:
                json_text = text[start:end]
            else:
                json_text = text
            
            parsed_data = json.loads(json_text)
            
            # Add images and format
            structured_items = []
            for item in parsed_data:
                search_term = item.get("search_term", f"{item.get('name', '')} {location}").strip()
                # try pexels first if api key is set (most reliable)
                image_url = self._get_pexels_image(search_term)
                if not image_url:
                    image_url = self._get_google_image(search_term)
                if not image_url:
                    image_url = self._get_duckduckgo_image(search_term)
                if not image_url:
                    image_url = self._get_unsplash_image(search_term)
                structured_item = {
                    "name": item.get("name", ""),
                    "description": item.get("description", ""),
                    "category": item.get("category", "Attraction"),
                    "tags": item.get("tags", []),
                    "energy_level": item.get("energy_level", "medium"),
                    "age_suitability_profile": item.get("age_suitability_profile", "cultural"),
                    "budget": item.get("budget", "$25"),
                    "image_url": image_url,
                    "location": location
                }
                structured_items.append(structured_item)
            
            print(f"Generated {len(structured_items)} activities for {location} using Gemini")
            return structured_items
            
        except Exception as e:
            print(f"Error generating with Gemini: {e}")
            return self._generate_fallback(location, num_activities)
    
    def _generate_fallback(self, location: str, num_activities: int) -> List[Dict[str, Any]]:
        """Generate fallback activities when Gemini is unavailable."""
        print(f"Using fallback data generation for {location}")
        
        templates = [
            {"name": f"Historic {location} Walking Tour", "category": "Tour", "tags": ["walking", "history", "cultural"], "energy": "medium", "age": "cultural", "budget": "$25", "search": f"historic {location}"},
            {"name": f"{location} City Museum", "category": "Museum", "tags": ["indoor", "art", "history"], "energy": "low", "age": "educational", "budget": "$15", "search": f"museum {location}"},
            {"name": f"Central {location} Park", "category": "Park", "tags": ["outdoor", "relaxing", "nature"], "energy": "low", "age": "family-friendly", "budget": "free", "search": f"park {location}"},
            {"name": f"{location} Main Cathedral", "category": "Temple", "tags": ["architecture", "spiritual", "historic"], "energy": "low", "age": "cultural", "budget": "free", "search": f"cathedral {location}"},
            {"name": f"Local {location} Market", "category": "Attraction", "tags": ["shopping", "food", "local"], "energy": "medium", "age": "cultural", "budget": "$20", "search": f"market {location}"},
            {"name": f"Traditional {location} Restaurant", "category": "Restaurant", "tags": ["dining", "authentic", "food"], "energy": "low", "age": "cultural", "budget": "$40", "search": f"restaurant {location}"},
            {"name": f"{location} Art Gallery", "category": "Museum", "tags": ["art", "indoor", "cultural"], "energy": "low", "age": "educational", "budget": "$12", "search": f"art gallery {location}"},
            {"name": f"{location} Riverfront Cruise", "category": "Tour", "tags": ["scenic", "relaxing", "water"], "energy": "low", "age": "family-friendly", "budget": "$35", "search": f"river cruise {location}"},
            {"name": f"{location} Night Entertainment", "category": "Entertainment", "tags": ["nightlife", "music", "social"], "energy": "high", "age": "nightlife", "budget": "$50", "search": f"nightlife {location}"},
            {"name": f"{location} Viewpoint Tower", "category": "Landmark", "tags": ["scenic", "views", "iconic"], "energy": "medium", "age": "cultural", "budget": "$18", "search": f"viewpoint {location}"},
        ]
        
        structured_items = []
        for i, template in enumerate(templates[:num_activities]):
            structured_items.append({
                "name": template["name"],
                "description": f"Popular {template['category'].lower()} attraction in {location}",
                "category": template["category"],
                "tags": template["tags"],
                "energy_level": template["energy"],
                "age_suitability_profile": template["age"],
                "budget": template["budget"],
                "image_url": self._get_unsplash_image(template["search"]),
                "location": location
            })
        
        return structured_items
    
    def _get_cache_path(self, location: str) -> Path:
        """Get cache file path for a location."""
        safe_location = location.lower().replace(" ", "_").replace("/", "_")
        return self.cache_dir / f"{safe_location}_cache.pkl"
    
    def _load_from_cache(self, location: str) -> Optional[List[Dict[str, Any]]]:
        """Load cached data if available and not expired."""
        cache_path = self._get_cache_path(location)
        
        if not cache_path.exists():
            return None
        
        try:
            # Check if cache is expired
            cache_age = time.time() - cache_path.stat().st_mtime
            if cache_age > self.cache_ttl:
                print(f"Cache expired for {location} (age: {cache_age / 3600:.1f} hours)")
                cache_path.unlink()
                return None
            
            # Load cached data
            with open(cache_path, 'rb') as f:
                cached_data = pickle.load(f)
            
            print(f"Loaded {len(cached_data)} items from cache for {location}")
            print(f"Cache data: {json.dumps(cached_data, indent=2)}")
            return cached_data
        except Exception as e:
            print(f"Error loading cache: {e}")
            return None
    
    def _save_to_cache(self, location: str, data: List[Dict[str, Any]]):
        """Save scraped data to cache."""
        cache_path = self._get_cache_path(location)
        
        try:
            with open(cache_path, 'wb') as f:
                pickle.dump(data, f)
            print(f"Saved {len(data)} items to cache for {location}")
        except Exception as e:
            print(f"Error saving cache: {e}")
    
    def generate_activities(self, location: str, max_activities: int = 10) -> List[Dict[str, Any]]:
        """Generate activities using Gemini AI."""
        location = self._normalize_location(location)
        
        # Try to load from cache first
        cached_data = self._load_from_cache(location)
        if cached_data:
            return cached_data[:max_activities]
        
        # Generate with Gemini
        structured_items = self._generate_with_gemini(location, max_activities)
        
        # Save to cache
        if structured_items:
            self._save_to_cache(location, structured_items)
        
        return structured_items[:max_activities]
    


def webscrape_location(database, location: str, max_activities: int = 10) -> Tuple[List[Place], List[Activity]]:
    """
    Generate location data: Check MongoDB -> Generate with Gemini -> Save to MongoDB.
    
    Args:
        database: Database instance
        location: Country/city name
        max_activities: Maximum number of activities to generate
    
    Returns:
        Tuple of (places, activities) lists
    """
    location = location.strip().title()
    
    # Step 1: Check if data already exists in new_db.json
    places = database.get_places_by_destination(location)
    activities = database.get_activities_by_destination(location)
    
    if places and activities:
        print(f"Found {len(places)} places and {len(activities)} activities in new_db.json for {location}")
        return places, activities
    
    print(f"No data in new_db.json for {location}, generating new data...")
    
    # Step 2: Generate with Gemini if no data in new_db.json
    generator = ActivityGenerator()
    generated_data = generator.generate_activities(location, max_activities)
    
    if not generated_data:
        return [], []
    
    # Step 3: Convert generated data to Place and Activity models
    places_dict = {}  # name -> Place
    activities_list = []
    
    # Generate unique IDs
    place_counter = 1
    activity_counter = 1
    
    for item in generated_data:
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
                    "budget": item.get("budget", "$25"),
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
                "budget": item.get("budget", "$25"),
                "energy_level": item.get("energy_level", "medium"),
                "age_suitability_profile": item.get("age_suitability_profile", "cultural"),
                "image_url": item.get("image_url", "")
            },
            description=item.get("description", "")
        )
        activities_list.append(activity)
    
    places_list = list(places_dict.values())
    
    # Step 4: Save to new_db.json
    print(f"Saving {len(places_list)} places and {len(activities_list)} activities to new_db.json...")
    if places_list:
        database.save_places(places_list)
    if activities_list:
        database.save_activities(activities_list)
    print(f"Data saved successfully to new_db.json!")
    
    return places_list, activities_list
