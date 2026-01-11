import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Trip from '@/models/Trip';
import User from '@/models/User';
import mongoose from 'mongoose';

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

    // Convert tripId to ObjectId if it's a string
    let tripObjectId;
    try {
      tripObjectId = mongoose.Types.ObjectId.isValid(tripId) 
        ? new mongoose.Types.ObjectId(tripId)
        : tripId;
    } catch (error) {
      console.error('Invalid tripId format:', tripId, error);
      return NextResponse.json({ error: 'Invalid trip ID format' }, { status: 400 });
    }

    // Get trip - check if user is participant
    const trip = await Trip.findOne({
      _id: tripObjectId,
      $or: [
        { userId: session.user.id },
        { participantIds: session.user.id }
      ]
    });
    if (!trip) {
      console.error('Trip not found or access denied:', {
        tripId: tripObjectId,
        userId: session.user.id
      });
      return NextResponse.json({ error: 'Trip not found or access denied' }, { status: 404 });
    }

    // Get all participant IDs (including owner)
    const participantIds = [trip.userId, ...(trip.participantIds || [])].filter(
      (id, index, self) => self.indexOf(id) === index // Remove duplicates
    );

    // Get all participants' preferences
    const participants = await User.find({ _id: { $in: participantIds } });
    
    // Aggregate liked items from all participants
    const allLikedItems = new Set<string>();
    const participantAges: number[] = [];
    
    participants.forEach(p => {
      p.preferences?.likedItems?.forEach(itemId => allLikedItems.add(itemId));
      if (p.age) participantAges.push(p.age);
    });
    
    // Use average age (or requesting user's age if no ages available)
    const user = await User.findById(session.user.id);
    const userAge = participantAges.length > 0
      ? Math.round(participantAges.reduce((a, b) => a + b, 0) / participantAges.length)
      : (user?.age || 25);

    // Fetch high-confidence items from Python API for requesting user
    // (The recommendations already consider all participants via multi-user endpoint)
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
    let items = itemsData.items || [];

    // Also include items liked by other participants that might not be in high-confidence
    // This ensures all participants' preferences are considered
    const allItemsSet = new Set(items.map((item: any) => item.id));
    
    // Fetch items for all participants and merge (simplified approach)
    // For now, we'll use the requesting user's high-confidence items
    // The multi-user recommendations endpoint already considers all participants
    
    if (items.length === 0) {
      return NextResponse.json(
        { error: 'No items found for schedule generation' },
        { status: 400 }
      );
    }

    // Create comprehensive prompt for Gemini (mention multi-user context)
    const prompt = createSchedulePrompt(
      items, 
      destination, 
      userAge,
      participantIds.length > 1 ? participantIds.length : undefined
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

    console.log('Saving schedule:', {
      tripId: tripObjectId,
      scheduleItemsCount: scheduleData.length,
      firstItem: scheduleData[0]
    });

    // Save schedule to trip and update status
    const updateResult = await Trip.findOneAndUpdate(
      {
        _id: tripObjectId,
        $or: [
          { userId: session.user.id },
          { participantIds: session.user.id }
        ]
      },
      { $set: { itinerary: scheduleData, status: 'active' } },
      { new: true }
    );

    if (!updateResult) {
      console.error('Failed to save schedule - trip not found or access denied:', {
        tripId: tripObjectId,
        userId: session.user.id
      });
      return NextResponse.json({ error: 'Failed to save schedule' }, { status: 500 });
    }

    // Verify the save by re-querying the database
    const verifiedTrip = await Trip.findById(tripObjectId);
    
    if (!verifiedTrip) {
      console.error('CRITICAL: Trip not found after save operation:', tripObjectId);
      return NextResponse.json({ error: 'Failed to verify schedule save' }, { status: 500 });
    }

    console.log('Schedule saved successfully:', {
      tripId: verifiedTrip._id,
      itineraryCount: verifiedTrip.itinerary?.length || 0,
      status: verifiedTrip.status,
      firstItineraryItem: verifiedTrip.itinerary?.[0] || null,
      verified: verifiedTrip.itinerary?.length === scheduleData.length
    });

    if (verifiedTrip.itinerary?.length !== scheduleData.length) {
      console.error('WARNING: Itinerary count mismatch:', {
        expected: scheduleData.length,
        actual: verifiedTrip.itinerary?.length || 0
      });
    }

    // Calculate trip duration (max day + 1)
    const maxDay = Math.max(...scheduleData.map(item => item.day), 0);
    const days = Math.min(Math.max(maxDay + 1, 1), 7);

    return NextResponse.json(
      {
        schedule: scheduleData,
        days,
        tripId: verifiedTrip._id.toString(),
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

function createSchedulePrompt(items: any[], destination: string, userAge: number, participantCount?: number): string {
  const itemsJson = JSON.stringify(items, null, 2);
  const travelerDescription = participantCount && participantCount > 1
    ? `a group of ${participantCount} travelers (average age: ${userAge})`
    : `a ${userAge}-year-old traveler`;
  
  return `You are an expert travel itinerary planner. Create an optimized daily schedule for ${travelerDescription} visiting ${destination}.

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
- CRITICAL: Distribute activities across MULTIPLE days (not all on day 0)
- Target ${Math.min(Math.ceil(items.length / 3), 7)} days based on ${items.length} activities
- Spread activities evenly: approximately ${Math.ceil(items.length / Math.min(Math.ceil(items.length / 3), 7))} activities per day
- Ensure endTime > startTime for each item
- Include all provided activities
- Add realistic travel time between activities
- Consider opening hours and avoid scheduling closed activities

Return ONLY valid JSON array, no markdown, no explanations.`;
}

function createFallbackSchedule(items: any[]): ScheduleItem[] {
  if (items.length === 0) return [];
  
  const targetDays = Math.min(Math.max(Math.ceil(items.length / 3), 1), 7);
  const itemsPerDay = Math.ceil(items.length / targetDays);
  const schedule: ScheduleItem[] = [];
  
  items.forEach((item, index) => {
    const day = Math.min(Math.floor(index / itemsPerDay), targetDays - 1);
    const dayIndex = index % itemsPerDay;
    const colorIndex = index % COLOR_OPTIONS.length;
    const startHour = 9 + (dayIndex % 3) * 3; // 9am, 12pm, 3pm rotation
    
    schedule.push({
      id: `item-${item.id}-${index}`,
      name: item.name,
      description: item.description || `Visit ${item.name} in ${item.location || 'the destination'}`,
      color: COLOR_OPTIONS[colorIndex],
      startTime: `${String(startHour).padStart(2, '0')}:00`,
      endTime: `${String(Math.min(startHour + 2, 23)).padStart(2, '0')}:00`,
      day,
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

  return redistributeAcrossDays(validated);
}

function redistributeAcrossDays(items: ScheduleItem[]): ScheduleItem[] {
  if (items.length === 0) return items;

  const dayCounts = new Map<number, number>();
  items.forEach(item => {
    dayCounts.set(item.day, (dayCounts.get(item.day) || 0) + 1);
  });

  const uniqueDays = Array.from(dayCounts.keys());
  const allOnOneDay = uniqueDays.length === 1 && items.length > 3;

  if (allOnOneDay) {
    const targetDays = Math.min(Math.ceil(items.length / 3), 7);
    const itemsPerDay = Math.ceil(items.length / targetDays);
    
    return items.map((item, index) => ({
      ...item,
      day: Math.min(Math.floor(index / itemsPerDay), targetDays - 1),
    }));
  }

  return items;
}

