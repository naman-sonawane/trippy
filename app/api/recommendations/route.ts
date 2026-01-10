import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000';

export const POST = async (req: Request) => {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { destination, topN = 20 } = body;

    if (!destination) {
      return NextResponse.json({ error: 'Destination required' }, { status: 400 });
    }

    const userPreferences = {
      userId: session.user.id,
      age: (session.user as any).age || 25,
      likedItems: (session.user as any).preferences?.likedItems || [],
      dislikedItems: (session.user as any).preferences?.dislikedItems || [],
      travelHistory: (session.user as any).preferences?.travelHistory || [],
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
