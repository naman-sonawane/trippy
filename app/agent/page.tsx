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
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isMuted, setIsMuted] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [logs, setLogs] = useState<Log[]>([]);
    const [dailyLoaded, setDailyLoaded] = useState<boolean>(false);
    const [showSwipeButton, setShowSwipeButton] = useState<boolean>(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const callObjectRef = useRef<DailyCallObject | null>(null);

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
        };
    }, []);

    const startConversation = async (): Promise<void> => {
        if (!dailyLoaded) {
            setError('Daily.co SDK is still loading...');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            addLog('🔄 Creating conversation...');

            // Call our API endpoint
            const response = await fetch('/api/conversation', {
                method: 'POST',
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

            // Create Daily call object (audio only)
            const callObject = window.DailyIframe.createCallObject({
                videoSource: false,  // Disable camera
                audioSource: true,   // Enable microphone only
            });

            callObjectRef.current = callObject;

            // Listen for participants joining
            callObject.on('participant-joined', (e) => {
                addLog(`👤 Participant joined: ${e?.participant?.user_name || 'AI'}`);
            });

            // Listen for track started (video and audio available)
            callObject.on('track-started', (e) => {
                if (!e?.participant || !videoRef.current) return;

                if (e.track.kind === 'video') {
                    addLog('🎥 Video track started');
                    const currentStream = videoRef.current.srcObject as MediaStream;
                    if (currentStream) {
                        currentStream.addTrack(e.track);
                    } else {
                        const newStream = new MediaStream([e.track]);
                        videoRef.current.srcObject = newStream;
                    }
                    videoRef.current.play();
                    setIsLoading(false);
                }

                if (e.track.kind === 'audio') {
                    addLog('🔊 Audio track started');
                    const currentStream = videoRef.current.srcObject as MediaStream;
                    if (currentStream) {
                        currentStream.addTrack(e.track);
                    } else {
                        const newStream = new MediaStream([e.track]);
                        videoRef.current.srcObject = newStream;
                    }
                    videoRef.current.play();
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

            if (conversationId) {
                await fetch(`/api/conversation?id=${conversationId}`, {
                    method: 'DELETE',
                });
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
                </div>

                {!isConnected ? (
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
                                Ready to Start?
                            </h2>
                            <p style={{ color: '#bfdbfe', marginBottom: '1.5rem' }}>
                                Click the button below to begin your conversation with the AI avatar.
                            </p>

                            <button
                                onClick={startConversation}
                                disabled={isLoading || !dailyLoaded}
                                style={{
                                    background: isLoading || !dailyLoaded ? '#4b5563' : '#22c55e',
                                    color: 'white',
                                    fontWeight: '500',
                                    padding: '1rem 2rem',
                                    borderRadius: '0.5rem',
                                    border: 'none',
                                    cursor: isLoading || !dailyLoaded ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.75rem',
                                    margin: '0 auto',
                                    fontSize: '1.125rem',
                                    transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    if (!isLoading && dailyLoaded) {
                                        e.currentTarget.style.background = '#16a34a';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isLoading && dailyLoaded) {
                                        e.currentTarget.style.background = '#22c55e';
                                    }
                                }}
                            >
                                {isLoading ? <Loader2 style={{ width: '1.5rem', height: '1.5rem', animation: 'spin 1s linear infinite' }} /> : <Video style={{ width: '1.5rem', height: '1.5rem' }} />}
                                Start Conversation
                            </button>

                            {error && (
                                <div style={{
                                    marginTop: '1.5rem',
                                    padding: '1rem',
                                    background: 'rgba(239, 68, 68, 0.2)',
                                    border: '1px solid #ef4444',
                                    borderRadius: '0.5rem',
                                    color: '#fecaca',
                                    fontSize: '0.875rem',
                                    display: 'flex',
                                    gap: '0.5rem'
                                }}>
                                    <AlertCircle style={{ width: '1.25rem', height: '1.25rem', flexShrink: 0, marginTop: '0.125rem' }} />
                                    <span>{error}</span>
                                </div>
                            )}

                            {logs.length > 0 && (
                                <div style={{
                                    marginTop: '1.5rem',
                                    background: 'rgba(0, 0, 0, 0.4)',
                                    borderRadius: '0.75rem',
                                    padding: '1rem',
                                    maxHeight: '12rem',
                                    overflowY: 'auto'
                                }}>
                                    <h3 style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#bfdbfe', marginBottom: '0.5rem' }}>
                                        Activity
                                    </h3>
                                    <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', textAlign: 'left' }}>
                                        {logs.map((log, i) => (
                                            <div key={i} style={{ color: '#d1d5db', marginBottom: '0.25rem' }}>
                                                <span style={{ color: '#60a5fa' }}>[{log.time}]</span> {log.message}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : showSwipeButton ? (
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
                                Based on your preferences, we've prepared personalized recommendations. Swipe through them to find places you'll love!
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
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted={false}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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