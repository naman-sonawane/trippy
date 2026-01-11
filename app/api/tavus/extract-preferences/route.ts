import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { conversationId } = await request.json();

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.TAVUS_API_KEY;
    const aiApiKey = process.env.AI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing TAVUS_API_KEY' },
        { status: 500 }
      );
    }

    if (!aiApiKey) {
      return NextResponse.json(
        { error: 'Missing AI_API_KEY' },
        { status: 500 }
      );
    }

    console.log('Fetching conversation from Tavus:', conversationId);

    // Wait a bit for transcript to be ready
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

    // According to Tavus docs with verbose=true, transcript should be in the response
    let transcript = null;
    let fullConversation = '';

    // Method 1: Direct transcript field
    if (conversationData.transcript) {
      transcript = conversationData.transcript;
      console.log('Found transcript in direct field');
    }
    
    // Method 2: Check events array for transcription_ready event
    if (!transcript && conversationData.events) {
      const transcriptEvent = conversationData.events.find(
        (e: any) => e.event_type === 'application.transcription_ready'
      );
      if (transcriptEvent?.properties?.transcript) {
        transcript = transcriptEvent.properties.transcript;
        console.log('Found transcript in events array');
      }
    }

    // Method 3: Check properties
    if (!transcript && conversationData.properties?.transcript) {
      transcript = conversationData.properties.transcript;
      console.log('Found transcript in properties');
    }

    if (transcript) {
      // If transcript is an array of messages, format it
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

    if (!fullConversation || fullConversation.length < 10) 
      console.log('No transcript available yet - conversation might still be processing');
      return NextResponse.json({
        preferences: { budget: null, walk: null, dayNight: null, solo: null },
        rawConversation: 'Transcript not ready yet. Please wait a few seconds and try again.',
        error: 'Transcript not ready yet',
        conversationData: conversationData // Include raw data for debugging
      });
    

    console.log('Sending to Qwen for extraction...');

    const qwenResponse = await fetch(
      'https://ai.hackclub.com/proxy/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${aiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen/qwen3-32b',
          messages: [
            {
              role: 'system',
              content: `You are a data extraction assistant. Extract travel preferences from conversations. Return ONLY a JSON object with these fields:
{
  "budget": "budget" | "mid-range" | "luxury" | null,
  "walk": "comfortable" | "prefer-short" | null,
  "dayNight": "day" | "night" | null,
  "solo": "solo" | "family" | "friends" | "partner" | null
}
If a preference is not mentioned, set it to null. Be liberal in interpretation but only return valid values.`,
            },
            {
              role: 'user',
              content: `Extract preferences from this conversation:\n\n${fullConversation}`,
            },
          ],
        }),
      }
    );

    if (!qwenResponse.ok) {
      const errorText = await qwenResponse.text();
      console.error('Qwen API error:', errorText);
      throw new Error('Failed to extract preferences with AI');
    }

    const qwenData = await qwenResponse.json();
    console.log('Qwen response:', JSON.stringify(qwenData, null, 2));
    
    const extractedText = qwenData.choices?.[0]?.message?.content || '{}';
    console.log('Extracted text:', extractedText);

    let preferences;
    try {
      const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
      preferences = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      preferences = {};
    }

    console.log('Final preferences:', preferences);

    return NextResponse.json({
      preferences,
      rawConversation: fullConversation,
    });
  } catch (error) {
    console.error('Error extracting preferences:', error);
    return NextResponse.json(
      { error: 'Failed to extract preferences', details: String(error) },
      { status: 500 }
    );
  }
}
