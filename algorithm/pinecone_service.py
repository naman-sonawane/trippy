"""Pinecone vector similarity service."""
from typing import List, Dict, Optional
import os
from models import Place, Activity

try:
    from pinecone import Pinecone, ServerlessSpec
    from sentence_transformers import SentenceTransformer
    PINECONE_AVAILABLE = True
except ImportError:
    PINECONE_AVAILABLE = False


class PineconeService:
    """Service for semantic similarity using Pinecone."""
    
    def __init__(self, index_name: str = "trippy-recommendations"):
        """Initialize Pinecone service."""
        self.index_name = index_name
        self.index = None
        self.encoder = None
        
        if not PINECONE_AVAILABLE:
            print("Warning: Pinecone or sentence-transformers not available. Using fallback.")
            return
        
        # Initialize encoder
        try:
            self.encoder = SentenceTransformer('all-MiniLM-L6-v2')
        except Exception as e:
            print(f"Warning: Could not load sentence transformer: {e}")
            return
        
        # Initialize Pinecone
        api_key = "pcsk_6wk65_4PueTtzvsPVtSLL6tTYYug9EqwXRAYZ3NWT7151PfdZUFzWuYexihB2DFk81Xgj"
        if api_key:
            try:
                pc = Pinecone(api_key=api_key)
                # Try to get or create index
                if index_name not in [idx.name for idx in pc.list_indexes()]:
                    pc.create_index(
                        name=index_name,
                        dimension=384,  # all-MiniLM-L6-v2 dimension
                        metric="cosine",
                        spec=ServerlessSpec(
                            cloud="aws",
                            region="us-east-1"
                        )
                    )
                self.index = pc.Index(index_name)
            except Exception as e:
                print(f"Warning: Could not initialize Pinecone: {e}")
        else:
            print("Warning: PINECONE_API_KEY not set. Pinecone features disabled.")
    
    def _generate_embedding(self, text: str) -> Optional[List[float]]:
        """Generate embedding for text."""
        if not self.encoder:
            return None
        
        try:
            embedding = self.encoder.encode(text)
            return embedding.tolist()
        except Exception as e:
            print(f"Error generating embedding: {e}")
            return None
    
    def _get_item_text(self, item: Place | Activity) -> str:
        """Extract text representation of item for embedding."""
        features = item.features
        tags = features.get("tags", [])
        category = item.category
        description = item.description or ""
        energy_level = features.get("energy_level", "")
        age_suitability = features.get("age_suitability_profile", "")
        
        text_parts = [
            item.name,
            category,
            description,
            energy_level,
            age_suitability,
            " ".join(tags)
        ]
        
        return " ".join(filter(None, text_parts))
    
    def upsert_items(self, places: List[Place], activities: List[Activity]):
        """Upsert items to Pinecone index."""
        if not self.index or not self.encoder:
            return
        
        vectors = []
        
        # Process places
        for place in places:
            text = self._get_item_text(place)
            embedding = self._generate_embedding(text)
            if embedding:
                vectors.append({
                    "id": f"place_{place.id}",
                    "values": embedding,
                    "metadata": {
                        "item_id": place.id,
                        "item_type": "place",
                        "name": place.name,
                        "location": place.location
                    }
                })
        
        # Process activities
        for activity in activities:
            text = self._get_item_text(activity)
            embedding = self._generate_embedding(text)
            if embedding:
                vectors.append({
                    "id": f"activity_{activity.id}",
                    "values": embedding,
                    "metadata": {
                        "item_id": activity.id,
                        "item_type": "activity",
                        "name": activity.name
                    }
                })
        
        # Batch upsert
        if vectors:
            try:
                self.index.upsert(vectors=vectors)
            except Exception as e:
                print(f"Error upserting to Pinecone: {e}")
    
    def get_similar_items(
        self,
        query_text: str,
        user_interactions: List,
        top_k: int = 10
    ) -> Dict[str, float]:
        """
        Get semantically similar items based on query text.
        
        Returns dictionary mapping item_id to similarity score.
        """
        if not self.index or not self.encoder:
            return {}
        
        # Generate query embedding
        query_embedding = self._generate_embedding(query_text)
        if not query_embedding:
            return {}
        
        # Query Pinecone
        try:
            results = self.index.query(
                vector=query_embedding,
                top_k=top_k * 2,  # Get more to filter out user's already interacted items
                include_metadata=True
            )
            
            # Filter out items user has already interacted with
            user_item_ids = {inter.item_id for inter in user_interactions}
            
            item_scores: Dict[str, float] = {}
            for match in results.matches:
                item_id = match.metadata.get("item_id")
                if item_id and item_id not in user_item_ids:
                    # Use similarity score (already normalized 0-1)
                    item_scores[item_id] = match.score
            
            return item_scores
        except Exception as e:
            print(f"Error querying Pinecone: {e}")
            return {}
    
    def get_recommendations(
        self,
        user_interactions: List,
        places: List[Place],
        activities: List[Activity],
        destination: str,
        top_n: int = 20
    ) -> Dict[str, float]:
        """
        Get Pinecone-based recommendations.
        
        Uses user's liked items to find similar items.
        """
        if not self.index or not self.encoder:
            return {}
        
        # Build query from user's positive interactions
        liked_items = [inter for inter in user_interactions if inter.rating > 0]
        
        if len(liked_items) == 0:
            # Use destination as query
            query_text = f"places and activities in {destination}"
        else:
            # Build query from liked items
            query_parts = []
            for inter in liked_items[:5]:  # Use top 5 liked items
                if inter.item_type == "place":
                    item = next((p for p in places if p.id == inter.item_id), None)
                else:
                    item = next((a for a in activities if a.id == inter.item_id), None)
                
                if item:
                    query_parts.append(self._get_item_text(item))
            
            query_text = " ".join(query_parts) if query_parts else f"places in {destination}"
        
        # Get similar items
        similar_items = self.get_similar_items(query_text, user_interactions, top_n * 2)
        
        # Filter to only include items in destination
        valid_item_ids = {p.id for p in places} | {a.id for a in activities}
        similar_items = {k: v for k, v in similar_items.items() if k in valid_item_ids}
        
        # Return top N
        sorted_items = sorted(similar_items.items(), key=lambda x: x[1], reverse=True)
        return dict(sorted_items[:top_n])

