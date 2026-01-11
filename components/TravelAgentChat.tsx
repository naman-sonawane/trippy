'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Video, Mic, MicOff, PhoneOff, Loader2, AlertCircle } from 'lucide-react';

interface Log {
    time: string;
    message: string;
}

interface DailyCallObject {
    join: (options?: any) => Promise<void>;
    leave: () => Promise<void>;
    setLocalAudio: (enabled: boolean) => void;
    on: (event: string, handler: (e?: any) => void) => void;
    destroy: () => Promise<void>;
}

declare global {
    interface Window {
        DailyIframe: {
            createCallObject: (options?: any) => DailyCallObject;
        };
    }
}

interface TravelPreferences {
    age: string;
    budget: string;
    walk: string;
    dayNight: string;
    soloGroup: string;
}

interface TravelAgentChatProps {
    destination: string;
    startDate: string;
    endDate: string;
    onEnd?: () => void;
}

interface TravelAgentComponentProps {
    tripDetails: {
        destination: string;
        startDate: string;
        endDate: string;
    } | null;
    onConversationEnd?: (transcript?: string, preferences?: TravelPreferences) => void;
}

function TravelAgentComponent({ tripDetails, onConversationEnd }: TravelAgentComponentProps) {
    const [conversationId, setConversationId] = useState<string>('');
    const [conversationUrl, setConversationUrl] = useState<string>('');
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isMuted, setIsMuted] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [logs, setLogs] = useState<Log[]>([]);
    const [dailyLoaded, setDailyLoaded] = useState<boolean>(false);
    const [autoStarted, setAutoStarted] = useState<boolean>(false);
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
    const [preferences, setPreferences] = useState<TravelPreferences | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const callObjectRef = useRef<DailyCallObject | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const localStreamRef = useRef<MediaStream | null>(null);
    const remoteStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);

    const addLog = (message: string): void => {
        setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), message }]);
    };

    // Load Daily.co SDK
    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@daily-co/daily-js';
        script.async = true;
        script.onload = () => {
            setDailyLoaded(true);
            addLog('✅ Daily.co SDK loaded');
        };
        document.body.appendChild(script);

        return () => {
            if (callObjectRef.current) {
                callObjectRef.current.destroy();
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, []);

    // Auto-start conversation when Daily is loaded
    useEffect(() => {
        if (dailyLoaded && !autoStarted && !isConnected) {
            setAutoStarted(true);
            startConversation();
        }
    }, [dailyLoaded, autoStarted, isConnected]);

    const startConversation = async (): Promise<void> => {
        if (!dailyLoaded) {
            setError('Daily.co SDK is still loading...');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            addLog('🔄 Creating conversation...');

            // Build conversational context with trip details
            let conversationalContext = 'You are a helpful AI travel assistant. ';
            if (tripDetails) {
                conversationalContext += `The user is planning a trip to ${tripDetails.destination} from ${tripDetails.startDate} to ${tripDetails.endDate}. `;
                conversationalContext += `Ask them about their preferences for activities, dining, budget, and travel style to help recommend the best places and experiences in ${tripDetails.destination}.`;
            } else {
                conversationalContext += 'Help the user plan their travel itinerary by asking about their destination, dates, and preferences.';
            }

            // Call the updated API endpoint
            const response = await fetch('/api/tavus/travel-agent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    conversational_context: conversationalContext,
                    trip_details: tripDetails,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create conversation');
            }

            const data = await response.json();
            setConversationId(data.conversation_id);
            setConversationUrl(data.conversation_url);
            addLog('✅ Conversation created');

            // Join with custom Daily UI
            await joinCall(data.conversation_url);

            setIsConnected(true);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            setError(errorMessage);
            addLog(`❌ ${errorMessage}`);
            console.error('❌ Error starting conversation:', err);
            setIsLoading(false);
        }
    };

    const startRecording = (localStream: MediaStream, remoteStream: MediaStream): void => {
        try {
            console.log('🎙️ Starting mixed audio recording...');

            // Create AudioContext for mixing streams
            const audioContext = new AudioContext();
            audioContextRef.current = audioContext;

            // Create sources from both streams
            const localSource = audioContext.createMediaStreamSource(localStream);
            const remoteSource = audioContext.createMediaStreamSource(remoteStream);

            // Create destination for mixed audio
            const destination = audioContext.createMediaStreamDestination();

            // Connect both sources to the destination
            localSource.connect(destination);
            remoteSource.connect(destination);

            console.log('🔊 Audio streams mixed successfully');

            // Record the mixed stream
            const mediaRecorder = new MediaRecorder(destination.stream, {
                mimeType: 'audio/webm'
            });

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                    console.log('📦 Audio chunk collected:', event.data.size, 'bytes');
                }
            };

            mediaRecorder.onstop = () => {
                console.log('🛑 Recording stopped. Total chunks:', audioChunksRef.current.length);
                // Clean up audio context
                if (audioContextRef.current) {
                    audioContextRef.current.close();
                    audioContextRef.current = null;
                }
            };

            mediaRecorder.start();
            mediaRecorderRef.current = mediaRecorder;
            setIsRecording(true);
            addLog('🎙️ Recording conversation (both sides)');
            console.log('✅ Recording started successfully');

        } catch (err) {
            console.error('❌ Error starting recording:', err);
            addLog('❌ Failed to start recording');
        }
    };

    const joinCall = async (url: string): Promise<void> => {
        try {
            addLog('🔗 Joining Daily room...');

            // Create Daily call object
            const callObject = window.DailyIframe.createCallObject({
                videoSource: false,
                audioSource: true,
            });

            callObjectRef.current = callObject;

            // Listen for participants joining
            callObject.on('participant-joined', (e) => {
                addLog(`👤 Participant joined: ${e?.participant?.user_name || 'AI'}`);
            });

            // Listen for track started
            callObject.on('track-started', (e) => {
                if (!e?.participant) return;

                // Handle local tracks
                if (e.participant.local && e.track.kind === 'audio') {
                    addLog('⭐️ Local audio track detected');
                    const localAudioStream = new MediaStream([e.track]);
                    localStreamRef.current = localAudioStream;

                    // Start recording if we have both streams
                    if (remoteStreamRef.current) {
                        startRecording(localAudioStream, remoteStreamRef.current);
                    }
                    return;
                }

                // Handle remote video
                if (e.track.kind === 'video' && videoRef.current) {
                    addLog('🎥 Remote video track started');
                    videoRef.current.srcObject = new MediaStream([e.track]);
                    videoRef.current.play();
                    setIsLoading(false);
                }

                // Handle remote audio
                if (e.track.kind === 'audio' && audioRef.current) {
                    addLog('🔊 Remote audio track started');
                    const remoteAudioStream = new MediaStream([e.track]);
                    audioRef.current.srcObject = remoteAudioStream;
                    audioRef.current.play();
                    remoteStreamRef.current = remoteAudioStream;

                    // Start recording if we have both streams
                    if (localStreamRef.current) {
                        startRecording(localStreamRef.current, remoteAudioStream);
                    }
                }
            });

            // Listen for errors
            callObject.on('error', (e) => {
                addLog(`⚠️ Error: ${e?.errorMsg}`);
                console.error('❌ Daily error:', e);
            });

            // Join the call
            await callObject.join({ url });
            addLog('✅ Joined call successfully');

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            setError(`Failed to join call: ${errorMessage}`);
            addLog(`❌ ${errorMessage}`);
            console.error('❌ Join call error:', err);
            setIsLoading(false);
        }
    };

    const toggleMute = (): void => {
        if (callObjectRef.current) {
            const newMuteState = !isMuted;
            callObjectRef.current.setLocalAudio(!newMuteState);
            setIsMuted(newMuteState);
            addLog(newMuteState ? '🔇 Muted' : '🔊 Unmuted');
        }
    };

    const transcribeRecording = async (): Promise<string> => {
        try {
            console.log('🔄 Processing recorded audio...');
            console.log('🔊 Total audio chunks:', audioChunksRef.current.length);

            if (audioChunksRef.current.length === 0) {
                console.warn('⚠️ No audio chunks to transcribe');
                return 'No conversation audio recorded.';
            }

            // Combine all chunks into one blob
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            console.log('📦 Combined audio blob size:', audioBlob.size, 'bytes');

            addLog('🎯 Transcribing conversation...');
            setIsTranscribing(true);

            // Convert to base64
            const base64Audio = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const result = reader.result as string;
                    resolve(result.split(',')[1]);
                };
                reader.readAsDataURL(audioBlob);
            });

            console.log('📤 Sending to Gemini for transcription...');
            console.log('📏 Base64 audio length:', base64Audio.length);

            // Send to Gemini for transcription
            const response = await fetch('/api/tavus/transcribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    audioData: base64Audio,
                    speaker: 'conversation'
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Transcription API error:', errorText);
                throw new Error(`Transcription failed: ${response.status}`);
            }

            const data = await response.json();
            console.log('✅ Transcription received from Gemini');
            console.log('📏 Transcription length:', data.transcription?.length || 0);

            addLog('✅ Transcription complete');

            return data.transcription || 'No transcription available.';

        } catch (err) {
            console.error('❌ Error transcribing:', err);
            addLog('❌ Transcription failed');
            return 'Transcription failed. Please try again.';
        } finally {
            setIsTranscribing(false);
        }
    };

    // Replace the analyzePreferences function in TravelAgentChat.tsx with this:

    const analyzePreferences = async (transcription: string): Promise<TravelPreferences | null> => {
        try {
            console.log('🔍 Analyzing travel preferences...');
            addLog('🔍 Analyzing preferences...');
            setIsAnalyzing(true);

            const response = await fetch('/api/tavus/analyze-preferences', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    transcription: transcription
                })
            });

            // API now always returns 200, even with fallback preferences
            const data = await response.json();

            console.log('✅ Preferences received:', data.preferences);

            if (data.warning) {
                console.warn('⚠️', data.warning);
                addLog('⚠️ Using default preferences (API limit reached)');
            } else {
                addLog('✅ Preferences extracted');
            }

            setPreferences(data.preferences);
            return data.preferences;

        } catch (err) {
            console.error('❌ Error analyzing preferences:', err);
            addLog('❌ Analysis failed - using defaults');

            // Return default preferences instead of null
            const defaultPreferences: TravelPreferences = {
                age: "Not mentioned",
                budget: "Not mentioned",
                walk: "Not mentioned",
                dayNight: "Not mentioned",
                soloGroup: "Not mentioned"
            };

            setPreferences(defaultPreferences);
            return defaultPreferences;
        } finally {
            setIsAnalyzing(false);
        }
    };

    const savePreferencesToDatabase = async (preferences: TravelPreferences): Promise<void> => {
        try {
            console.log('💾 Saving preferences to database...');
            addLog('💾 Saving to database...');

            const response = await fetch('/api/user/save-ai-preferences', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    age: preferences.age,
                    budget: preferences.budget,
                    walk: preferences.walk,
                    dayNight: preferences.dayNight,
                    soloGroup: preferences.soloGroup,
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('❌ Failed to save:', errorData);
                addLog('⚠️ Could not save to profile');
                return;
            }

            const data = await response.json();
            console.log('✅ Preferences saved to database:', data);
            console.log('📊 Saved fields:', data.savedFields);
            addLog('✅ Saved to your profile');

        } catch (err) {
            console.error('❌ Error saving to database:', err);
            addLog('⚠️ Could not save to profile');
        }
    };

