import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Trip from '@/models/Trip';
import User from '@/models/User';

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000';

export const POST = async (req: Request) => {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { destination, topN = 20, tripId } = body;

    if (!destination) {
      return NextResponse.json({ error: 'Destination required' }, { status: 400 });
    }

    await connectDB();

    // If tripId provided, use multi-user recommendations
    if (tripId) {
      const trip = await Trip.findOne({
        _id: tripId,
        $or: [
          { userId: session.user.id },
          { participantIds: session.user.id }
        ]
      });

      if (!trip) {
        return NextResponse.json({ error: 'Trip not found or access denied' }, { status: 404 });
      }
    }

    // Single-user flow (existing)
    const user = await User.findById(session.user.id);
    const userPreferences = {
      userId: session.user.id,
      age: user?.age || 25,
      likedItems: user?.preferences?.likedItems || [],
      dislikedItems: user?.preferences?.dislikedItems || [],
      travelHistory: user?.preferences?.travelHistory || [],
    };

    const response = await fetch(`${PYTHON_API_URL}/api/recommendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: userPreferences,
        destination,
        topN,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch recommendations');
    }

    const data = await response.json();
    
    // deduplicate recommendations by id and name
    if (data.recommendations && Array.isArray(data.recommendations)) {
      const originalCount = data.recommendations.length;
      const seenIds = new Set<string>();
      const seenNames = new Set<string>();
      data.recommendations = data.recommendations.filter((rec: any) => {
        const id = rec.id || '';
        const name = (rec.name || '').toLowerCase().trim();
        
        if (seenIds.has(id) || (name && seenNames.has(name))) {
          return false;
        }
        seenIds.add(id);
        if (name) seenNames.add(name);
        return true;
      });
      const filteredCount = data.recommendations.length;
      if (originalCount !== filteredCount) {
        console.log(`Deduplicated recommendations: ${originalCount} -> ${filteredCount}`);
      }
    }
    
    // fetch images for recommendations that have unsplash urls or missing images
    const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
    
    if (data.recommendations && Array.isArray(data.recommendations)) {
      const imagePromises = data.recommendations.map(async (rec: any) => {
        const imageUrl = rec.features?.image_url || '';
        const needsImage = !imageUrl || imageUrl.includes('unsplash.com') || imageUrl.includes('source.unsplash');
        
        if (needsImage && rec.name && PEXELS_API_KEY) {
          try {
            const searchQuery = `${rec.name} ${destination}`;
            const encodedQuery = encodeURIComponent(searchQuery);
            const pexelsUrl = `https://api.pexels.com/v1/search?query=${encodedQuery}&per_page=1`;
            
            const imageResponse = await fetch(pexelsUrl, {
              method: 'GET',
              headers: {
                'Authorization': PEXELS_API_KEY
              },
              signal: AbortSignal.timeout(10000), // 10 second timeout
            });
            
            if (imageResponse.ok) {
              const imageData = await imageResponse.json();
              if (imageData.photos && imageData.photos.length > 0) {
                const photo = imageData.photos[0];
                const imageUrl = photo.src?.large || photo.src?.original || '';
                if (imageUrl) {
                  rec.features = rec.features || {};
                  rec.features.image_url = imageUrl;
                } else {
                  rec.features = rec.features || {};
                  rec.features.image_url = '';
                }
              } else {
                rec.features = rec.features || {};
                rec.features.image_url = '';
              }
            } else {
              console.error(`Pexels API error for ${rec.name}:`, imageResponse.status);
              rec.features = rec.features || {};
              rec.features.image_url = '';
            }
          } catch (error) {
            console.error(`Error fetching Pexels image for ${rec.name}:`, error);
            rec.features = rec.features || {};
            rec.features.image_url = '';
          }
        } else if (needsImage && rec.name) {
          // if no pexels key, try python backend as fallback
          try {
            const searchQuery = `${rec.name} ${destination}`;
            const imageResponse = await fetch(`${PYTHON_API_URL}/api/scrape-image`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: searchQuery }),
              signal: AbortSignal.timeout(10000),
            });
            
            if (imageResponse.ok) {
              const imageData = await imageResponse.json();
              if (imageData.image_url && imageData.image_url.trim() !== '') {
                rec.features = rec.features || {};
                rec.features.image_url = imageData.image_url;
              } else {
                rec.features = rec.features || {};
                rec.features.image_url = '';
              }
            } else {
              rec.features = rec.features || {};
              rec.features.image_url = '';
            }
          } catch (error) {
            console.error(`Error fetching image for ${rec.name}:`, error);
            rec.features = rec.features || {};
            rec.features.image_url = '';
          }
        }
        return rec;
      });
      
      data.recommendations = await Promise.all(imagePromises);
    }
    
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recommendations' },
      { status: 500 }
    );
  }
};
