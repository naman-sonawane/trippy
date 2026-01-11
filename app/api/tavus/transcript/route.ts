import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('tavus transcript webhook received');
    
    const body = await request.json();
    console.log('transcript webhook data:', JSON.stringify(body, null, 2));
    
    const { 
      conversation_id, 
      transcript_entries = [],
      event_type = 'transcript_update'
    } = body;
    
    if (!conversation_id) {
      console.log('no conversation_id in webhook data');
      return NextResponse.json({ error: 'missing conversation_id' }, { status: 400 });
    }
    
    const processedEntries = transcript_entries.map((entry: any) => ({
      id: entry.id || `transcript_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: entry.text || entry.transcript || '',
      isUser: entry.is_user || entry.speaker === 'user' || false,
      timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date()
    }));
    
    console.log('processed transcript entries:', processedEntries.length);
    
    return NextResponse.json({ 
      success: true, 
      message: 'transcript data received',
      entries_processed: processedEntries.length
    });
    
  } catch (error) {
    console.error('transcript webhook error:', error);
    return NextResponse.json(
      { error: 'failed to process transcript data' },
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
        message: 'tavus transcript endpoint is active',
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`polling transcript for conversation: ${conversationId}`);
    
    try {
      const apiKey = process.env.TAVUS_API_KEY;
      
      if (!apiKey) {
        throw new Error('no tavus api key found');
      }

      const tavusResponse = await fetch(`https://tavusapi.com/v2/conversations/${conversationId}`, {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (tavusResponse.ok) {
        const conversationData = await tavusResponse.json();
        console.log('📦 tavus conversation data:', JSON.stringify(conversationData, null, 2));
        
        if (conversationData.transcript_entries || conversationData.transcript) {
          const transcriptEntries = conversationData.transcript_entries || conversationData.transcript || [];
          
          console.log(`📝 found ${transcriptEntries.length} transcript entries from tavus`);
          
          return NextResponse.json({
            conversation_id: conversationId,
            transcript_entries: transcriptEntries.map((entry: any) => ({
              id: entry.id || `tavus_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              text: entry.text || entry.transcript || '',
              isUser: entry.is_user || entry.speaker === 'user' || false,
              timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date()
            })),
            timestamp: new Date().toISOString()
          });
        } else {
          console.log('⚠️ no transcript_entries or transcript field in response');
        }
      } else {
        console.log('❌ tavus api response not ok:', tavusResponse.status);
        const errorText = await tavusResponse.text();
        console.log('error details:', errorText);
      }
    } catch (error) {
      console.error('error fetching from tavus api:', error);
    }
    
    return NextResponse.json({
      conversation_id: conversationId,
      transcript_entries: [],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('transcript polling error:', error);
    return NextResponse.json(
      { error: 'failed to fetch transcript data' },
      { status: 500 }
    );
  }
}
