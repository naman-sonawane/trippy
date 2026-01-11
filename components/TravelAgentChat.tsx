'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface TravelAgentChatProps {
  destination: string;
  startDate: string;
  endDate: string;
  onEnd?: () => void;
}

interface TranscriptEntry {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

export default function TravelAgentChat({ destination, startDate, endDate, onEnd }: TravelAgentChatProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationData, setConversationData] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isUserJoined, setIsUserJoined] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isTranscriptVisible, setIsTranscriptVisible] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isEndingCall, setIsEndingCall] = useState(false);
  const [showListeningIndicator, setShowListeningIndicator] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const transcriptPollingRef = useRef<NodeJS.Timeout | null>(null);
  const lastPollTimeRef = useRef<number>(0);

  useEffect(() => {
    if (isCallActive && isUserJoined) {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isCallActive, isUserJoined]);

  useEffect(() => {
    if (isCallActive && conversationData?.conversation_id && isUserJoined) {
      console.log('starting tavus transcript polling');
      
      transcriptPollingRef.current = setInterval(async () => {
        try {
          const response = await fetch(`/api/tavus/transcript?conversation_id=${conversationData.conversation_id}`);
          if (response.ok) {
            const data = await response.json();
            if (data.transcript_entries && data.transcript_entries.length > 0) {
              console.log('📝 RECEIVED TRANSCRIPT ENTRIES:', data.transcript_entries.length);
              
              setTranscript(prev => {
                const existingIds = new Set(prev.map(item => item.id));
                const newEntries = data.transcript_entries.filter((entry: any) => !existingIds.has(entry.id));
                
                if (newEntries.length > 0) {
                  console.log('✨ NEW TRANSCRIPT ENTRIES:', newEntries.length);
                  newEntries.forEach((entry: any) => {
                    const speaker = entry.isUser ? '👤 USER' : '🤖 AGENT';
                    console.log(`${speaker}: "${entry.text}"`);
                  });
                  console.log('📊 TOTAL TRANSCRIPT LENGTH:', prev.length + newEntries.length);
                  return [...prev, ...newEntries];
                }
                return prev;
              });
              
              lastPollTimeRef.current = Date.now();
            } else {
              console.log('⏳ no transcript entries yet...');
            }
          } else {
            console.log('❌ transcript polling failed:', response.status);
          }
        } catch (error) {
          console.error('💥 error polling transcript:', error);
        }
      }, 2000);
    } else {
      if (transcriptPollingRef.current) {
        clearInterval(transcriptPollingRef.current);
        transcriptPollingRef.current = null;
      }
    }

    return () => {
      if (transcriptPollingRef.current) {
        clearInterval(transcriptPollingRef.current);
      }
    };
  }, [isCallActive, conversationData?.conversation_id, isUserJoined]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (isListening) {
      setShowListeningIndicator(true);
    } else {
      timeoutId = setTimeout(() => {
        setShowListeningIndicator(false);
      }, 500);
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isListening]);

  const startTranscriptionAfterDelay = () => {
    console.log('iframe loaded - will start polling in 4 seconds');
    setTimeout(() => {
      console.log('starting tavus transcript polling');
      setIsUserJoined(true);
      setIsListening(true);
    }, 4000);
  };

  const startConversation = async () => {
    setIsLoading(true);
    setError(null);
    setIsConnecting(true);

    try {
      console.log('starting travel agent conversation');
      
      const response = await fetch('/api/tavus/travel-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create',
          destination,
          startDate,
          endDate,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create conversation');
      }

      const data = await response.json();
      console.log('travel agent conversation created:', data);
      setConversationData(data);
      setIsCallActive(true);
      setSessionId(`travel-agent-${Date.now()}`);
      
    } catch (error) {
      console.error('error starting travel agent session:', error);
      setError(error instanceof Error ? error.message : 'unknown error occurred');
    } finally {
      setIsLoading(false);
      setIsConnecting(false);
    }
  };

  const endCall = async () => {
    setIsEndingCall(true);
    setIsCallActive(false);
    
    console.log('🛑 ENDING CALL');
    console.log('⏱️ call duration:', callDuration, 'seconds');
    console.log('📝 transcript entries:', transcript.length);
    console.log('='.repeat(80));
    console.log('📋 FULL CONVERSATION TRANSCRIPT:');
    console.log('='.repeat(80));
    transcript.forEach((entry, index) => {
      const speaker = entry.isUser ? '👤 USER' : '🤖 AGENT';
      console.log(`[${index + 1}] ${speaker}: "${entry.text}"`);
    });
    console.log('='.repeat(80));
    
    let extractedPreferences = null;
    if (transcript.length > 0) {
      try {
        const response = await fetch('/api/tavus/travel-agent/log', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            destination,
            startDate,
            endDate,
            transcript: transcript,
            conversationLength: callDuration,
            sessionId: sessionId,
          }),
        });
        
        if (response.ok) {
          const result = await response.json();
          extractedPreferences = result.preferences;
          console.log('✅ EXTRACTED PREFERENCES:', extractedPreferences);
        }
      } catch (error) {
        console.error('❌ error saving transcript:', error);
      }
    }
    
    setConversationData(null);
    setCallDuration(0);
    setSessionId(null);
    setTranscript([]);
    setIsTranscriptVisible(false);
    setIsUserJoined(false);
    
    if (extractedPreferences) {
      localStorage.setItem('travelPreferences', JSON.stringify(extractedPreferences));
    }
    
    router.push('/preferences-summary');
    
    setTimeout(() => {
      onEnd?.();
    }, 100);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (conversationData) {
    return (
      <div className="fixed inset-0 z-50 overflow-hidden" 
           style={{
             backgroundImage: "url(/landingbg.jpg)",
             backgroundSize: "cover",
             backgroundPosition: "center"
           }}>
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/60" />
        
        <style jsx>{`
          iframe {
            width: 100vw !important;
            height: 100vh !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            z-index: 1 !important;
            border: none !important;
          }
        `}</style>
        <div className={`w-screen h-screen relative transition-all duration-300 ${isTranscriptVisible ? 'mr-80' : ''}`}>
          <iframe
            ref={iframeRef}
            src={conversationData.conversation_url}
            className={`w-screen h-screen border-0 absolute inset-0 transition-all duration-300`}
            allow="camera; microphone; fullscreen; speaker; display-capture"
            title="Video call with travel agent"
            style={{ 
              width: isTranscriptVisible ? 'calc(100vw - 20rem)' : '100vw',
              height: '100vh',
              position: 'fixed',
              top: 0,
              left: 0,
              zIndex: 15
            }}
            onLoad={() => {
              console.log('iframe loaded - ready for conversation');
              startTranscriptionAfterDelay();
            }}
          />
          
          <div className={`absolute bottom-20 left-4 bg-white/10 backdrop-blur-md text-white text-sm px-4 py-3 rounded-xl z-30 transition-all duration-300 border border-white/20 ${isTranscriptVisible ? 'right-80' : 'right-4'}`}>
            <div className="flex items-center justify-between">
              <div className="text-center">
                <div className="font-bold text-lg" style={{ fontFamily: "var(--font-fraunces)" }}>Travel Agent</div>
                <div className="text-sm opacity-75" style={{ fontFamily: "var(--font-dm-sans)" }}>Planning your trip to {destination}</div>
                <div className="text-xs opacity-60 mt-1" style={{ fontFamily: "var(--font-dm-sans)" }}>
                  conv id: {conversationData?.conversation_id?.slice(0, 8)}... | entries: {transcript.length}
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                {isConnecting && (
                  <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm px-3 py-1 rounded-lg">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs text-white font-medium" style={{ fontFamily: "var(--font-dm-sans)" }}>connecting...</span>
                  </div>
                )}
                
                {showListeningIndicator && (
                  <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm px-3 py-1 rounded-lg">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-white font-medium" style={{ fontFamily: "var(--font-dm-sans)" }}>polling transcript...</span>
                  </div>
                )}
                
                <div className="bg-white/10 backdrop-blur-sm px-3 py-1 rounded-lg">
                  <div className="text-sm font-bold text-white" style={{ fontFamily: "var(--font-dm-sans)" }}>
                    {formatDuration(callDuration)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {isTranscriptVisible && (
            <div className="absolute top-0 right-0 w-80 h-full bg-black/90 backdrop-blur-xl text-white z-30 overflow-hidden shadow-2xl border-l border-white/20">
              <div className="p-4 border-b border-white/20 flex items-center justify-between">
                <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-fraunces)" }}>live transcript</h3>
                <button
                  onClick={() => setIsTranscriptVisible(false)}
                  className="text-gray-400 hover:text-white text-xl font-bold"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 h-[calc(100vh-80px)]">
                {transcript.length === 0 ? (
                  <div className="text-center text-gray-400 py-8" style={{ fontFamily: "var(--font-dm-sans)" }}>
                    <div className="animate-pulse mb-4">
                      {!isUserJoined ? 'starting transcript polling in 4 seconds...' : 'waiting for conversation...'}
                    </div>
                    <div className="text-xs space-y-2">
                      <div>polling: {isListening ? '🔄 active' : '❌ not active'}</div>
                      <div>conversation id: {conversationData?.conversation_id ? '✅' : '❌'}</div>
                      <div className="text-green-400 mt-4">✨ both user and agent speech will be captured</div>
                    </div>
                  </div>
                ) : (
                  transcript.map((entry) => (
                    <div
                      key={entry.id}
                      className={`p-4 rounded-xl shadow-lg ${
                        entry.isUser
                          ? 'bg-white/10 ml-4 border-l-4 border-white/40'
                          : 'bg-white/5 mr-4 border-l-4 border-white/20'
                      }`}
                      style={{ fontFamily: "var(--font-dm-sans)" }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-bold flex items-center space-x-2">
                          <span className={`w-2 h-2 rounded-full ${entry.isUser ? 'bg-white/60' : 'bg-white/40'}`}></span>
                          <span>{entry.isUser ? 'you' : 'agent'}</span>
                        </div>
                      </div>
                      <div className="text-sm leading-relaxed mb-2">{entry.text}</div>
                      <div className="text-xs opacity-75 text-right">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {isEndingCall && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center">
              <div className="bg-white rounded-xl p-8 text-center shadow-2xl">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <h3 className="text-xl font-bold text-gray-800 mb-2" style={{ fontFamily: "var(--font-fraunces)" }}>ending call</h3>
                <p className="text-gray-600" style={{ fontFamily: "var(--font-dm-sans)" }}>analyzing your preferences...</p>
              </div>
            </div>
          )}

          <div className={`absolute bottom-0 left-0 right-0 z-30 ${isTranscriptVisible ? 'right-80' : ''}`}>
            <div className="flex items-center justify-between p-4 pb-0 pr-2">
              <div className="w-1/3"></div>
              
              <div className="flex justify-center w-1/3">
                {!isUserJoined ? (
                  <div className="px-12 py-4 rounded-full font-bold text-lg transition-all duration-200 flex items-center space-x-4 shadow-xl bg-white/10 backdrop-blur-md text-white border border-white/20"
                    style={{ minWidth: '250px', fontFamily: "var(--font-dm-sans)" }}
                  >
                    <span className="text-xl">⏳</span>
                    <span>starting in 4 seconds...</span>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsTranscriptVisible(!isTranscriptVisible)}
                    className={`px-12 py-4 rounded-full font-bold text-lg transition-all duration-200 flex items-center space-x-4 shadow-xl ${
                      isTranscriptVisible 
                        ? 'bg-white text-black hover:bg-opacity-90' 
                        : 'bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/20'
                    }`}
                    style={{ minWidth: '250px', fontFamily: "var(--font-dm-sans)" }}
                  >
                    <span className="text-xl">📝</span>
                    <span>live transcript</span>
                    {transcript.length > 0 && (
                      <span className="mb-0 bg-red-500 text-white text-sm px-3 rounded-full font-bold">
                        {transcript.length}
                      </span>
                    )}
                  </button>
                )}
              </div>

              <div className="flex justify-end w-1/3">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      console.log('⏭️ SKIPPING AGENT - NO TRANSCRIPT');
                      setIsCallActive(false);
                      setConversationData(null);
                      router.push('/recommendations');
                    }}
                    className="px-8 py-4 rounded-full font-bold text-lg bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/20 transition-all shadow-xl"
                    style={{ fontFamily: "var(--font-dm-sans)" }}
                  >
                    skip agent →
                  </button>
                  <button
                    onClick={endCall}
                    disabled={isEndingCall}
                    className={`px-16 py-4 rounded-full font-bold text-xl transition-all duration-200 shadow-xl relative z-30 ${
                      isEndingCall 
                        ? 'bg-gray-500 cursor-not-allowed opacity-75' 
                        : 'bg-white text-black hover:bg-opacity-90 transform hover:scale-105'
                    }`}
                    style={{ fontFamily: "var(--font-dm-sans)" }}
                  >
                    {isEndingCall ? (
                      <div className="flex items-center justify-center space-x-3">
                        <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                        <span>ending call...</span>
                      </div>
                    ) : (
                      'end call'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center rounded-2xl" 
         style={{
           backgroundImage: "url(/landingbg.jpg)",
           backgroundSize: "cover",
           backgroundPosition: "center"
         }}>
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/60 rounded-2xl" />
      <div className="text-center text-white relative z-10">
        {isLoading ? (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-lg font-medium" style={{ fontFamily: "var(--font-fraunces)" }}>connecting to travel agent...</p>
            <p className="text-sm opacity-75" style={{ fontFamily: "var(--font-dm-sans)" }}>preparing your consultation</p>
          </>
        ) : error ? (
          <>
            <div className="w-12 h-12 bg-red-500 bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-lg font-medium mb-2" style={{ fontFamily: "var(--font-fraunces)" }}>error loading video call</p>
            <p className="text-sm opacity-75 mb-4" style={{ fontFamily: "var(--font-dm-sans)" }}>{error}</p>
            <button
              onClick={startConversation}
              className="bg-white text-black px-6 py-3 rounded-full text-sm font-medium hover:bg-opacity-90 transition-colors"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              retry
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-4 border border-white/20">
              <span className="text-3xl">🧳</span>
            </div>
            <p className="text-lg font-medium" style={{ fontFamily: "var(--font-fraunces)" }}>ready to plan your trip</p>
            <p className="text-sm opacity-75 mb-4" style={{ fontFamily: "var(--font-dm-sans)" }}>our travel agent will help personalize your experience</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={startConversation}
                className="mt-4 bg-white text-black px-8 py-3 rounded-full text-base font-medium hover:bg-opacity-90 transition-colors"
                style={{ fontFamily: "var(--font-dm-sans)" }}
              >
                start consultation
              </button>
              <button
                onClick={() => {
                  console.log('⏭️ SKIPPING AGENT CONSULTATION');
                  router.push('/recommendations');
                }}
                className="mt-4 bg-white/10 backdrop-blur-md text-white px-8 py-3 rounded-full text-base font-medium border border-white/20 hover:bg-white/20 transition-colors"
                style={{ fontFamily: "var(--font-dm-sans)" }}
              >
                skip for now
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
