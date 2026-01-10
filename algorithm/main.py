"""CLI interface for the recommendation system."""
import sys
from datetime import datetime
from database import Database
from recommendation_engine import RecommendationEngine
from models import User, Interaction


def print_separator():
    """Print a visual separator."""
    print("\n" + "=" * 60 + "\n")


def display_item(item, score: float):
    """Display a place or activity recommendation."""
    print_separator()
    print(f"📍 {item.name}")
    print(f"   Category: {item.category}")
    
    if hasattr(item, 'location'):
        print(f"   Location: {item.location}")
    
    features = item.features
    if features.get("tags"):
        print(f"   Tags: {', '.join(features['tags'])}")
    
    if features.get("energy_level"):
        print(f"   Energy Level: {features['energy_level']}")
    
    if features.get("price_range"):
        print(f"   Price Range: {features['price_range']}")
    
    if item.description:
        print(f"   Description: {item.description}")
    
    print(f"   Recommendation Score: {score:.2f}")
    print_separator()


def main():
    """Main CLI entry point."""
    print("=" * 60)
    print("🌟 TRIPPY - Travel Recommendation System 🌟")
    print("=" * 60)
    
    # Initialize database and engine
    db = Database()
    engine = RecommendationEngine(db)
    
    # Get user input
    print("\nWelcome! Let's find you some amazing places to visit.")
    print_separator()
    
    destination = input("Where are you traveling to? ").strip()
    if not destination:
        print("Error: Destination is required.")
        sys.exit(1)
    
    try:
        age = int(input("What's your age? ").strip())
        if age < 1 or age > 120:
            print("Error: Please enter a valid age.")
            sys.exit(1)
    except ValueError:
        print("Error: Please enter a valid number for age.")
        sys.exit(1)
    
    # Create or get user
    # For simplicity, create a temporary user for this session
    # In a real system, you'd have user authentication
    user_id = f"user_{destination}_{age}"
    user = db.get_user(user_id)
    
    if not user:
        # Create new user
        user = User(
            id=user_id,
            age=age,
            preferences=[],
            travel_history=[destination]
        )
        # Save to database
        db.save_user(user)
    
    print_separator()
    print(f"Great! Finding recommendations for {destination}...")
    print(f"Age: {age} years old")
    print_separator()
    
    # Check if destination has any places/activities
    places = db.get_places_by_destination(destination)
    activities = db.get_activities_by_destination(destination)
    
    if len(places) == 0 and len(activities) == 0:
        print(f"Sorry, no recommendations found for {destination}.")
        print("The database might not have places for this destination yet.")
        sys.exit(0)
    
    print("Swipe through recommendations (like/dislike):")
    print("Type 'like' or 'l' to like, 'dislike' or 'd' to dislike")
    print("Type 'skip' or 's' to skip, 'quit' or 'q' to exit\n")
    
    # Track shown items to avoid duplicates
    shown_item_ids = set()
    liked_count = 0
    disliked_count = 0
    skipped_count = 0
    
    # Infinite loop for recommendations
    while True:
        # Reload user to get updated interactions
        user = db.get_user(user_id)
        if not user:
            # This shouldn't happen, but create user if it doesn't exist
            user = User(
                id=user_id,
                age=age,
                preferences=[],
                travel_history=[destination]
            )
            db.save_user(user)
        
        # Get fresh recommendations (excluding already shown items)
        recommendations = engine.get_recommendations(user, destination, top_n=50)
        
        # Filter out already shown items
        available_recommendations = [
            (item, score) for item, score in recommendations
            if item.id not in shown_item_ids
        ]
        
        if len(available_recommendations) == 0:
            print("\n" + "=" * 60)
            print("You've seen all available recommendations!")
            print("Try a different destination or check back later for new places.")
            print("=" * 60)
            break
        
        # Get the top recommendation
        item, score = available_recommendations[0]
        shown_item_ids.add(item.id)
        
        display_item(item, score)
        
        while True:
            action = input("Your choice (like/dislike/skip/quit): ").strip().lower()
            
            if action in ['quit', 'q']:
                print_separator()
                print(f"Session Summary:")
                print(f"  Liked: {liked_count}")
                print(f"  Disliked: {disliked_count}")
                print(f"  Skipped: {skipped_count}")
                print("\nThanks for using TRIPPY! 👋")
                sys.exit(0)
            
            elif action in ['skip', 's']:
                skipped_count += 1
                print("→ Skipped. Finding next recommendation...\n")
                break
            
            elif action in ['like', 'l']:
                # Add interaction
                interaction = Interaction(
                    user_id=user_id,
                    item_id=item.id,
                    item_type="place" if hasattr(item, 'location') else "activity",
                    rating=1,
                    timestamp=datetime.now().isoformat()
                )
                db.add_interaction(interaction)
                liked_count += 1
                print("✓ Liked! Added to your preferences. Finding next recommendation...\n")
                break
            
            elif action in ['dislike', 'd']:
                # Add interaction
                interaction = Interaction(
                    user_id=user_id,
                    item_id=item.id,
                    item_type="place" if hasattr(item, 'location') else "activity",
                    rating=-1,
                    timestamp=datetime.now().isoformat()
                )
                db.add_interaction(interaction)
                disliked_count += 1
                print("✗ Disliked. We'll avoid similar places. Finding next recommendation...\n")
                break
            
            else:
                print("Invalid input. Please enter: like/l, dislike/d, skip/s, or quit/q")


if __name__ == "__main__":
    main()

