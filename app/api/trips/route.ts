import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Trip from '@/models/Trip';
import User from '@/models/User';

export const GET = async (req: Request) => {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    let userId = session.user.id;
    if (!userId && session.user.email) {
      let user = await User.findOne({ email: session.user.email });
      if (!user) {
        user = await User.create({
          email: session.user.email,
          name: session.user.name,
          image: session.user.image,
        });
      }
      userId = user._id.toString();
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unable to determine user ID' }, { status: 400 });
    }

    const trips = await Trip.find({
      $or: [
        { userId },
        { participantIds: userId }
      ]
    }).sort({ createdAt: -1 });

    return NextResponse.json({ trips }, { status: 200 });
  } catch (error) {
    console.error('Error fetching trips:', error);
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
    const { destination, startDate, endDate, activities } = body;

    if (!destination || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await connectDB();

    let userId = session.user.id;
    if (!userId && session.user.email) {
      let user = await User.findOne({ email: session.user.email });
      if (!user) {
        user = await User.create({
          email: session.user.email,
          name: session.user.name,
          image: session.user.image,
        });
      }
      userId = user._id.toString();
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unable to determine user ID' }, { status: 400 });
    }

    const generateTripCode = (): string => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    let tripCode = generateTripCode();
    let codeExists = await Trip.findOne({ tripCode });
    while (codeExists) {
      tripCode = generateTripCode();
      codeExists = await Trip.findOne({ tripCode });
    }

    const trip = await Trip.create({
      userId,
      participantIds: [userId],
      destination,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      activities: activities || [],
      status: 'collecting_preferences',
      tripCode,
    });

    const tripResponse = trip.toObject();
    return NextResponse.json({ trip: tripResponse }, { status: 201 });
  } catch (error) {
    console.error('Error creating trip:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
};
