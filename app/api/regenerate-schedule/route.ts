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

interface TimeSelection {
  day: number;
  startTime: string;
  endTime: string;
}

export const POST = async (req: Request) => {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }


    const body = await req.json();
    const { tripId, timeSelection } = body;

    if (!tripId || !timeSelection) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const { day, startTime, endTime } = timeSelection as TimeSelection;

    if (day === undefined || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Invalid time selection' },
        { status: 400 }
      );
    }

    await connectDB();

    // Get trip - check if user is participant
    const trip = await Trip.findOne({
      _id: tripId,
      $or: [
        { userId: session.user.id },
        { participantIds: session.user.id }
      ]
    });
    if (!trip) {
      return NextResponse.json({ error: 'Trip not found or access denied' }, { status: 404 });
    }

    const destination = trip.destination;
    const currentItinerary = (trip.itinerary || []) as ScheduleItem[];

    // Get user preferences for context
    const user = await User.findById(session.user.id);
    const userAge = user?.age || 25;

    // Find activities in the selected time slot
    const activitiesInTimeSlot = getActivitiesInTimeSlot(
      currentItinerary,
      day,
      startTime,
      endTime
    );

    // Get other activities in the same day (for context/constraints)
    const otherDayActivities = getOtherActivitiesInDay(
      currentItinerary,
      day,
      startTime,
      endTime
    );

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
    const availableItems = itemsData.items || [];

    if (availableItems.length === 0) {
      return NextResponse.json(
        { error: 'No recommendations available' },
        { status: 400 }
      );
    }

    // Create prompt for regeneration
    const prompt = createRegeneratePrompt(
      activitiesInTimeSlot,
      otherDayActivities,
      availableItems,
      destination,
      day,
      startTime,
      endTime,
      userAge
    );

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
    let newActivities: ScheduleItem[];
    try {
      // Extract JSON from response (might have markdown code blocks)
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || text.match(/\[[\s\S]*\]/);
      const jsonText = jsonMatch ? jsonMatch[1] || jsonMatch[0] : text;
      newActivities = JSON.parse(jsonText.trim());
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', text);
      // Fallback: create simple activities from available items
      newActivities = createFallbackActivities(
        availableItems,
        day,
        startTime,
        endTime
      );
    }

    // Validate and clean new activities
    newActivities = validateScheduleItems(newActivities, startTime, endTime, day);

    // Remove old activities in time slot and add new ones
    const updatedItinerary = [
      ...currentItinerary.filter((item) => !activitiesInTimeSlot.some((old) => old.id === item.id)),
      ...newActivities,
    ];

    // Save updated itinerary to trip
    const updatedTrip = await Trip.findOneAndUpdate(
      {
        _id: tripId,
        $or: [
          { userId: session.user.id },
          { participantIds: session.user.id }
        ]
      },
      { itinerary: updatedItinerary },
      { new: true }
    );

    if (!updatedTrip) {
      return NextResponse.json({ error: 'Failed to save schedule' }, { status: 500 });
    }

    return NextResponse.json(
      {
        itinerary: updatedItinerary,
        regeneratedItems: newActivities,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error regenerating schedule:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate schedule' },
      { status: 500 }
    );
  }
};

function getActivitiesInTimeSlot(
  items: ScheduleItem[],
  day: number,
  startTime: string,
  endTime: string
): ScheduleItem[] {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  return items.filter((item) => {
    if (item.day !== day) return false;
    
    const itemStart = timeToMinutes(item.startTime);
    const itemEnd = timeToMinutes(item.endTime);
    
    // Check if activity overlaps with time slot
    return itemStart < endMinutes && itemEnd > startMinutes;
  });
}

