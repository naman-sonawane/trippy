import { NextRequest, NextResponse } from 'next/server';

const HACK_CLUB_API_URL = 'https://ai.hackclub.com/proxy/v1/chat/completions';

export async function POST(request: NextRequest) {
  const apiKey = process.env.AI_API_KEY;

  if (!apiKey) {
    console.error('❌ Missing AI_API_KEY environment variable');
    return NextResponse.json(
      { error: 'Missing AI_API_KEY environment variable' },
      { status: 500 }
    );
  }

  try {
    const { city } = await request.json();

    if (!city) {
      return NextResponse.json(
        { error: 'City name is required' },
        { status: 400 }
      );
    }

    const prompt = `Find the main international airport for the city "${city}". 
Return ONLY a JSON object with this exact format:
{
  "airportCode": "XXX",
  "airportName": "Full Airport Name",
  "city": "${city}"
}

The airportCode must be a valid 3-letter IATA airport code (e.g., "JFK", "LAX", "LHR").
If the city has multiple airports, return the main/busiest international airport.
If you cannot find a valid airport, return null for airportCode.

Do not include any markdown formatting, code blocks, or explanatory text - just the JSON object.`;

    const response = await fetch(HACK_CLUB_API_URL, {
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
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Hack Club API error (${response.status}):`, errorText);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    let airportData;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        airportData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse API response:', text);
      return NextResponse.json(
        { error: 'Failed to parse airport information' },
        { status: 500 }
      );
    }

    return NextResponse.json(airportData, { status: 200 });
  } catch (error) {
    console.error('Error finding airport:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to find airport' },
      { status: 500 }
    );
  }
}
