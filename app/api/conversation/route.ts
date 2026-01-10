import { NextResponse } from 'next/server';

export async function POST() {
    const apiKey = process.env.TAVUS_API_KEY;
    const replicaId = process.env.TAVUS_REPLICA_ID;
    const personaId = process.env.TAVUS_PERSONA_ID;

    if (!apiKey || !replicaId || !personaId) {
        return NextResponse.json(
            { error: 'Missing environment variables' },
            { status: 500 }
        );
    }

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
                conversation_name: 'Travel Planning Session',
                conversational_context: `You are an expert travel agent helping users plan their perfect trip. Your goal is to gather key information to provide personalized recommendations.

Ask the following questions in a friendly, conversational manner (one at a time):
1. What is your age? (This helps us recommend age-appropriate activities)
2. What's your budget range? (Options: low, medium, high)
3. How much do you like to walk during trips? (Options: minimal, moderate, a lot)
4. Do you prefer daytime activities or nightlife? (Options: day, night, both)
5. Are you traveling solo or with others? (Options: solo, with others)

After gathering all information, summarize what they told you and let them know they can now explore personalized recommendations by swiping through places and activities.

Store their responses in a structured format.`,
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