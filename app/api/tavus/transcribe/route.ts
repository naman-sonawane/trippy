// app/api/tavus/transcribe/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error('❌ Missing GEMINI_API_KEY environment variable');
        return NextResponse.json(
            { error: 'Missing GEMINI_API_KEY environment variable' },
            { status: 500 }
        );
    }

    try {
        const { audioData, speaker } = await request.json();

        if (!audioData) {
            console.warn('⚠️ No audio data provided in request');
            return NextResponse.json(
                { error: 'No audio data provided' },
                { status: 400 }
            );
        }

        console.log('🎤 Transcribing audio for speaker:', speaker);
        console.log('📦 Audio data length:', audioData.length);

        // Using Gemini 2.5 Flash - fast and capable model
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            {
                                text: "Please transcribe this audio conversation between a travel agent and a customer. Return only the spoken text with speaker labels (e.g., 'Agent: ...' or 'Customer: ...'). Be accurate and detailed."
                            },
                            {
                                inline_data: {
                                    mime_type: 'audio/webm',
                                    data: audioData
                                }
                            }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 8000, // Increased for longer conversations
                    }
                })
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ Gemini API error:', errorData);
            return NextResponse.json(
                { error: 'Gemini API error', details: errorData },
                { status: response.status }
            );
        }

        const data = await response.json();
        console.log('📥 Gemini response received');

        // Extract transcription from response
        const transcription = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        console.log('✅ Transcription successful:', {
            speaker,
            textLength: transcription.length,
            preview: transcription.substring(0, 100)
        });

        return NextResponse.json({
            transcription: transcription.trim(),
            speaker,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Transcription error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}