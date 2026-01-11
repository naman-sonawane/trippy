import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('Tavus transcript webhook received');
    
    const body = await request.json();
    console.log('Transcript webhook data:', JSON.stringify(body, null, 2));
    
    const { 
      conversation_id, 
      transcript_entries = [],
      event_type = 'transcript_update'
    } = body;
    
    if (!conversation_id) {
      console.log('No conversation_id in webhook data');
      return NextResponse.json({ error: 'Missing conversation_id' }, { status: 400 });
    }
    
    const processedEntries = transcript_entries.map((entry: any) => ({
      id: entry.id || `transcript_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: entry.text || entry.transcript || '',
      isUser: entry.is_user || entry.speaker === 'user' || false,
      timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date()
    }));
    
    console.log('Processed transcript entries:', processedEntries.length);
    console.log('Transcript data processed successfully');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Transcript data received',
      entries_processed: processedEntries.length
    });
    
  } catch (error) {
    console.error('Transcript webhook error:', error);
    return NextResponse.json(
      { error: 'Failed to process transcript data' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversation_id');
    
    if (!conversationId) {
      return NextResponse.json({ 
        message: 'Tavus transcript webhook endpoint is active',
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`Polling transcript for conversation: ${conversationId}`);
    
    try {
      const apiKey = process.env.TAVUS_API_KEY;
      
      if (!apiKey) throw new Error('No Tavus API key found');

      const tavusResponse = await fetch(`https://tavusapi.com/v2/conversations/${conversationId}?verbose=true`, {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (tavusResponse.ok) {
        const conversationData = await tavusResponse.json();
        console.log('Tavus conversation data:', conversationData);
        
        let transcriptEntries: any[] = [];
        
        // check multiple possible locations for transcript
        if (conversationData.transcript_entries) {
          transcriptEntries = conversationData.transcript_entries;
        } else if (conversationData.transcript) {
          transcriptEntries = Array.isArray(conversationData.transcript) ? conversationData.transcript : [];
        } else if (conversationData.events) {
          const transcriptEvent = conversationData.events.find((e: any) => e.event_type === 'application.transcription_ready');
          if (transcriptEvent?.properties?.transcript) {
            transcriptEntries = Array.isArray(transcriptEvent.properties.transcript) ? transcriptEvent.properties.transcript : [];
          }
        } else if (conversationData.properties?.transcript) {
          transcriptEntries = Array.isArray(conversationData.properties.transcript) ? conversationData.properties.transcript : [];
        }
        
        if (transcriptEntries.length > 0) {
          console.log('Found transcript entries:', transcriptEntries.length);
          return NextResponse.json({
            conversation_id: conversationId,
            transcript_entries: transcriptEntries.map((entry: any) => ({
              id: entry.id || `tavus_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              text: entry.text || entry.content || entry.transcript || '',
              isUser: entry.is_user || entry.speaker === 'user' || entry.role === 'user' || false,
              timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date()
            })),
            timestamp: new Date().toISOString()
          });
        } else {
          console.log('No transcript entries found in response');
        }
      } else {
        console.log('Tavus API response not ok:', tavusResponse.status);
      }
    } catch (error) {
      console.error('Error fetching from Tavus API:', error);
    }
    
    return NextResponse.json({
      conversation_id: conversationId,
      transcript_entries: [],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Transcript polling error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transcript data' },
      { status: 500 }
    );
  }
}
