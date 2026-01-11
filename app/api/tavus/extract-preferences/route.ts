import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { conversationId } = await request.json();

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.TAVUS_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing TAVUS_API_KEY' },
        { status: 500 }
      );
    }

    console.log('Fetching conversation from Tavus:', conversationId);

    await new Promise(resolve => setTimeout(resolve, 3000));

    const conversationResponse = await fetch(
      `https://tavusapi.com/v2/conversations/${conversationId}?verbose=true`,
      {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
        },
      }
    );

    if (!conversationResponse.ok) {
      const errorText = await conversationResponse.text();
      console.error('Tavus API error:', errorText);
      throw new Error('Failed to fetch conversation from Tavus');
    }

    const conversationData = await conversationResponse.json();
    console.log('Tavus conversation data:', JSON.stringify(conversationData, null, 2));

    let transcript = null;
    let fullConversation = '';

    if (conversationData.transcript) {
      transcript = conversationData.transcript;
      console.log('Found transcript in direct field');
    }
    
    if (!transcript && conversationData.events) {
      const transcriptEvent = conversationData.events.find(
        (e: any) => e.event_type === 'application.transcription_ready'
      );
      if (transcriptEvent?.properties?.transcript) {
        transcript = transcriptEvent.properties.transcript;
        console.log('Found transcript in events array');
      }
    }

    if (!transcript && conversationData.properties?.transcript) {
      transcript = conversationData.properties.transcript;
      console.log('Found transcript in properties');
    }

    if (transcript) {
      if (Array.isArray(transcript)) {
        fullConversation = transcript
          .map((msg: any) => `${msg.role}: ${msg.content}`)
          .join('\n');
      } else if (typeof transcript === 'string') {
        fullConversation = transcript;
      } else {
        fullConversation = JSON.stringify(transcript);
      }
    }

    console.log('Extracted transcript:', fullConversation);
    console.log('Transcript length:', fullConversation.length);

    if (!fullConversation || fullConversation.length < 10) {
      console.log('No transcript available yet - conversation might still be processing');
      return NextResponse.json({
        preferences: { budget: null, walk: null, dayNight: null, solo: null },
        rawConversation: 'Transcript not ready yet. Please wait a few seconds and try again.',
        error: 'Transcript not ready yet',
        conversationData: conversationData
      });
    }

    return NextResponse.json({
      preferences: { budget: null, walk: null, dayNight: null, solo: null },
      rawConversation: fullConversation,
      note: 'Preferences are now extracted via webhook in real-time. Check the webhook logs.'
    });
  } catch (error) {
    console.error('Error extracting preferences:', error);
    return NextResponse.json(
      { error: 'Failed to extract preferences', details: String(error) },
      { status: 500 }
    );
  }
}
