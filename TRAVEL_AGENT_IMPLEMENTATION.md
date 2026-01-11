# travel agent video consultation system

this system integrates tavus ai avatar technology to provide personalized travel planning consultations before users discover places.

## flow

1. user enters trip details (destination, dates) on `/new-trip`
2. system shows ai travel agent video call
3. agent asks questions to gather:
   - age
   - budget
   - walking preference (1-10 scale)
   - day/night preference
   - travel companions
4. conversation is transcribed in real-time using web speech api
5. when call ends, ai analyzes transcript and extracts preferences
6. user sees preferences summary page
7. user proceeds to recommendations with personalized data

## files created

### components
- `components/TravelAgentChat.tsx` - main video chat interface

### api endpoints
- `app/api/tavus/travel-agent/route.ts` - creates tavus conversation
- `app/api/tavus/travel-agent/log/route.ts` - saves transcript and extracts preferences using ai
- `app/api/tavus/travel-agent/webhook/route.ts` - handles tavus callbacks
- `app/api/tavus/objectives/route.ts` - creates structured conversation objectives

### pages
- `app/preferences-summary/page.tsx` - shows extracted preferences before recommendations
- updated `app/new-trip/page.tsx` - shows travel agent call after trip creation

## environment variables needed

```env
TAVUS_API_KEY=your_tavus_api_key
TAVUS_REPLICA_ID=your_replica_id
TAVUS_PERSONA_ID=your_persona_id
AI_API_KEY=your_hackclub_ai_api_key
```

## how it works

### 1. conversation creation
when user clicks "talk to travel agent", the system:
- creates a new tavus conversation with custom prompt
- loads the ai avatar in fullscreen iframe
- starts web speech api for transcription after 4 seconds

### 2. real-time transcription
- uses browser's web speech api (chrome/edge)
- automatically alternates speaker detection (user/agent)
- displays live transcript in side panel
- auto-restarts recognition if it stops

### 3. preference extraction
when call ends:
- sends full transcript to hackclub ai api
- uses google gemini to extract structured preferences
- saves preferences to localstorage
- redirects to summary page

### 4. preferences summary
- displays all extracted preferences with icons
- shows what information will be used for recommendations
- allows user to proceed to swipe interface

## tavus objectives (optional)

the objectives api endpoint creates structured goals for the conversation:
1. gather_age
2. gather_budget
3. gather_walking_preference
4. gather_time_preference
5. gather_travel_companions
6. summarize_preferences

each objective has output variables and transitions to next required objective.

## customization

to change questions or preferences:
1. edit prompt in `app/api/tavus/travel-agent/route.ts`
2. update extraction logic in `app/api/tavus/travel-agent/log/route.ts`
3. modify display in `app/preferences-summary/page.tsx`

## notes

- web speech api only works in chrome/edge browsers
- requires microphone permissions
- tavus conversation has 15-minute max duration
- preferences are stored in localstorage and can be used for recommendation filtering
