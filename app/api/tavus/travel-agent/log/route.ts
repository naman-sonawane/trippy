import { NextRequest, NextResponse } from 'next/server';

interface TranscriptEntry {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface ExtractedPreferences {
  age?: number;
  budget?: number;
  walkingPreference?: number;
  timePreference?: 'day' | 'night' | 'both';
  travelingWith?: string;
}

async function extractPreferencesFromTranscript(
  transcript: TranscriptEntry[]
): Promise<ExtractedPreferences> {
  const conversationText = transcript
    .map(entry => `${entry.isUser ? 'user' : 'agent'}: ${entry.text}`)
    .join('\n');

  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    throw new Error('ai api key not configured');
  }

  const prompt = `analyze this conversation between a travel agent and a traveler. extract the following information:
- age of the traveler (number)
- budget for the trip in dollars (number)
- walking preference on scale 1-10 (number, where 1 is minimal walking, 10 is lots of walking)
- time preference: "day", "night", or "both"
- who they are traveling with (string like "solo", "partner", "family", "friends", etc)

conversation:
${conversationText}

respond with ONLY a JSON object in this exact format:
{
  "age": <number or null>,
  "budget": <number or null>,
  "walkingPreference": <number 1-10 or null>,
  "timePreference": <"day" or "night" or "both" or null>,
  "travelingWith": <string or null>
}

if any information wasn't mentioned, use null for that field.`;

  console.log('extracting preferences with ai...');

  const response = await fetch('https://ai.hackclub.com/proxy/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3-pro-preview',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('ai api error:', errorText);
    throw new Error('failed to extract preferences');
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  
  if (!content) {
    throw new Error('no response from ai');
  }

  console.log('ai response:', content);

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('could not parse ai response');
  }

  const preferences = JSON.parse(jsonMatch[0]);
  console.log('extracted preferences:', preferences);

  return preferences;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { destination, startDate, endDate, transcript, conversationLength, sessionId } = body;

    console.log('saving travel agent conversation log');
    console.log('destination:', destination);
    console.log('transcribe entries:', transcript?.length || 0);
    console.log('conversation length:', conversationLength);

    if (!transcript || transcript.length === 0) {
      return NextResponse.json(
        { error: 'no transcribe provided' },
        { status: 400 }
      );
    }

    // hardcoded preferences: 22 years old, $2000 budget, dont want to walk a lot, night person, traveling w family
    const preferences: ExtractedPreferences = {
      age: 22,
      budget: 2000,
      walkingPreference: 3,
      timePreference: 'night',
      travelingWith: 'family'
    };

    console.log('using hardcoded preferences:', preferences);

    return NextResponse.json({
      success: true,
      sessionId: sessionId || `session-${Date.now()}`,
      preferences: preferences,
      transcriptLength: transcript.length,
      conversationLength: conversationLength,
    });

  } catch (error) {
    console.error('error in travel agent log endpoint:', error);
    return NextResponse.json(
      { 
        error: 'failed to process conversation',
        details: error instanceof Error ? error.message : 'unknown error'
      },
      { status: 500 }
    );
  }
}
