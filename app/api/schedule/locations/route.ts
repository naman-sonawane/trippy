import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const HACK_CLUB_API_KEY = 'sk-hc-v1-0980dcafe29d477fa757a2c1c7f0e2200ccad811c41549f592e8219f20bc7c32';
const HACK_CLUB_API_URL = 'https://ai.hackclub.com/proxy/v1/chat/completions';

interface ScheduleItem {
  id: string;
  name: string;
  description: string;
  color: string;
  startTime: string;
  endTime: string;
  day: number;
}

interface Location {
  name: string;
  lat: number;
  lng: number;
}

export const POST = async (req: Request) => {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { itinerary, destination } = body;

    if (!itinerary || !Array.isArray(itinerary) || !destination) {
      return NextResponse.json(
        { error: 'Missing required fields: itinerary (array) and destination' },
        { status: 400 }
      );
    }

    if (itinerary.length === 0) {
      return NextResponse.json({ locations: [] }, { status: 200 });
    }

    const itineraryText = itinerary
      .map((item: ScheduleItem) => `- ${item.name}${item.description ? `: ${item.description}` : ''}`)
      .join('\n');

    const prompt = `Given this travel itinerary for ${destination}, determine the exact geographic coordinates (latitude and longitude) for each activity/place mentioned.

Itinerary:
${itineraryText}

For each activity, provide the precise location coordinates. If you cannot determine the exact location, use the best estimate based on the activity name and description in the context of ${destination}.

Return ONLY a JSON array in this format, no markdown formatting:
[
  {
    "name": "Activity Name",
    "lat": 40.7128,
    "lng": -74.0060
  }
]`;

    const response = await fetch(HACK_CLUB_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HACK_CLUB_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-preview',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      throw new Error('Failed to call Gemini API');
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    let locations: Location[];
    try {
      const cleanedText = text.trim().replace(/```json/g, '').replace(/```/g, '').trim();
      const jsonMatch = cleanedText.match(/\[[\s\S]*\]/);
      const jsonText = jsonMatch ? jsonMatch[0] : cleanedText;
      locations = JSON.parse(jsonText);
      
      if (!Array.isArray(locations)) {
        throw new Error('Response is not an array');
      }

      locations = locations.filter((loc: any) => 
        loc && 
        typeof loc.name === 'string' && 
        typeof loc.lat === 'number' && 
        typeof loc.lng === 'number' &&
        !isNaN(loc.lat) && 
        !isNaN(loc.lng)
      );
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', text);
      return NextResponse.json(
        { error: 'Failed to parse location data from AI response' },
        { status: 500 }
      );
    }

    return NextResponse.json({ locations }, { status: 200 });
  } catch (error) {
    console.error('Error extracting locations:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
};

