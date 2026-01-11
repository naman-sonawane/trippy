import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Trip from '@/models/Trip';

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000';

export const POST = async (req: Request) => {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { itemId, action, destination, tripId } = body;

    if (!itemId || !action || !destination) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await connectDB();

    const updateField =
      action === 'like'
        ? { $addToSet: { 'preferences.likedItems': itemId } }
        : { $addToSet: { 'preferences.dislikedItems': itemId } };

    await User.findByIdAndUpdate(session.user.id, updateField);

    const response = await fetch(`${PYTHON_API_URL}/api/swipe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: session.user.id,
        itemId,
        action,
        destination,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to record swipe action');
    }

    // Check confidence after recording swipe
    if (tripId) {
      // Multi-user confidence check
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

      // Get all participant IDs (including owner)
      const participantIds = [trip.userId, ...(trip.participantIds || [])].filter(
        (id, index, self) => self.indexOf(id) === index // Remove duplicates
      );

      const confidenceResponse = await fetch(`${PYTHON_API_URL}/api/multi-user-confidence-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantIds,
          destination,
        }),
      });

      if (confidenceResponse.ok) {
        const confidenceData = await confidenceResponse.json();
        
        // Update trip status if all ready
        if (confidenceData.allReady && trip.status === 'collecting_preferences') {
          await Trip.findByIdAndUpdate(tripId, { status: 'ready' });
        }
        
        return NextResponse.json({
          success: true,
          scheduleReady: confidenceData.allReady || false,
          progress: confidenceData.participants,
        }, { status: 200 });
      }
    } else {
      // Single-user confidence check
      const confidenceResponse = await fetch(`${PYTHON_API_URL}/api/confidence-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          destination,
        }),
      });

      if (confidenceResponse.ok) {
        const confidenceData = await confidenceResponse.json();
        return NextResponse.json({
          success: true,
          scheduleReady: confidenceData.meets_threshold || false,
          progress: {
            likes: confidenceData.likes,
            total: confidenceData.total,
            ratio: confidenceData.confidence_ratio,
          },
        }, { status: 200 });
      }
    }

    // If confidence check fails, still return success but scheduleReady: false
    return NextResponse.json({ success: true, scheduleReady: false }, { status: 200 });
  } catch (error) {
    console.error('Error handling swipe:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
};