// Also update the endConversation function to add a delay:

    const endConversation = async (): Promise<void> => {
        setIsLoading(true);

        try {
            // Stop recording
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop();
                setIsRecording(false);
                console.log('🛑 Stopped audio recording');
                addLog('🛑 Recording stopped');
            }

            // Wait a moment for final chunks
            await new Promise(resolve => setTimeout(resolve, 500));

            // Transcribe the entire conversation
            console.log('📝 Starting transcription process...');
            const transcription = await transcribeRecording();

            // ADD DELAY HERE to avoid rate limiting
            console.log('⏳ Waiting 2 seconds before analyzing preferences...');
            addLog('⏳ Preparing to analyze...');
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Analyze preferences from transcription
            const analyzedPreferences = await analyzePreferences(transcription);

            if (analyzedPreferences) {
                await savePreferencesToDatabase(analyzedPreferences);
            }

            // Format transcript
            const header = `Travel Planning Conversation Transcript\n`;
            const tripInfo = tripDetails
                ? `Trip: ${tripDetails.destination}\nDates: ${tripDetails.startDate} to ${tripDetails.endDate}\n`
                : '';
            const dateInfo = `Generated: ${new Date().toLocaleString()}\n`;
            const separator = '='.repeat(60) + '\n\n';

            const formattedTranscript = header + tripInfo + dateInfo + separator + transcription;

            console.log('✅ Transcript formatted successfully');
            console.log('📄 Transcript preview (first 500 chars):', formattedTranscript.substring(0, 500));

            // Cleanup
            if (callObjectRef.current) {
                await callObjectRef.current.leave();
                await callObjectRef.current.destroy();
                callObjectRef.current = null;
            }

            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }

            if (audioRef.current) {
                audioRef.current.srcObject = null;
            }

            if (conversationId) {
                await fetch(`/api/tavus/travel-agent?id=${conversationId}`, {
                    method: 'DELETE',
                });
            }

            setIsConnected(false);
            setConversationId('');
            setConversationUrl('');
            addLog('✅ Conversation ended');

            // Call the callback if provided
            if (onConversationEnd) {
                console.log('📞 Calling onConversationEnd callback with transcript and preferences');
                onConversationEnd(formattedTranscript, analyzedPreferences || undefined);
            } else {
                console.log('ℹ️ No onConversationEnd callback provided');
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            console.error('❌ Error ending conversation:', err);
            addLog(`❌ ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    const downloadTranscript = async (): Promise<void> => {
        console.log('⬇️ Generating and downloading transcript...');
        setIsTranscribing(true);

        try {
            const transcription = await transcribeRecording();

            const header = `Travel Planning Conversation Transcript\n`;
            const tripInfo = tripDetails
                ? `Trip: ${tripDetails.destination}\nDates: ${tripDetails.startDate} to ${tripDetails.endDate}\n`
                : '';
            const dateInfo = `Generated: ${new Date().toLocaleString()}\n`;
            const separator = '='.repeat(60) + '\n\n';

            const transcriptText = header + tripInfo + dateInfo + separator + transcription;

            const blob = new Blob([transcriptText], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const fileName = `travel-conversation-${new Date().getTime()}.txt`;

            console.log('📦 Creating download:', {
                size: blob.size,
                fileName: fileName
            });

            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            console.log('✅ Download successful');
            console.log('💾 Saved to Downloads folder as:', fileName);
            addLog('📥 Transcript downloaded');
        } catch (err) {
            console.error('❌ Download failed:', err);
            addLog('❌ Download failed');
        } finally {
            setIsTranscribing(false);
        }
    };

    return (
        <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{
                    position: 'relative',
                    background: '#000',
                    borderRadius: '1rem',
                    overflow: 'hidden',
                    aspectRatio: '16/9'
                }}>
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted={true}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />

                    <audio
                        ref={audioRef}
                        autoPlay
                        playsInline
                        style={{ display: 'none' }}
                    />

                    {isLoading && (
                        <div style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(0, 0, 0, 0.7)'
                        }}>
                            <div style={{ textAlign: 'center' }}>
                                <Loader2 style={{
                                    width: '3rem',
                                    height: '3rem',
                                    color: '#fff',
                                    margin: '0 auto 0.75rem',
                                    animation: 'spin 1s linear infinite'
                                }} />
                                <p style={{ color: '#fff', fontWeight: 500 }}>
                                    {isAnalyzing ? 'Analyzing preferences...' : isTranscribing ? 'Transcribing conversation...' : 'Connecting to AI avatar...'}
                                </p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div style={{
                            position: 'absolute',
                            top: '1rem',
                            left: '1rem',
                            right: '1rem',
                            padding: '1rem',
                            background: 'rgba(239, 68, 68, 0.9)',
                            border: '1px solid #ef4444',
                            borderRadius: '0.5rem',
                            color: '#fff',
                            fontSize: '0.875rem',
                            display: 'flex',
                            gap: '0.5rem'
                        }}>
                            <AlertCircle style={{ width: '1.25rem', height: '1.25rem', flexShrink: 0, marginTop: '0.125rem' }} />
                            <span>{error}</span>
                        </div>
                    )}

                    {isRecording && (
                        <div style={{
                            position: 'absolute',
                            top: '1rem',
                            right: '1rem',
                            padding: '0.5rem 1rem',
                            background: 'rgba(239, 68, 68, 0.9)',
                            borderRadius: '0.5rem',
                            color: '#fff',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}>
                            <div style={{
                                width: '8px',
                                height: '8px',
                                background: '#fff',
                                borderRadius: '50%',
                                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                            }} />
                            Recording
                        </div>
                    )}

                    <div style={{
                        position: 'absolute',
                        bottom: '1rem',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        gap: '0.75rem'
                    }}>
                        <button
                            onClick={toggleMute}
                            style={{
                                background: isMuted ? '#ef4444' : 'rgba(255, 255, 255, 0.2)',
                                backdropFilter: 'blur(12px)',
                                WebkitBackdropFilter: 'blur(12px)',
                                padding: '1rem',
                                borderRadius: '9999px',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = isMuted ? '#dc2626' : 'rgba(255, 255, 255, 0.3)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = isMuted ? '#ef4444' : 'rgba(255, 255, 255, 0.2)';
                            }}
                        >
                            {isMuted ? (
                                <MicOff style={{ width: '1.5rem', height: '1.5rem', color: '#fff' }} />
                            ) : (
                                <Mic style={{ width: '1.5rem', height: '1.5rem', color: '#fff' }} />
                            )}
                        </button>

                        {isConnected && audioChunksRef.current.length > 0 && (
                            <button
                                onClick={downloadTranscript}
                                disabled={isTranscribing}
                                style={{
                                    background: isTranscribing ? '#6b7280' : 'rgba(34, 197, 94, 0.9)',
                                    backdropFilter: 'blur(12px)',
                                    WebkitBackdropFilter: 'blur(12px)',
                                    padding: '1rem',
                                    borderRadius: '9999px',
                                    border: 'none',
                                    cursor: isTranscribing ? 'not-allowed' : 'pointer',
                                    transition: 'background 0.2s',
                                    opacity: isTranscribing ? 0.6 : 1
                                }}
                                onMouseEnter={(e) => {
                                    if (!isTranscribing) {
                                        e.currentTarget.style.background = 'rgba(22, 163, 74, 0.9)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isTranscribing) {
                                        e.currentTarget.style.background = 'rgba(34, 197, 94, 0.9)';
                                    }
                                }}
                                title="Download Transcript"
                            >
                                <svg
                                    style={{ width: '1.5rem', height: '1.5rem', color: '#fff' }}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                    />
                                </svg>
                            </button>
                        )}

                        <button
                            onClick={endConversation}
                            disabled={isLoading && !isTranscribing}
                            style={{
                                background: (isLoading && !isTranscribing) ? '#6b7280' : '#ef4444',
                                padding: '1rem',
                                borderRadius: '9999px',
                                border: 'none',
                                cursor: (isLoading && !isTranscribing) ? 'not-allowed' : 'pointer',
                                transition: 'background 0.2s',
                                opacity: (isLoading && !isTranscribing) ? 0.6 : 1
                            }}
                            onMouseEnter={(e) => {
                                if (!isLoading || isTranscribing) {
                                    e.currentTarget.style.background = '#dc2626';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isLoading || isTranscribing) {
                                    e.currentTarget.style.background = '#ef4444';
                                }
                            }}
                        >
                            <PhoneOff style={{ width: '1.5rem', height: '1.5rem', color: '#fff' }} />
                        </button>
                    </div>
                </div>

                <div style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    borderRadius: '0.75rem',
                    padding: '1rem',
                    border: '1px solid rgba(255, 255, 255, 0.2)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <h3 style={{
                            fontSize: '0.875rem',
                            fontWeight: 700,
                            color: '#fff',
                            margin: 0
                        }}>
                            Activity Log
                        </h3>
                        {audioChunksRef.current.length > 0 && (
                            <span style={{
                                fontSize: '0.75rem',
                                color: '#86efac',
                                fontWeight: 500
                            }}>
                                {audioChunksRef.current.length} audio chunks recorded
                            </span>
                        )}
                    </div>
                    <div style={{
                        background: 'rgba(0, 0, 0, 0.4)',
                        borderRadius: '0.5rem',
                        padding: '0.75rem',
                        maxHeight: '8rem',
                        overflowY: 'auto',
                        fontFamily: 'monospace',
                        fontSize: '0.75rem'
                    }}>
                        {logs.slice(-5).map((log, i) => (
                            <div key={i} style={{ color: '#d1d5db' }}>
                                <span style={{ color: '#60a5fa' }}>[{log.time}]</span> {log.message}
                            </div>
                        ))}
                    </div>
                </div>

                {preferences && (
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        borderRadius: '0.75rem',
                        padding: '1.5rem',
                        border: '1px solid rgba(255, 255, 255, 0.2)'
                    }}>
                        <h3 style={{
                            fontSize: '1rem',
                            fontWeight: 700,
                            color: '#fff',
                            marginBottom: '1rem'
                        }}>
                            Travel Preferences
                        </h3>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '1rem'
                        }}>
                            <PreferenceItem label="Age" value={preferences.age} />
                            <PreferenceItem label="Budget" value={preferences.budget} />
                            <PreferenceItem label="Walking" value={preferences.walk} />
                            <PreferenceItem label="Day/Night" value={preferences.dayNight} />
                            <PreferenceItem label="Travel Style" value={preferences.soloGroup} />
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>
        </div>
    );
}

function PreferenceItem({ label, value }: { label: string; value: string }) {
    return (
        <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '0.75rem',
            borderRadius: '0.5rem',
            border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
            <div style={{
                fontSize: '0.75rem',
                color: '#9ca3af',
                marginBottom: '0.25rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: 600
            }}>
                {label}
            </div>
            <div style={{
                fontSize: '1rem',
                color: '#fff',
                fontWeight: 600
            }}>
                {value}
            </div>
        </div>
    );
}

export default function TravelAgentChat({ destination, startDate, endDate, onEnd }: TravelAgentChatProps) {
    const handleConversationEnd = (transcript?: string, preferences?: TravelPreferences) => {
        if (onEnd) {
            onEnd();
        }
    };

    return (
        <TravelAgentComponent
            tripDetails={{
                destination,
                startDate,
                endDate
            }}
            onConversationEnd={handleConversationEnd}
        />
    );
}