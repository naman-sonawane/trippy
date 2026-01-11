import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { personaId } = body;

    if (!personaId) {
      return NextResponse.json(
        { error: 'persona_id is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.TAVUS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'tavus api key not configured' },
        { status: 500 }
      );
    }

    const objectives = {
      data: [
        {
          objective_name: 'gather_age',
          objective_prompt: 'ask the traveler their age in a friendly way. this helps us recommend age-appropriate activities.',
          confirmation_mode: 'auto',
          output_variables: ['age'],
          modality: 'verbal',
          next_required_objectives: ['gather_budget']
        },
        {
          objective_name: 'gather_budget',
          objective_prompt: 'ask about their budget for the trip in dollars. be tactful and explain it helps us find the right options.',
          confirmation_mode: 'auto',
          output_variables: ['budget'],
          modality: 'verbal',
          next_required_objectives: ['gather_walking_preference']
        },
        {
          objective_name: 'gather_walking_preference',
          objective_prompt: 'ask how much they want to walk on a scale of 1-10, where 1 is minimal walking and 10 is lots of walking/hiking.',
          confirmation_mode: 'auto',
          output_variables: ['walking_preference'],
          modality: 'verbal',
          next_required_objectives: ['gather_time_preference']
        },
        {
          objective_name: 'gather_time_preference',
          objective_prompt: 'ask if they prefer daytime activities, nighttime activities, or both.',
          confirmation_mode: 'auto',
          output_variables: ['time_preference'],
          modality: 'verbal',
          next_required_objectives: ['gather_travel_companions']
        },
        {
          objective_name: 'gather_travel_companions',
          objective_prompt: 'ask who they are traveling with (solo, partner, family, friends, etc).',
          confirmation_mode: 'auto',
          output_variables: ['traveling_with'],
          modality: 'verbal',
          next_required_objectives: ['summarize_preferences']
        },
        {
          objective_name: 'summarize_preferences',
          objective_prompt: 'summarize all the information you gathered: age, budget, walking preference, time preference, and travel companions. show enthusiasm and tell them you are ready to find perfect places for their trip.',
          confirmation_mode: 'auto',
          output_variables: [],
          modality: 'verbal',
          next_required_objectives: []
        }
      ]
    };

    console.log('creating objectives for persona:', personaId);

    const response = await fetch('https://tavusapi.com/v2/objectives', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(objectives),
    });

    console.log('tavus objectives response status:', response.status);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = await response.text();
      }
      console.log('tavus objectives api error:', errorData);
      
      return NextResponse.json(
        { 
          error: 'failed to create objectives', 
          details: errorData,
          status: response.status
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('tavus objectives created successfully:', data);

    return NextResponse.json({
      success: true,
      objectives: data
    });

  } catch (error) {
    console.error('objectives api route error:', error);
    return NextResponse.json(
      { error: 'internal server error', details: error instanceof Error ? error.message : 'unknown error' },
      { status: 500 }
    );
  }
}
