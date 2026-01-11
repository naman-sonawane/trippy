import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

interface TranscriptMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface WebhookPayload {
  event_type: string;
  conversation_id: string;
  properties?: {
    transcript?: TranscriptMessage[];
    output_variables?: Record<string, any>;
  };
}

const extractPreferencesFromTranscript = (transcript: TranscriptMessage[]) => {
  const preferences: {
    budget?: string;
    walk?: string;
    dayNight?: string;
    solo?: string;
  } = {};

  const fullConversation = transcript
    .map(msg => `${msg.role}: ${msg.content}`)
    .join('\n')
    .toLowerCase();

  if (fullConversation.includes('budget') || fullConversation.includes('luxury') || fullConversation.includes('mid-range')) {
    if (fullConversation.includes('luxury')) preferences.budget = 'luxury';
    else if (fullConversation.includes('mid-range') || fullConversation.includes('mid range') || fullConversation.includes('moderate')) preferences.budget = 'mid-range';
    else if (fullConversation.includes('budget')) preferences.budget = 'budget';
  }

  if (fullConversation.includes('walk') || fullConversation.includes('distance')) {
    if (fullConversation.includes('comfortable') || fullConversation.includes('lots') || fullConversation.includes('long')) preferences.walk = 'comfortable';
    else if (fullConversation.includes('short') || fullConversation.includes('prefer short')) preferences.walk = 'prefer-short';
  }

  if (fullConversation.includes('day') || fullConversation.includes('night')) {
    if (fullConversation.includes('night') && !fullConversation.includes('day person')) preferences.dayNight = 'night';
    else if (fullConversation.includes('day')) preferences.dayNight = 'day';
  }

  if (fullConversation.includes('travel') || fullConversation.includes('companion')) {
    if (fullConversation.includes('solo') || fullConversation.includes('alone')) preferences.solo = 'solo';
    else if (fullConversation.includes('family')) preferences.solo = 'family';
    else if (fullConversation.includes('friend')) preferences.solo = 'friends';
    else if (fullConversation.includes('partner') || fullConversation.includes('significant other')) preferences.solo = 'partner';
  }

  return preferences;
};

const checkIfAllDataCollected = (preferences: any): boolean => {
  return !!(preferences.budget && preferences.walk && preferences.dayNight && preferences.solo);
};

const checkIfConversationComplete = (transcript: TranscriptMessage[]): boolean => {
  const lastMessages = transcript.slice(-3).map(m => m.content.toLowerCase());
  const farewellKeywords = ['goodbye', 'saved', 'preferences have been saved', 'all set', "you're all set", 'thank you', 'ready to explore'];
  return lastMessages.some(msg => farewellKeywords.some(keyword => msg.includes(keyword)));
};

export const POST = async (req: Request) => {
  try {
    const payload: WebhookPayload = await req.json();

    console.log('Tavus Webhook Event:', payload.event_type);
    console.log('Conversation ID:', payload.conversation_id);

    if (payload.event_type === 'application.transcription_ready') {
      const transcript = payload.properties?.transcript;
      const outputVariables = payload.properties?.output_variables;

      if (!transcript || transcript.length === 0) {
        console.log('No transcript available');
        return NextResponse.json({ received: true });
      }

      console.log('Full Transcript:', JSON.stringify(transcript, null, 2));
      if (outputVariables) {
        console.log('Output Variables:', JSON.stringify(outputVariables, null, 2));
      }

      const extractedPreferences = extractPreferencesFromTranscript(transcript);
      console.log('Extracted Preferences:', extractedPreferences);

      const conversationIdParts = payload.conversation_id.split('_');
      const userEmail = conversationIdParts.length > 1 ? conversationIdParts.slice(1).join('_') : null;

      if (userEmail) {
        try {
          await connectDB();
          
          const user = await User.findOne({ email: userEmail });
          
          if (user) {
            const updateData: any = {};
            
            if (extractedPreferences.budget) updateData.budget = extractedPreferences.budget;
            if (extractedPreferences.walk) updateData.walk = extractedPreferences.walk;
            if (extractedPreferences.dayNight) updateData.dayNight = extractedPreferences.dayNight;
            if (extractedPreferences.solo) {
              updateData.solo = extractedPreferences.solo === 'solo';
            }

            if (Object.keys(updateData).length > 0) {
              await User.findByIdAndUpdate(user._id, updateData, { new: true });
              console.log('Updated user preferences:', updateData);
            }

            const shouldEnd = checkIfAllDataCollected(extractedPreferences) || checkIfConversationComplete(transcript);
            
            if (shouldEnd) {
              console.log('Data collection complete, ending conversation...');
              
              const apiKey = process.env.TAVUS_API_KEY;
              if (apiKey) {
                try {
                  await fetch(`https://tavusapi.com/v2/conversations/${payload.conversation_id}/end`, {
                    method: 'POST',
                    headers: {
                      'x-api-key': apiKey,
                    },
                  });
                  console.log('Conversation ended successfully');
                } catch (endError) {
                  console.error('Error ending conversation:', endError);
                }
              }
            }
          } else {
            console.log('User not found with email:', userEmail);
          }
        } catch (dbError) {
          console.error('Database error:', dbError);
        }
      } else {
        console.log('Could not extract user email from conversation ID');
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error },
      { status: 500 }
    );
  }
};
