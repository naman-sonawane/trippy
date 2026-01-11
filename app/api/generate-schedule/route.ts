import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Trip from '@/models/Trip';
import User from '@/models/User';

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000';
const HACK_CLUB_API_KEY = 'sk-hc-v1-0980dcafe29d477fa757a2c1c7f0e2200ccad811c41549f592e8219f20bc7c32';
const HACK_CLUB_API_URL = 'https://ai.hackclub.com/proxy/v1/chat/completions';

// Color options matching the schedule UI
const COLOR_OPTIONS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
];

interface ScheduleItem {
  id: string;
  name: string;
  description: string;
  color: string;
  startTime: string;
  endTime: string;
  day: number;
}

export const POST = async (req: Request) => {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }


    const body = await req.json();
    const { destination, tripId } = body;

    if (!destination || !tripId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await connectDB();

    // Get trip to verify ownership
    const trip = await Trip.findOne({ _id: tripId, userId: session.user.id });
    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    // Get user preferences for context
    const user = await User.findById(session.user.id);
    const userAge = user?.age || 25;

    // Fetch high-confidence items from Python API
    const itemsResponse = await fetch(`${PYTHON_API_URL}/api/high-confidence-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: session.user.id,
        destination,
      }),
    });

    if (!itemsResponse.ok) {
      throw new Error('Failed to fetch high-confidence items');
    }

    const itemsData = await itemsResponse.json();
    const items = itemsData.items || [];

    if (items.length === 0) {
      return NextResponse.json(
        { error: 'No items found for schedule generation' },
        { status: 400 }
      );
    }

    // Create comprehensive prompt for Gemini
    const prompt = createSchedulePrompt(items, destination, userAge);

    // Call Gemini API via Hack Club proxy
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
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to call Gemini API');
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    // Parse JSON from Gemini response
    let scheduleData: ScheduleItem[];
    try {
      // Extract JSON from response (might have markdown code blocks)
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || text.match(/\[[\s\S]*\]/);
      const jsonText = jsonMatch ? jsonMatch[1] || jsonMatch[0] : text;
      scheduleData = JSON.parse(jsonText.trim());
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', text);
      // Fallback: create a simple schedule from items
      scheduleData = createFallbackSchedule(items);
    }

    // Validate and clean schedule items
    scheduleData = validateScheduleItems(scheduleData, items.length);

    // Save schedule to trip
    const updatedTrip = await Trip.findOneAndUpdate(
      { _id: tripId, userId: session.user.id },
      { itinerary: scheduleData },
      { new: true }
    );

    if (!updatedTrip) {
      return NextResponse.json({ error: 'Failed to save schedule' }, { status: 500 });
    }

    // Calculate trip duration (max day + 1)
    const maxDay = Math.max(...scheduleData.map(item => item.day), 0);
    const days = Math.min(Math.max(maxDay + 1, 1), 7);

    return NextResponse.json(
      {
        schedule: scheduleData,
        days,
        tripId: updatedTrip._id.toString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error generating schedule:', error);
    return NextResponse.json(
      { error: 'Failed to generate schedule' },
      { status: 500 }
    );
  }
};

function createSchedulePrompt(items: any[], destination: string, userAge: number): string {
  const itemsJson = JSON.stringify(items, null, 2);
  
  return `You are an expert travel itinerary planner. Create an optimized daily schedule for a ${userAge}-year-old traveler visiting ${destination}.

Available Activities/Places:
${itemsJson}

Instructions:
1. For each activity, research and include:
   - Specific address/location
   - Typical costs (entry fees, tickets, etc.)
   - Opening hours
   - Average visit duration
   - Distance/proximity to other activities

2. Create an optimized schedule considering:
   - Geographic proximity (group nearby activities)
   - Opening hours (don't schedule activities when they're closed)
   - Logical flow (morning activities, afternoon, evening)
   - Typical trip duration for ${destination} (1-7 days, based on number of activities)
   - Realistic time allocations (account for travel between locations)
   - User preferences (age: ${userAge})

3. Determine optimal trip duration (1-7 days) based on:
   - Number of activities
   - Typical visit duration for each
   - Average trip length for ${destination}

4. Output a JSON array of schedule items with this exact structure:
[
  {
    "id": "unique-id-string",
    "name": "Activity/Place Name",
    "description": "Enriched description with address, costs, hours, and key info",
    "color": "#3b82f6",
    "startTime": "09:00",
    "endTime": "11:30",
    "day": 0
  }
]

Requirements:
- "day" must be 0-6 (0 = first day)
- "startTime" and "endTime" must be in "HH:MM" format (24-hour)
- "color" must be one of: ${COLOR_OPTIONS.join(', ')}
- Distribute activities across days logically
- Ensure endTime > startTime for each item
- Include all provided activities
- Add realistic travel time between activities
- Consider opening hours and avoid scheduling closed activities

Return ONLY valid JSON array, no markdown, no explanations.`;
}

function createFallbackSchedule(items: any[]): ScheduleItem[] {
  // Simple fallback: distribute items across days with default times
  const itemsPerDay = Math.ceil(items.length / 3); // 3 days default
  const schedule: ScheduleItem[] = [];
  
  items.forEach((item, index) => {
    const day = Math.floor(index / itemsPerDay);
    const colorIndex = index % COLOR_OPTIONS.length;
    const startHour = 9 + (index % 3) * 3; // 9am, 12pm, 3pm rotation
    
    schedule.push({
      id: `item-${item.id}-${index}`,
      name: item.name,
      description: item.description || `Visit ${item.name} in ${item.location || 'the destination'}`,
      color: COLOR_OPTIONS[colorIndex],
      startTime: `${String(startHour).padStart(2, '0')}:00`,
      endTime: `${String(startHour + 2).padStart(2, '0')}:00`,
      day: Math.min(day, 6),
    });
  });
  
  return schedule;
}

function validateScheduleItems(items: any[], maxItems: number): ScheduleItem[] {
  if (!Array.isArray(items)) {
    return createFallbackSchedule([]);
  }

  const validated: ScheduleItem[] = [];
  const usedIds = new Set<string>();

  items.slice(0, maxItems * 2).forEach((item, index) => {
    // Validate required fields
    if (!item.name || !item.startTime || !item.endTime) {
      return;
    }

    // Generate unique ID if missing
    const id = item.id || `item-${index}-${Date.now()}`;
    if (usedIds.has(id)) {
      return;
    }
    usedIds.add(id);

    // Validate and fix day (0-6)
    let day = parseInt(item.day);
    if (isNaN(day) || day < 0) day = 0;
    if (day > 6) day = 6;

    // Validate time format
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    let startTime = item.startTime;
    let endTime = item.endTime;

    if (!timeRegex.test(startTime)) {
      startTime = '09:00';
    }
    if (!timeRegex.test(endTime)) {
      const [hours, minutes] = startTime.split(':').map(Number);
      const endHours = (hours + 2) % 24;
      endTime = `${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    // Ensure endTime > startTime
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (endMinutes <= startMinutes) {
      const newEndMinutes = startMinutes + 120; // 2 hours default
      const newEndH = Math.floor(newEndMinutes / 60) % 24;
      const newEndM = newEndMinutes % 60;
      endTime = `${String(newEndH).padStart(2, '0')}:${String(newEndM).padStart(2, '0')}`;
    }

    // Validate color
    let color = item.color;
    if (!COLOR_OPTIONS.includes(color)) {
      color = COLOR_OPTIONS[index % COLOR_OPTIONS.length];
    }

    validated.push({
      id,
      name: String(item.name).substring(0, 200),
      description: String(item.description || '').substring(0, 1000),
      color,
      startTime,
      endTime,
      day,
    });
  });

  return validated;
}

