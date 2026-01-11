import { NextResponse } from 'next/server';

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

    // Get trip details from request body
    const body = await request.json().catch(() => ({}));
    const conversationalContext = body.conversational_context || '';

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
                conversation_name: 'Travel Agent Conversation',
                conversational_context: conversationalContext,
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            return NextResponse.json(
                { error: 'Failed to create conversation', details: errorData },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json({
            conversation_id: data.conversation_id,
            conversation_url: data.conversation_url,
            status: data.status,
        });
    } catch (error) {
        return NextResponse.json(
            { error: 'Internal server error', details: error },
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