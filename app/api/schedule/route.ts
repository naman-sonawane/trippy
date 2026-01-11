import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Trip from '@/models/Trip';

export const GET = async (req: Request) => {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const tripId = searchParams.get('tripId');

    if (!tripId) {
      return NextResponse.json({ error: 'Trip ID required' }, { status: 400 });
    }

    await connectDB();

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

    return NextResponse.json({ itinerary: trip.itinerary || [] }, { status: 200 });
  } catch (error) {
    console.error('Error fetching itinerary:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
};

export const POST = async (req: Request) => {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { tripId, itinerary } = body;

    if (!tripId || !itinerary) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await connectDB();

    const trip = await Trip.findOneAndUpdate(
      {
        _id: tripId,
        $or: [
          { userId: session.user.id },
          { participantIds: session.user.id }
        ]
      },
      { itinerary },
      { new: true }
    );

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({ itinerary: trip.itinerary }, { status: 200 });
  } catch (error) {
    console.error('Error saving itinerary:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
};
