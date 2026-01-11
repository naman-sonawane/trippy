import { NextResponse } from 'next/server';

export const POST = async () => {
  const apiKey = process.env.TAVUS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing TAVUS_API_KEY' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch('https://tavusapi.com/v2/objectives', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: [
          {
            objective_name: 'collect_budget',
            objective_prompt: 'Ask the user about their travel budget. Ask if they prefer budget-friendly, mid-range, or luxury options. Store their answer as one of: "budget", "mid-range", or "luxury".',
            confirmation_mode: 'auto',
            output_variables: ['budget'],
            modality: 'verbal',
            next_required_objectives: ['collect_walking_preference'],
          },
          {
            objective_name: 'collect_walking_preference',
            objective_prompt: 'Ask the user about their comfort with walking long distances. Ask if they are comfortable with lots of walking or prefer shorter distances. Store their answer as one of: "comfortable" or "prefer-short".',
            confirmation_mode: 'auto',
            output_variables: ['walking_preference'],
            modality: 'verbal',
            next_required_objectives: ['collect_time_preference'],
          },
          {
            objective_name: 'collect_time_preference',
            objective_prompt: 'Ask the user if they are more of a day person or night person. Ask if they prefer daytime activities or nighttime activities. Store their answer as one of: "day" or "night".',
            confirmation_mode: 'auto',
            output_variables: ['time_preference'],
            modality: 'verbal',
            next_required_objectives: ['collect_travel_companions'],
          },
          {
            objective_name: 'collect_travel_companions',
            objective_prompt: 'Ask the user who they are traveling with. Ask if they are traveling solo, with family, with friends, or with a partner. Store their answer as one of: "solo", "family", "friends", or "partner".',
            confirmation_mode: 'auto',
            output_variables: ['travel_companions'],
            modality: 'verbal',
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: 'Failed to create objectives', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error },
      { status: 500 }
    );
  }
};

export const GET = async () => {
  const apiKey = process.env.TAVUS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing TAVUS_API_KEY' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch('https://tavusapi.com/v2/objectives', {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: 'Failed to get objectives', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error },
      { status: 500 }
    );
  }
};
