'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Video, Mic, MicOff, PhoneOff, Loader2, AlertCircle, Heart } from 'lucide-react';
import { useRouter } from 'next/navigation';

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

export default function TavusDemo() {
    const router = useRouter();
    const [conversationId, setConversationId] = useState<string>('');
    const [conversationUrl, setConversationUrl] = useState<string>('');
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isMuted, setIsMuted] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [logs, setLogs] = useState<Log[]>([]);
    const [dailyLoaded, setDailyLoaded] = useState<boolean>(false);
    const [showSwipeButton, setShowSwipeButton] = useState<boolean>(false);
    const [tripDetails, setTripDetails] = useState<{destination: string; startDate: string; endDate: string} | null>(null);
    const [autoStarted, setAutoStarted] = useState<boolean>(false);
    const [collectedPreferences, setCollectedPreferences] = useState<{
        budget?: string;
        walk?: string;
        dayNight?: string;
        solo?: string;
    } | null>(null);
    const [transcript, setTranscript] = useState<Array<{
        id: string;
        text: string;
        isUser: boolean;
        timestamp: Date;
    }>>([]);
    const [isTranscriptVisible, setIsTranscriptVisible] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const callObjectRef = useRef<DailyCallObject | null>(null);
    const transcriptPollingRef = useRef<NodeJS.Timeout | null>(null);
    const speechRecognitionRef = useRef<any>(null);

    const addLog = (message: string): void => {
        setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), message }]);
    };

    // Load trip details from localStorage
    useEffect(() => {
        const destination = localStorage.getItem('currentDestination');
        const startDate = localStorage.getItem('tripStartDate');
        const endDate = localStorage.getItem('tripEndDate');

        if (destination && startDate && endDate) {
            setTripDetails({ destination, startDate, endDate });
            addLog(`📍 Trip loaded: ${destination} (${startDate} to ${endDate})`);
        }
    }, []);

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
        };
    }, []);

    // Auto-start conversation when Daily is loaded
    useEffect(() => {
        if (dailyLoaded && !autoStarted && !isConnected) {
            setAutoStarted(true);
            startConversation();
        }
    }, [dailyLoaded, autoStarted, isConnected]);

    // Speech recognition effect - capture audio from user's microphone
    useEffect(() => {
        console.log('Speech recognition effect triggered. isConnected:', isConnected);
        addLog(`Speech recognition check - Connected: ${isConnected}`);
        
        if (isConnected && typeof window !== 'undefined') {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            
            console.log('SpeechRecognition available:', !!SpeechRecognition);
            
            if (SpeechRecognition) {
                if (speechRecognitionRef.current) {
                    try {
                        speechRecognitionRef.current.stop();
                    } catch (error) {
                        console.log('Error stopping existing recognition:', error);
                    }
                    speechRecognitionRef.current = null;
                }
                
                const recognition = new SpeechRecognition();
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.lang = 'en-US';
                recognition.maxAlternatives = 1;
                
                let isRecognitionActive = false;
                
                recognition.onstart = () => {
                    console.log('🎤 Speech recognition started');
                    addLog('🎤 Started listening to conversation');
                    isRecognitionActive = true;
                };
                
                recognition.onresult = (event: any) => {
                    const current = event.resultIndex;
                    const transcriptText = event.results[current][0].transcript;
                    const isFinal = event.results[current].isFinal;
                    
                    console.log('🎤 Result:', isFinal ? 'FINAL' : 'interim', transcriptText);
                    
                    if (isFinal && transcriptText.trim()) {
                        console.log('🎤 Speech detected:', transcriptText);
                        addLog(`🎤 Captured: ${transcriptText.substring(0, 50)}...`);
                        
                        setTranscript(prev => {
                            const isUser = prev.length % 2 === 0;
                            
                            const newEntry = {
                                id: `${isUser ? 'user' : 'ai'}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                text: transcriptText.trim(),
                                isUser: isUser,
                                timestamp: new Date()
                            };
                            
                            console.log('Adding transcript entry:', newEntry);
                            return [...prev, newEntry];
                        });
                    }
                };
                
                recognition.onerror = (event: any) => {
                    console.log('🎤 Speech recognition error:', event.error);
                    addLog(`❌ Speech recognition error: ${event.error}`);
                    isRecognitionActive = false;
                    
                    if (event.error === 'no-speech' || event.error === 'audio-capture' || event.error === 'aborted') {
                        setTimeout(() => {
                            if (isConnected && !isRecognitionActive) {
                                try {
                                    recognition.start();
                                    console.log('🔄 Restarting speech recognition');
                                } catch (error) {
                                    console.log('Failed to restart recognition:', error);
                                }
                            }
                        }, 1000);
                    }
                };
                
                recognition.onend = () => {
                    console.log('🎤 Speech recognition ended');
                    isRecognitionActive = false;
                    
                    if (isConnected) {
                        setTimeout(() => {
                            try {
                                recognition.start();
                                console.log('🔄 Auto-restarting speech recognition');
                            } catch (error) {
                                console.log('Failed to restart recognition:', error);
                            }
                        }, 500);
                    }
                };
                
                speechRecognitionRef.current = recognition;
                
                try {
                    console.log('🎤 Attempting to start speech recognition...');
                    recognition.start();
                    addLog('🎤 Speech recognition initialized - listening for audio...');
                } catch (error) {
                    console.error('Failed to start speech recognition:', error);
                    addLog('❌ Speech recognition failed to start');
                }
            } else {
                addLog('❌ Speech recognition not supported in this browser');
                console.log('❌ Speech Recognition API not available');
            }
        }

        return () => {
            if (speechRecognitionRef.current) {
                try {
                    speechRecognitionRef.current.stop();
                    console.log('🛑 Stopped speech recognition');
                } catch (error) {
                    console.log('Error stopping recognition:', error);
                }
                speechRecognitionRef.current = null;
            }
        };
    }, [isConnected]);

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

            // Call our API endpoint with trip context
            const response = await fetch('/api/conversation', {
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
            setIsLoading(false);
        }
    };

    const joinCall = async (url: string): Promise<void> => {
        try {
            addLog('🔗 Joining Daily room...');

            // Create Daily call object (audio only, video disabled)
            const callObject = window.DailyIframe.createCallObject({
                videoSource: false,
                audioSource: true,
            });

            callObjectRef.current = callObject;

            // Listen for participants joining
            callObject.on('participant-joined', (e) => {
                addLog(`👤 Participant joined: ${e?.participant?.user_name || 'AI'}`);
            });

            // Listen for track started - separate video and audio handling
            callObject.on('track-started', (e) => {
                if (!e?.participant) return;

                // Only handle remote participants (not local)
                if (e.participant.local) {
                    addLog('⏭️ Skipping local track (preventing echo)');
                    return;
                }

                if (e.track.kind === 'video' && videoRef.current) {
                    addLog('🎥 Remote video track started');
                    videoRef.current.srcObject = new MediaStream([e.track]);
                    videoRef.current.play();
                    setIsLoading(false);
                }

                if (e.track.kind === 'audio' && audioRef.current) {
                    addLog('🔊 Remote audio track started');
                    audioRef.current.srcObject = new MediaStream([e.track]);
                    audioRef.current.play();
                }
            });

            // Listen for errors
            callObject.on('error', (e) => {
                addLog(`⚠️ Error: ${e?.errorMsg}`);
            });

            // Join the call
            await callObject.join({ url });
            addLog('✅ Joined call successfully');

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            setError(`Failed to join call: ${errorMessage}`);
            addLog(`❌ ${errorMessage}`);
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

    const endConversation = async (): Promise<void> => {
        setIsLoading(true);

        try {
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
                await fetch(`/api/conversation?id=${conversationId}`, {
                    method: 'DELETE',
                });
            }

            // Wait for webhook to process (5 seconds)
            addLog('⏳ Processing conversation data via webhook...');
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Fetch from database (webhook should have saved it)
            addLog('🔄 Fetching your preferences...');
            const prefsResponse = await fetch('/api/user/collected-preferences');
            if (prefsResponse.ok) {
                const prefs = await prefsResponse.json();
                if (prefs && (prefs.budget || prefs.walk || prefs.dayNight || prefs.solo)) {
                    setCollectedPreferences(prefs);
                    addLog('✅ Preferences loaded!');
                } else {
                    addLog('⚠️ No preferences found - webhook may still be processing');
                    setCollectedPreferences({ 
                        budget: null, 
                        walk: null, 
                        dayNight: null, 
                        solo: null 
                    });
                }
            }

            setIsConnected(false);
            setConversationId('');
            setConversationUrl('');
            setShowSwipeButton(true);
            addLog('✅ Conversation ended - Ready to explore recommendations!');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            addLog(`❌ ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(to bottom right, #581c87, #1e3a8a, #312e81)',
            padding: '2rem'
        }}>
            <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <h1 style={{
                        fontSize: '2.5rem',
                        fontWeight: 'bold',
                        color: 'white',
                        marginBottom: '0.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.75rem'
                    }}>
                        <Video style={{ width: '2.5rem', height: '2.5rem' }} />
                        Tavus AI Video
                    </h1>
                    <p style={{ color: '#bfdbfe', fontSize: '1rem' }}>Talk to an AI avatar</p>
                    {tripDetails && (
                        <p style={{ color: '#86efac', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                            Planning trip to {tripDetails.destination} • {tripDetails.startDate} to {tripDetails.endDate}
                        </p>
                    )}
                </div>

                {showSwipeButton ? (
                    <div style={{ maxWidth: '672px', margin: '0 auto' }}>
                        <div style={{
                            background: 'rgba(255, 255, 255, 0.1)',
                            backdropFilter: 'blur(16px)',
                            borderRadius: '1rem',
                            padding: '2rem',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            textAlign: 'center'
                        }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', marginBottom: '1rem' }}>
                                Great! Now Let's Find Your Perfect Places
                            </h2>
                            
                            <p style={{ color: '#bfdbfe', marginBottom: '1.5rem' }}>
                                Your preferences will help us recommend the best places for you!
                            </p>

                            <button
                                onClick={() => router.push('/recommendations')}
                                style={{
                                    background: '#22c55e',
                                    color: 'white',
                                    fontWeight: '500',
                                    padding: '1rem 2rem',
                                    borderRadius: '0.5rem',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.75rem',
                                    margin: '0 auto',
                                    fontSize: '1.125rem',
                                    transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#16a34a';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = '#22c55e';
                                }}
                            >
                                <Heart style={{ width: '1.5rem', height: '1.5rem' }} />
                                Start Swiping
                            </button>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{
                            position: 'relative',
                            background: 'black',
                            borderRadius: '1rem',
                            overflow: 'hidden',
                            aspectRatio: '16/9'
                        }}>
                            {/* Video element for visual only - MUTED */}
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted={true}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />

                            {/* Hidden audio element for sound only - handles remote audio separately */}
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
                                            color: 'white',
                                            margin: '0 auto 0.75rem',
                                            animation: 'spin 1s linear infinite'
                                        }} />
                                        <p style={{ color: 'white', fontWeight: '500' }}>Connecting to AI avatar...</p>
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
                                    color: 'white',
                                    fontSize: '0.875rem',
                                    display: 'flex',
                                    gap: '0.5rem'
                                }}>
                                    <AlertCircle style={{ width: '1.25rem', height: '1.25rem', flexShrink: 0, marginTop: '0.125rem' }} />
                                    <span>{error}</span>
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
                                    {isMuted ? <MicOff style={{ width: '1.5rem', height: '1.5rem', color: 'white' }} /> : <Mic style={{ width: '1.5rem', height: '1.5rem', color: 'white' }} />}
                                </button>

                                <button
                                    onClick={endConversation}
                                    disabled={isLoading}
                                    style={{
                                        background: isLoading ? '#4b5563' : '#ef4444',
                                        padding: '1rem',
                                        borderRadius: '9999px',
                                        border: 'none',
                                        cursor: isLoading ? 'not-allowed' : 'pointer',
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isLoading) {
                                            e.currentTarget.style.background = '#dc2626';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isLoading) {
                                            e.currentTarget.style.background = '#ef4444';
                                        }
                                    }}
                                >
                                    <PhoneOff style={{ width: '1.5rem', height: '1.5rem', color: 'white' }} />
                                </button>
                            </div>

                            {/* Transcript Toggle Button */}
                            <button
                                onClick={() => setIsTranscriptVisible(!isTranscriptVisible)}
                                style={{
                                    position: 'absolute',
                                    top: '1rem',
                                    right: '1rem',
                                    background: 'rgba(255, 255, 255, 0.2)',
                                    backdropFilter: 'blur(12px)',
                                    padding: '0.75rem 1rem',
                                    borderRadius: '0.5rem',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'white',
                                    fontSize: '0.875rem',
                                    fontWeight: '500',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}
                            >
                                📝 {isTranscriptVisible ? 'Hide' : 'Show'} Transcript
                                {transcript.length > 0 && (
                                    <span style={{
                                        background: '#3b82f6',
                                        color: 'white',
                                        padding: '0.125rem 0.5rem',
                                        borderRadius: '9999px',
                                        fontSize: '0.75rem'
                                    }}>
                                        {transcript.length}
                                    </span>
                                )}
                            </button>

                            {/* Transcript Panel */}
                            {isTranscriptVisible && (
                                <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    right: 0,
                                    width: '400px',
                                    height: '100%',
                                    background: 'rgba(0, 0, 0, 0.95)',
                                    backdropFilter: 'blur(12px)',
                                    color: 'white',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    zIndex: 10
                                }}>
                                    <div style={{
                                        padding: '1rem',
                                        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                    }}>
                                        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', margin: 0 }}>Live Transcript</h3>
                                        <button
                                            onClick={() => setIsTranscriptVisible(false)}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                color: '#9ca3af',
                                                cursor: 'pointer',
                                                fontSize: '1.5rem',
                                                fontWeight: 'bold',
                                                padding: 0
                                            }}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                    <div style={{
                                        flex: 1,
                                        overflowY: 'auto',
                                        padding: '1rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.75rem'
                                    }}>
                                        {transcript.length === 0 ? (
                                            <div style={{
                                                textAlign: 'center',
                                                color: '#9ca3af',
                                                padding: '2rem',
                                                animation: 'pulse 2s infinite'
                                            }}>
                                                <div>Waiting for conversation...</div>
                                                <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', opacity: 0.75 }}>
                                                    Transcript will appear here
                                                </div>
                                            </div>
                                        ) : (
                                            transcript.map((entry) => (
                                                <div
                                                    key={entry.id}
                                                    style={{
                                                        padding: '1rem',
                                                        borderRadius: '0.75rem',
                                                        background: entry.isUser ? '#2563eb' : '#374151',
                                                        marginLeft: entry.isUser ? '1rem' : 0,
                                                        marginRight: entry.isUser ? 0 : '1rem',
                                                        borderLeft: entry.isUser ? '4px solid #60a5fa' : '4px solid #6b7280'
                                                    }}
                                                >
                                                    <div style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        marginBottom: '0.5rem'
                                                    }}>
                                                        <div style={{
                                                            fontSize: '0.875rem',
                                                            fontWeight: 'bold',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.5rem'
                                                        }}>
                                                            <span style={{
                                                                width: '0.5rem',
                                                                height: '0.5rem',
                                                                borderRadius: '9999px',
                                                                background: entry.isUser ? '#93c5fd' : '#9ca3af'
                                                            }} />
                                                            <span>{entry.isUser ? 'You' : 'AI Assistant'}</span>
                                                        </div>
                                                    </div>
                                                    <div style={{ fontSize: '0.875rem', lineHeight: '1.5', marginBottom: '0.5rem' }}>
                                                        {entry.text}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', opacity: 0.75, textAlign: 'right' }}>
                                                        {new Date(entry.timestamp).toLocaleTimeString()}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{
                            background: 'rgba(255, 255, 255, 0.1)',
                            backdropFilter: 'blur(16px)',
                            borderRadius: '0.75rem',
                            padding: '1rem',
                            border: '1px solid rgba(255, 255, 255, 0.2)'
                        }}>
                            <h3 style={{ fontSize: '0.875rem', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem' }}>
                                Activity
                            </h3>
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
                    </div>
                )}
            </div>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}