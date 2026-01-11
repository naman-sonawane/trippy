import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('travel agent webhook received:', JSON.stringify(body, null, 2));

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('webhook error:', error);
    return NextResponse.json(
      { error: 'webhook processing failed' },
      { status: 500 }
    );
  }
}
