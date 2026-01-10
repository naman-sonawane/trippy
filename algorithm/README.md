# Trippy Recommendation Algorithm

A Tinder-like ML-based recommendation system for suggesting travel destinations, places, and activities based on user preferences, age, and destination.

## Features

- **Hybrid ML Approach**: Combines collaborative filtering, content-based filtering, and semantic similarity (Pinecone)
- **Age Suitability Scoring**: Uses soft weighting based on age rather than hard filters
- **Learning System**: Updates recommendations based on user interactions (likes/dislikes)
- **CLI Interface**: Interactive command-line interface for exploring recommendations

## Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. (Optional) Set up Pinecone for semantic similarity:
   - Get a Pinecone API key from https://www.pinecone.io/
   - Set environment variable: `export PINECONE_API_KEY=your_api_key`
   - If not set, the system will work without Pinecone (using only collaborative and content-based filtering)

## Usage

Run the CLI interface:

```bash
python main.py
```

The system will prompt you for:
1. **Destination**: Where you're traveling to (e.g., "Paris", "Tokyo", "New York")
2. **Age**: Your age (used for suitability scoring)

Then you'll see recommendations one at a time. For each recommendation:
- Type `like` or `l` to like it
- Type `dislike` or `d` to dislike it
- Type `skip` or `s` to skip
- Type `quit` or `q` to exit

## How It Works

1. **Collaborative Filtering**: Finds users with similar preferences and recommends items they liked
2. **Content-Based Filtering**: Matches your preferences to item features (category, tags, energy level)
3. **Semantic Similarity (Pinecone)**: Uses embeddings to find semantically similar places/activities
4. **Age Suitability**: Applies soft multipliers based on age and activity characteristics:
   - High-energy activities (nightlife): Boost for 18-35, penalty for 51+
   - Low-energy activities (museums): Positive for all ages
   - Family-friendly: Boost for 25-45 age range

Final scores combine all three approaches with weighted averaging, then apply age suitability multipliers.

## Data Structure

The mock database (`data/mock_db.json`) contains:
- **Users**: Sample users with ages and preferences
- **Places**: Destinations with features (energy_level, age_suitability_profile, tags)
- **Activities**: Activities associated with places
- **Interactions**: User likes/dislikes for places and activities

## Architecture

- `models.py`: Data models (User, Place, Activity, Interaction)
- `database.py`: JSON database interface
- `collaborative_filter.py`: User-user similarity recommendations
- `content_based.py`: Feature-based recommendations
- `pinecone_service.py`: Semantic similarity service
- `age_scorer.py`: Age suitability multiplier calculation
- `recommendation_engine.py`: Main orchestration engine
- `main.py`: CLI interface

## Extending

To add more destinations, edit `data/mock_db.json` and add:
- Places with `location` matching your destination
- Activities with `place_id` referencing those places
- Users with interaction history

The system will automatically use this data for recommendations.

