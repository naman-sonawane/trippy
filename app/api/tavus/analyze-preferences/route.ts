// app/api/tavus/analyze-preferences/route.ts
import { NextResponse } from 'next/server';

// Helper function for exponential backoff retry
async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000
): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;

            // If it's the last attempt, throw the error
            if (attempt === maxRetries - 1) {
                throw lastError;
            }

            // Calculate delay with exponential backoff
            const delay = initialDelay * Math.pow(2, attempt);
            console.log(`⏳ Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms...`);

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}

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
        const { transcription } = await request.json();

        if (!transcription) {
            return NextResponse.json(
                { error: 'No transcription provided' },
                { status: 400 }
            );
        }

        console.log('🔍 Analyzing preferences from transcription...');
        console.log('📏 Transcription length:', transcription.length);

        const prompt = `Analyze this travel conversation transcript and extract the following metrics:
- Age (numerical value only)
- Budget (per person, include currency if mentioned, e.g., "$2000" or "2000 USD")
- Walk (comfort with long walking distances: "Yes", "No", or "Moderate")
- Day/Night (preference: "Day", "Night", or "Both")
- Solo/Group (traveling style: "Solo", "With Partner", "With Family", "With Friends", or "Group")

Transcript:
${transcription}

Return ONLY a valid JSON object with these exact keys: age, budget, walk, dayNight, soloGroup. 
If any information is not found in the transcript, use "Not mentioned" as the value.
Do not include any markdown formatting, code blocks, or explanatory text - just the JSON object.

Example response format:
{"age":"25","budget":"$3000","walk":"Yes","dayNight":"Day","soloGroup":"With Partner"}`;

        // Use retry logic for the API call with longer delays
        let data;
        try {
            data = await retryWithBackoff(async () => {
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            contents: [{
                                parts: [{
                                    text: prompt
                                }]
                            }],
                            generationConfig: {
                                temperature: 0.1,
                                maxOutputTokens: 500,
                            }
                        })
                    }
                );

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`❌ Gemini API error (${response.status}):`, errorText);

                    // Parse error details if possible
                    try {
                        const errorData = JSON.parse(errorText);
                        console.error('📋 Error details:', errorData);
                    } catch {
                        console.error('📋 Raw error:', errorText);
                    }

                    // Throw error to trigger retry for rate limits
                    if (response.status === 429) {
                        throw new Error('Rate limit exceeded, retrying...');
                    }

                    // For other errors, throw with status
                    throw new Error(`API error ${response.status}: ${errorText}`);
                }

                return await response.json();
            }, 4, 3000); // 4 retries, starting with 3 second delay (3s, 6s, 12s, 24s)
        } catch (apiError) {
            console.error('❌ Failed after all retries:', apiError);

            // If API completely fails, return default preferences with 200 status
            const defaultPreferences = {
                age: "Not mentioned",
                budget: "Not mentioned",
                walk: "Not mentioned",
                dayNight: "Not mentioned",
                soloGroup: "Not mentioned"
            };

            console.log('⚠️ Returning default preferences due to API failure');

            // Return 200 status with warning so the client doesn't treat it as an error
            return NextResponse.json({
                preferences: defaultPreferences,
                timestamp: new Date().toISOString(),
                warning: 'API rate limit exceeded - using default preferences'
            }, { status: 200 });
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        console.log('📤 Raw Gemini response:', text);

        // Clean up the response - remove markdown code blocks if present
        let cleanText = text.trim();
        cleanText = cleanText.replace(/```json\s*/g, '');
        cleanText = cleanText.replace(/```\s*/g, '');
        cleanText = cleanText.trim();

        console.log('🧹 Cleaned response:', cleanText);

        // Parse the JSON
        let preferences;
        try {
            preferences = JSON.parse(cleanText);

            // Validate that all required keys exist
            const requiredKeys = ['age', 'budget', 'walk', 'dayNight', 'soloGroup'];
            const missingKeys = requiredKeys.filter(key => !(key in preferences));

            if (missingKeys.length > 0) {
                console.warn('⚠️ Missing keys in response:', missingKeys);
                // Add missing keys with default values
                missingKeys.forEach(key => {
                    preferences[key] = "Not mentioned";
                });
            }

        } catch (parseError) {
            console.error('❌ JSON parse error:', parseError);
            console.error('📄 Failed to parse:', cleanText);

            // Return default values if parsing fails
            preferences = {
                age: "Not mentioned",
                budget: "Not mentioned",
                walk: "Not mentioned",
                dayNight: "Not mentioned",
                soloGroup: "Not mentioned"
            };
        }

        console.log('✅ Preferences extracted:', preferences);

        return NextResponse.json({
            preferences,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Unexpected error in analysis:', error);
        console.error('📋 Error stack:', error instanceof Error ? error.stack : 'No stack trace');

        return NextResponse.json(
            {
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error',
                preferences: {
                    age: "Not mentioned",
                    budget: "Not mentioned",
                    walk: "Not mentioned",
                    dayNight: "Not mentioned",
                    soloGroup: "Not mentioned"
                }
            },
            { status: 500 }
        );
    }
}