function getOtherActivitiesInDay(
  items: ScheduleItem[],
  day: number,
  startTime: string,
  endTime: string
): ScheduleItem[] {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  return items.filter((item) => {
    if (item.day !== day) return false;
    
    const itemStart = timeToMinutes(item.startTime);
    const itemEnd = timeToMinutes(item.endTime);
    
    // Exclude activities that overlap with time slot
    return !(itemStart < endMinutes && itemEnd > startMinutes);
  });
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function createRegeneratePrompt(
  activitiesToReplace: ScheduleItem[],
  otherDayActivities: ScheduleItem[],
  availableItems: any[],
  destination: string,
  day: number,
  startTime: string,
  endTime: string,
  userAge: number
): string {
  const availableItemsJson = JSON.stringify(availableItems, null, 2);
  const activitiesToReplaceJson = JSON.stringify(activitiesToReplace, null, 2);
  const otherDayActivitiesJson = JSON.stringify(otherDayActivities, null, 2);

  const timeSlotDuration = timeToMinutes(endTime) - timeToMinutes(startTime);
  const hours = Math.floor(timeSlotDuration / 60);
  const minutes = timeSlotDuration % 60;
  const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  return `You are an expert travel itinerary planner. Regenerate activities for a specific time slot on day ${day + 1} of a trip to ${destination}.

TIME SLOT TO FILL:
- Day: ${day + 1}
- Start Time: ${startTime}
- End Time: ${endTime}
- Duration: ${durationText}

ACTIVITIES TO REPLACE (currently in this time slot):
${activitiesToReplaceJson}

OTHER ACTIVITIES ON THE SAME DAY (avoid conflicts):
${otherDayActivitiesJson}

AVAILABLE RECOMMENDATIONS (choose from these):
${availableItemsJson}

Instructions:
1. Generate NEW activities that fit within the time slot (${startTime} to ${endTime})
2. Ensure activities don't overlap with other day activities
3. Consider geographic proximity to other activities
4. Account for opening hours and realistic visit durations
5. User age: ${userAge} years old
6. Optimize for the available time (${durationText})
7. You can split the time slot into multiple activities or use it for one longer activity

Output format: JSON array with this exact structure:
[
  {
    "id": "unique-id-string",
    "name": "Activity Name",
    "description": "Enriched description with address, costs, hours",
    "color": "#3b82f6",
    "startTime": "${startTime}",
    "endTime": "${endTime}",
    "day": ${day}
  }
]

Requirements:
- All activities must fit within ${startTime} to ${endTime}
- "day" must be ${day}
- "startTime" and "endTime" must be in "HH:MM" format (24-hour)
- "color" must be one of: ${COLOR_OPTIONS.join(', ')}
- Don't overlap with other day activities
- Activities must be sequential (no gaps unless necessary for travel time)

Return ONLY valid JSON array, no markdown, no explanations.`;
}

function createFallbackActivities(
  availableItems: any[],
  day: number,
  startTime: string,
  endTime: string
): ScheduleItem[] {
  // Simple fallback: use first available item for the time slot
  if (availableItems.length === 0) return [];

  const item = availableItems[0];
  const colorIndex = 0;

  return [
    {
      id: `item-${item.id}-${Date.now()}`,
      name: item.name,
      description: item.description || `Visit ${item.name} in ${item.location || 'the destination'}`,
      color: COLOR_OPTIONS[colorIndex],
      startTime,
      endTime,
      day,
    },
  ];
}

function validateScheduleItems(
  items: any[],
  startTime: string,
  endTime: string,
  day: number
): ScheduleItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  const validated: ScheduleItem[] = [];
  const usedIds = new Set<string>();
  const slotStart = timeToMinutes(startTime);
  const slotEnd = timeToMinutes(endTime);

  items.forEach((item, index) => {
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

    // Validate day
    let itemDay = parseInt(item.day);
    if (isNaN(itemDay) || itemDay !== day) {
      itemDay = day;
    }

    // Validate time format and ensure within time slot
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    let itemStartTime = item.startTime;
    let itemEndTime = item.endTime;

    if (!timeRegex.test(itemStartTime)) {
      itemStartTime = startTime;
    }
    if (!timeRegex.test(itemEndTime)) {
      itemEndTime = endTime;
    }

    // Ensure times are within the time slot
    let itemStart = timeToMinutes(itemStartTime);
    let itemEnd = timeToMinutes(itemEndTime);

    if (itemStart < slotStart) {
      itemStart = slotStart;
      itemStartTime = startTime;
    }
    if (itemEnd > slotEnd) {
      itemEnd = slotEnd;
      itemEndTime = endTime;
    }

    // Ensure endTime > startTime
    if (itemEnd <= itemStart) {
      itemEnd = Math.min(itemStart + 120, slotEnd); // 2 hours default, capped by slot
      const newEndH = Math.floor(itemEnd / 60) % 24;
      const newEndM = itemEnd % 60;
      itemEndTime = `${String(newEndH).padStart(2, '0')}:${String(newEndM).padStart(2, '0')}`;
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
      startTime: itemStartTime,
      endTime: itemEndTime,
      day: itemDay,
    });
  });

  return validated;
}

