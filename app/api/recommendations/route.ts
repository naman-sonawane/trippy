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

      // Get all participant IDs (including owner)
      const participantIds = [trip.userId, ...(trip.participantIds || [])].filter(
        (id, index, self) => self.indexOf(id) === index // Remove duplicates
      );

      // Get user preferences for all participants
      const participants = await User.find({ _id: { $in: participantIds } });
      const participantPreferences = participants.map(user => ({
        userId: user._id.toString(),
        age: user.age || 25,
        likedItems: user.preferences?.likedItems || [],
        dislikedItems: user.preferences?.dislikedItems || [],
        travelHistory: user.preferences?.travelHistory || [],
      }));

      // Call multi-user recommendations endpoint
      const response = await fetch(`${PYTHON_API_URL}/api/multi-user-recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          participantPreferences,
          destination,
          topN,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch multi-user recommendations');
      }

      const data = await response.json();
      return NextResponse.json(data, { status: 200 });
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
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recommendations' },
      { status: 500 }
    );
  }
};
