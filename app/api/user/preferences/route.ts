import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

export const PATCH = async (req: Request) => {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { age, budget, walk, dayNight, solo } = body;

    await connectDB();

    const updatedUser = await User.findByIdAndUpdate(
      session.user.id,
      {
        age,
        budget,
        walk,
        dayNight,
        solo,
      },
      { new: true }
    );

    return NextResponse.json({ user: updatedUser }, { status: 200 });
  } catch (error) {
    console.error('Error updating user preferences:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
};
