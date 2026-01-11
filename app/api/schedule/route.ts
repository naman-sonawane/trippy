import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Trip from '@/models/Trip';
import mongoose from 'mongoose';

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

    // Convert tripId to ObjectId if it's a string
    let tripObjectId;
    try {
      tripObjectId = mongoose.Types.ObjectId.isValid(tripId) 
        ? new mongoose.Types.ObjectId(tripId)
        : tripId;
    } catch (error) {
      console.error('Invalid tripId format in GET:', tripId, error);
      return NextResponse.json({ error: 'Invalid trip ID format' }, { status: 400 });
    }

    const trip = await Trip.findOne({
      _id: tripObjectId,
      $or: [
        { userId: session.user.id },
        { participantIds: session.user.id }
      ]
    });

    if (!trip) {
      console.error('Trip not found in GET /api/schedule:', {
        tripId: tripObjectId,
        userId: session.user.id
      });
      return NextResponse.json({ error: 'Trip not found or access denied' }, { status: 404 });
    }

    console.log('Retrieved itinerary:', {
      tripId: trip._id,
      itineraryCount: trip.itinerary?.length || 0,
      status: trip.status
    });

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

    // Convert tripId to ObjectId if it's a string
    let tripObjectId;
    try {
      tripObjectId = mongoose.Types.ObjectId.isValid(tripId) 
        ? new mongoose.Types.ObjectId(tripId)
        : tripId;
    } catch (error) {
      console.error('Invalid tripId format in POST:', tripId, error);
      return NextResponse.json({ error: 'Invalid trip ID format' }, { status: 400 });
    }

    const trip = await Trip.findOneAndUpdate(
      {
        _id: tripObjectId,
        $or: [
          { userId: session.user.id },
          { participantIds: session.user.id }
        ]
      },
      { $set: { itinerary } },
      { new: true }
    );

    if (!trip) {
      console.error('Failed to save itinerary - trip not found or access denied:', {
        tripId: tripObjectId,
        userId: session.user.id
      });
      return NextResponse.json({ error: 'Trip not found or access denied' }, { status: 404 });
    }

    console.log('Itinerary saved successfully:', {
      tripId: trip._id,
      itineraryCount: trip.itinerary?.length || 0
    });

    return NextResponse.json({ itinerary: trip.itinerary }, { status: 200 });
  } catch (error) {
    console.error('Error saving itinerary:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
};
