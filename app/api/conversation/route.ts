import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: Request) {
    const apiKey = process.env.TAVUS_API_KEY;
    const replicaId = process.env.TAVUS_REPLICA_ID;
    const personaId = process.env.TAVUS_PERSONA_ID;

    if (!apiKey || !replicaId || !personaId) {
        return NextResponse.json(
            { error: 'Missing environment variables' },
            { status: 500 }
        );
    }

    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email || 'anonymous';

    let body;
    try {
        body = await request.json();
    } catch (e) {
        body = {};
    }
    
    const conversationalContext = body.conversational_context || '';
    const tripDetails = body.trip_details;

    let enhancedContext = conversationalContext + '\n\nIMPORTANT: Please collect the following information from the user in order:\n';
    enhancedContext += '1. Their travel budget preference (budget-friendly, mid-range, or luxury)\n';
    enhancedContext += '2. Their comfort with long walking distances (comfortable with lots of walking or prefer shorter distances)\n';
    enhancedContext += '3. Whether they prefer daytime or nighttime activities\n';
    enhancedContext += '4. Who they are traveling with (solo, family, friends, or partner)\n\n';
    enhancedContext += 'This is a NEW conversation with a NEW user. Start fresh and introduce yourself. After collecting ALL this information, say goodbye and tell them their preferences have been saved.';

    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const webhookUrl = `${baseUrl}/api/tavus/webhook`;
    const transcriptWebhookUrl = `${baseUrl}/api/tavus/transcript`;
    const conversationName = `Trip_${userEmail}_${Date.now()}`;

    console.log('Creating Tavus conversation with context:', enhancedContext);

    try {
        const response = await fetch('https://tavusapi.com/v2/conversations', {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                replica_id: replicaId,
                persona_id: personaId,
                conversation_name: conversationName,
                conversational_context: enhancedContext,
                callback_url: webhookUrl,
                properties: {
                    max_call_duration: 900,
                    enable_recording: true,
                    enable_transcription: true,
                    language: "english"
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Tavus API error:', errorData);
            return NextResponse.json(
                { error: 'Failed to create conversation', details: errorData },
                { status: response.status }
            );
        }

        const data = await response.json();
        console.log('Tavus conversation created:', data.conversation_id);
        
        return NextResponse.json({
            conversation_id: data.conversation_id,
            conversation_url: data.conversation_url,
            status: data.status,
        });
    } catch (error) {
        console.error('Error creating conversation:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: String(error) },
            { status: 500 }
        );
    }
}

export async function DELETE(request: Request) {
    const apiKey = process.env.TAVUS_API_KEY;
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('id');

    if (!conversationId) {
        return NextResponse.json(
            { error: 'Missing conversation ID' },
            { status: 400 }
        );
    }

    try {
        await fetch(`https://tavusapi.com/v2/conversations/${conversationId}`, {
            method: 'DELETE',
            headers: {
                'x-api-key': apiKey!,
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to delete conversation', details: error },
            { status: 500 }
        );
    }
}