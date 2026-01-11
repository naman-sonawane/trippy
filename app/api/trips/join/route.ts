import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Trip from '@/models/Trip';

export const POST = async (req: Request) => {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { tripId, tripCode } = body;

    if (!tripId && !tripCode) {
      return NextResponse.json({ error: 'Trip ID or Trip Code required' }, { status: 400 });
    }

    await connectDB();

    // Find the trip by ID or code
    let trip;
    if (tripCode) {
      trip = await Trip.findOne({ tripCode });
    } else {
      trip = await Trip.findById(tripId);
    }

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    // Check if user is already a participant
    const isOwner = trip.userId === session.user.id;
    const isParticipant = trip.participantIds?.includes(session.user.id);

    if (isOwner || isParticipant) {
      return NextResponse.json(
        { error: 'User is already a participant in this trip', trip },
        { status: 400 }
      );
    }

    // Add user to participantIds
    const actualTripId = trip._id;
    const updatedTrip = await Trip.findByIdAndUpdate(
      actualTripId,
      { $addToSet: { participantIds: session.user.id } },
      { new: true }
    );

    if (!updatedTrip) {
      return NextResponse.json({ error: 'Failed to join trip' }, { status: 500 });
    }

    return NextResponse.json({ trip: updatedTrip }, { status: 200 });
  } catch (error) {
    console.error('Error joining trip:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
};

