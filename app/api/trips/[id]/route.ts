import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Trip from '@/models/Trip';

export const GET = async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { id } = await params;

    const trip = await Trip.findOne({
      _id: id,
      $or: [
        { userId: session.user.id },
        { participantIds: session.user.id }
      ]
    });

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({ trip }, { status: 200 });
  } catch (error) {
    console.error('Error fetching trip:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
};

export const PUT = async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    await connectDB();

    const { id } = await params;

    const trip = await Trip.findOneAndUpdate(
      { _id: id, userId: session.user.id },
      body,
      { new: true }
    );

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    return NextResponse.json({ trip }, { status: 200 });
  } catch (error) {
    console.error('Error updating trip:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
};

export const DELETE = async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { id } = await params;

    const trip = await Trip.findOneAndDelete({ _id: id, userId: session.user.id });

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Trip deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error deleting trip:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
};
