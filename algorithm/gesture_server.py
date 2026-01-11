"""Gesture-controlled recommendation swiper using MediaPipe and Gemini AI."""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import cv2
import requests
import time
import json
from typing import Optional, Dict, List
from database import Database
from models import User
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'danielz_test_files'))
from finger_track import VisualTracking

GEMINI_API_KEY = os.getenv('AI_API_KEY', '')
GEMINI_API_URL = 'https://ai.hackclub.com/proxy/v1/chat/completions'

db = Database()

class GestureRecommendationSwiper:
    def __init__(self, user_id: str, destination: str):
        self.user_id = user_id
        self.destination = destination
        self.tracker = VisualTracking(queue_len=12)
        self.recommendations = []
        self.current_index = 0
        self.liked_count = 0
        self.disliked_count = 0
        
        print(f"\n{'='*60}")
        print(f"Gesture Recommendation Swiper")
        print(f"{'='*60}")
        print(f"User ID: {user_id}")
        print(f"Destination: {destination}")
        print(f"{'='*60}\n")
        
        self._load_recommendations()
        
    def _get_real_places_with_gemini(self) -> List[Dict]:
        """Use Gemini AI to fetch real places and activities for the destination."""
        print(f"Fetching real places for {self.destination} using Gemini AI...")
        
        prompt = f"""You are a travel expert. Provide 15 real, popular tourist attractions, restaurants, and activities in {self.destination}.

For each place, return JSON in this exact format:
{{
  "name": "exact place name",
  "category": "Landmark|Restaurant|Museum|Park|Beach|Shopping|Nightlife|Activity",
  "description": "brief 1-sentence description",
  "tags": ["tag1", "tag2", "tag3"],
  "price_range": "$|$$|$$$",
  "energy_level": "Low|Medium|High"
}}

Return ONLY a JSON array of 15 places. No other text."""

        try:
            response = requests.post(
                GEMINI_API_URL,
                headers={
                    'Authorization': f'Bearer {GEMINI_API_KEY}',
                    'Content-Type': 'application/json',
                },
                json={
                    'model': 'google/gemini-2.0-flash-exp:free',
                    'messages': [
                        {
                            'role': 'system',
                            'content': 'You are a travel data assistant. Return only valid JSON arrays.'
                        },
                        {
                            'role': 'user',
                            'content': prompt
                        }
                    ],
                    'temperature': 0.7,
                },
                timeout=30
            )
            
            if response.ok:
                data = response.json()
                content = data.get('choices', [{}])[0].get('message', {}).get('content', '[]')
                
                json_match = content
                if '```json' in content:
                    json_match = content.split('```json')[1].split('```')[0].strip()
                elif '```' in content:
                    json_match = content.split('```')[1].split('```')[0].strip()
                
                places = json.loads(json_match)
                print(f"✓ Fetched {len(places)} real places from Gemini")
                return places
            else:
                print(f"✗ Gemini API error: {response.status_code}")
                return []
                
        except Exception as e:
            print(f"✗ Error fetching places with Gemini: {e}")
            return []
    
    def _load_recommendations(self):
        """Load recommendations from database or Gemini fallback."""
        places = db.get_places_by_destination(self.destination)
        activities = db.get_activities_by_destination(self.destination)
        
        if places or activities:
            print(f"✓ Found {len(places)} places and {len(activities)} activities in database")
            
            for place in places:
                self.recommendations.append({
                    'id': place.id,
                    'name': place.name,
                    'category': place.category,
                    'description': place.description or '',
                    'location': place.location,
                    'type': 'place',
                    'features': place.features
                })
            
            for activity in activities:
                self.recommendations.append({
                    'id': activity.id,
                    'name': activity.name,
                    'category': activity.category,
                    'description': activity.description or '',
                    'type': 'activity',
                    'features': activity.features
                })
        else:
            print(f"No data in database for {self.destination}, using Gemini AI...")
            gemini_places = self._get_real_places_with_gemini()
            
            for idx, place_data in enumerate(gemini_places):
                self.recommendations.append({
                    'id': f'gemini_{self.destination}_{idx}',
                    'name': place_data.get('name', 'Unknown'),
                    'category': place_data.get('category', 'Attraction'),
                    'description': place_data.get('description', ''),
                    'location': self.destination,
                    'type': 'place',
                    'features': {
                        'tags': place_data.get('tags', []),
                        'price_range': place_data.get('price_range', '$$'),
                        'energy_level': place_data.get('energy_level', 'Medium')
                    }
                })
        
        print(f"\n{'='*60}")
        print(f"Loaded {len(self.recommendations)} recommendations")
        print(f"{'='*60}\n")
        
        if len(self.recommendations) == 0:
            print("✗ No recommendations found. Exiting.")
            self.tracker.close()
            sys.exit(1)
    
    def _handle_swipe(self, direction: str):
        """Handle swipe gesture and record interaction."""
        if self.current_index >= len(self.recommendations):
            return
        
        current = self.recommendations[self.current_index]
        action = 'like' if direction == 'right' else 'dislike'
        
        print(f"\n{'='*60}")
        print(f"{'❤️  LIKED' if action == 'like' else '✕  PASSED'}: {current['name']}")
        print(f"Category: {current['category']}")
        print(f"Progress: {self.current_index + 1}/{len(self.recommendations)}")
        print(f"{'='*60}\n")
        
        try:
            rating = 1 if action == 'like' else -1
            from models import Interaction
            from datetime import datetime
            
            interaction = Interaction(
                user_id=self.user_id,
                item_id=current['id'],
                item_type=current['type'],
                rating=rating,
                timestamp=datetime.now().isoformat()
            )
            
            db.add_interaction(interaction)
            
            if action == 'like':
                self.liked_count += 1
            else:
                self.disliked_count += 1
                
        except Exception as e:
            print(f"Error recording swipe: {e}")
        
        self.current_index += 1
    
    def _display_current_card(self, frame):
        """Overlay current recommendation info on frame."""
        if self.current_index >= len(self.recommendations):
            cv2.putText(frame, "All Done!", (50, 100), 
                       cv2.FONT_HERSHEY_SIMPLEX, 2, (0, 255, 0), 3)
            cv2.putText(frame, f"Liked: {self.liked_count}  Passed: {self.disliked_count}", 
                       (50, 150), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
            cv2.putText(frame, "Press 'q' to quit", (50, 200), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.8, (200, 200, 200), 2)
            return frame
        
        current = self.recommendations[self.current_index]
        h, w = frame.shape[:2]
        
        overlay = frame.copy()
        cv2.rectangle(overlay, (20, h - 250), (w - 20, h - 20), (0, 0, 0), -1)
        frame = cv2.addWeighted(frame, 0.7, overlay, 0.3, 0)
        
        y_offset = h - 230
        cv2.putText(frame, current['name'][:40], (30, y_offset), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
        
        y_offset += 35
        cv2.putText(frame, f"{current['category']}", (30, y_offset), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (150, 200, 255), 1)
        
        y_offset += 30
        desc = current['description'][:60]
        cv2.putText(frame, desc, (30, y_offset), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)
        
        y_offset += 35
        tags = current.get('features', {}).get('tags', [])[:3]
        tag_text = ' | '.join(tags) if tags else ''
        cv2.putText(frame, tag_text[:50], (30, y_offset), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (100, 255, 100), 1)
        
        progress_text = f"{self.current_index + 1}/{len(self.recommendations)}"
        cv2.putText(frame, progress_text, (w - 120, 40), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        
        cv2.putText(frame, f"Liked: {self.liked_count}", (30, 40), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        cv2.putText(frame, f"Passed: {self.disliked_count}", (30, 70), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
        
        cv2.putText(frame, "Swipe LEFT to pass", (30, h - 270), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (150, 150, 150), 1)
        cv2.putText(frame, "Swipe RIGHT to like", (w - 250, h - 270), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (150, 150, 150), 1)
        
        return frame
    
    def run(self):
        """Main gesture tracking loop."""
        print("\n{'='*60}")
        print("Starting gesture tracking...")
        print("Swipe LEFT to pass, RIGHT to like")
        print("Press 'q' to quit")
        print(f"{'='*60}\n")
        
        try:
            while True:
                frame, swipe = self.tracker.read_store_frame()
                
                if frame is None:
                    print("✗ Failed to read frame")
                    break
                
                if swipe == 1:
                    self._handle_swipe('right')
                elif swipe == 2:
                    self._handle_swipe('left')
                
                frame = self._display_current_card(frame)
                
                cv2.imshow("Gesture Swiper - Trippy", frame)
                
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
                
                if self.current_index >= len(self.recommendations):
                    time.sleep(3)
                    break
                    
        except KeyboardInterrupt:
            print("\n\nInterrupted by user")
        finally:
            print(f"\n{'='*60}")
            print(f"Session Summary")
            print(f"{'='*60}")
            print(f"Total recommendations: {len(self.recommendations)}")
            print(f"Liked: {self.liked_count}")
            print(f"Passed: {self.disliked_count}")
            print(f"{'='*60}\n")
            self.tracker.close()


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python gesture_server.py <user_id> <destination>")
        print("Example: python gesture_server.py user_test Paris")
        sys.exit(1)
    
    user_id = sys.argv[1]
    destination = sys.argv[2]
    
    user = db.get_user(user_id)
    if not user:
        print(f"Creating new user: {user_id}")
        user = User(
            id=user_id,
            age=25,
            preferences=[],
            travel_history=[destination]
        )
        db.save_user(user)
    
    swiper = GestureRecommendationSwiper(user_id, destination)
    swiper.run()
