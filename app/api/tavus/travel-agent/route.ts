import { NextRequest, NextResponse } from 'next/server';

function generateTravelAgentPrompt(destination: string, startDate: string, endDate: string): string {
  return `you are a friendly and professional travel agent helping a traveler plan their trip to ${destination} from ${startDate} to ${endDate}.

your goal is to gather the following information naturally through conversation:
- age of the traveler
- budget for the trip (in dollars)
- how much they want to walk (scale 1-10, where 1 is minimal walking, 10 is lots of walking/hiking)
- preference for daytime or nighttime activities
- who they are traveling with (solo, partner, family, friends, etc)

conversation style:
- be warm, enthusiastic, and conversational
- ask questions one at a time
- acknowledge their responses before moving to the next question
- use natural transitions between questions
- show excitement about their trip
- keep responses concise (2-3 sentences max)

important rules:
- start by greeting them warmly and confirming their destination and dates
- then ask about each preference naturally
- don't ask multiple questions at once
- be encouraging and positive
- if they give vague answers, gently ask for clarification
- when you have all the information, summarize what you learned and tell them you're ready to find the perfect places for them

remember: you're building excitement for their trip while gathering important planning details!`;
}

export async function POST(request: NextRequest) {
  try {
    console.log('travel agent api route called');
    
    const body = await request.json();
    console.log('request body:', body);

    const { action, destination, startDate, endDate } = body;

    if (action === 'create') {
      if (!destination || !startDate || !endDate) {
        return NextResponse.json(
          { error: 'missing required fields: destination, startDate, endDate' },
          { status: 400 }
        );
      }

      console.log('creating travel agent conversation for:', destination);

      const apiKey = process.env.TAVUS_API_KEY;
      const replicaId = process.env.TAVUS_REPLICA_ID;
      const personaId = process.env.TAVUS_PERSONA_ID;

      console.log('environment variables check:');
      console.log('api key exists:', !!apiKey);
      console.log('replica id:', replicaId);
      console.log('persona id:', personaId);

      if (!apiKey || !replicaId || !personaId) {
        return NextResponse.json(
          { 
            error: 'tavus configuration incomplete',
            message: 'travel agent is not fully configured yet.',
          },
          { status: 503 }
        );
      }

      const conversationalContext = generateTravelAgentPrompt(destination, startDate, endDate);
      
      console.log('system prompt for travel agent:');
      console.log('='.repeat(80));
      console.log(conversationalContext);
      console.log('='.repeat(80));

      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      const webhookUrl = `${baseUrl}/api/tavus/transcript`;
      
      const requestBody = {
        replica_id: replicaId,
        persona_id: personaId,
        conversational_context: conversationalContext,
        callback_url: webhookUrl,
        properties: {
          max_call_duration: 900,
          enable_recording: true,
          enable_transcription: true,
          language: "english"
        }
      };

      console.log('tavus request body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch('https://tavusapi.com/v2/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify(requestBody),
      });

      console.log('tavus response status:', response.status);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = await response.text();
        }
        console.log('tavus api error:', errorData);
        
        return NextResponse.json(
          { 
            error: 'failed to create conversation', 
            details: errorData,
            status: response.status
          },
          { status: response.status }
        );
      }

      const data = await response.json();
      console.log('tavus api success:', data);

      return NextResponse.json(data);
    }

    return NextResponse.json(
      { error: 'invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('travel agent api route error:', error);
    return NextResponse.json(
      { error: 'internal server error', details: error instanceof Error ? error.message : 'unknown error' },
      { status: 500 }
    );
  }
}
