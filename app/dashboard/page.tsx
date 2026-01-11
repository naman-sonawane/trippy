'use client';

import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Trip {
  _id: string;
  destination: string;
  startDate: string;
  endDate: string;
  tripCode?: string;
  status?: string;
  itinerary?: Array<{
    id: string;
    name: string;
    day: number;
  }>;
  userId: string;
  participantIds?: string[];
}

const Dashboard = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(true);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [copiedTripCode, setCopiedTripCode] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      loadTrips();
    }
  }, [status]);

  const loadTrips = async () => {
    try {
      setIsLoadingTrips(true);
      const response = await fetch('/api/trips');
      if (response.ok) {
        const data = await response.json();
        setTrips(data.trips || []);
      }
    } catch (error) {
      console.error('Error loading trips:', error);
    } finally {
      setIsLoadingTrips(false);
    }
  };

  const handleJoinTrip = async () => {
    if (!joinCode.trim()) {
      setJoinError('Please enter a trip code');
      return;
    }

    setIsJoining(true);
    setJoinError(null);

    try {
      const response = await fetch('/api/trips/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripCode: joinCode.trim().toUpperCase() }),
      });

      if (response.ok) {
        const data = await response.json();
        setShowJoinModal(false);
        setJoinCode('');
        await loadTrips();
        router.push(`/recommendations?tripId=${data.trip._id}`);
      } else {
        const errorData = await response.json();
        setJoinError(errorData.error || 'Failed to join trip');
      }
    } catch (error) {
      setJoinError('Failed to join trip. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center"
           style={{
             backgroundImage: "url(/dashbg.jpg)",
             backgroundSize: "cover",
             backgroundPosition: "center",
             backgroundRepeat: "no-repeat",
             backgroundAttachment: "fixed"
           }}>
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/60" />
        <div className="text-xl text-white relative z-10" style={{ fontFamily: 'var(--font-dm-sans)' }}>Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen relative"
         style={{
           backgroundImage: "url(/dashbg.jpg)",
           backgroundSize: "cover",
           backgroundPosition: "center",
           backgroundRepeat: "no-repeat",
           backgroundAttachment: "fixed"
         }}>
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/60" />
      
      <nav className="relative z-10 bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Trippy" width={36} height={36} className="w-9 h-9" />
            <span className="text-2xl font-normal text-white" style={{ fontFamily: 'var(--font-dm-sans)' }}>trippy</span>
          </div>

          <div className="flex items-center gap-4">
            {session.user.image && (
              <Image 
                src={session.user.image} 
                alt={session.user.name || "User"} 
                width={40} 
                height={40} 
                className="rounded-full border-2 border-white/20"
              />
            )}
            <div className="text-right">
              <div className="font-medium text-white" style={{ fontFamily: 'var(--font-dm-sans)' }}>{session.user.name}</div>
              <div className="text-sm text-white/80" style={{ fontFamily: 'var(--font-dm-sans)' }}>{session.user.email}</div>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => signOut({ callbackUrl: '/' })}
              className="bg-white text-black px-6 py-2 rounded-full text-sm font-medium hover:bg-opacity-90 transition-all"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              Logout
            </motion.button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-8 py-12 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-fraunces)' }}>
            Welcome back, {session.user.name?.split(' ')[0]}!
          </h1>
          <p className="text-white/80 mb-8" style={{ fontFamily: 'var(--font-dm-sans)' }}>Plan your next adventure with trippy</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-white/10 backdrop-blur-md rounded-xl shadow-md p-6 hover:bg-white/20 transition-all cursor-pointer border border-white/20"
            onClick={() => router.push('/recommendations')}
          >
            <div className="w-12 h-12 mb-4 text-white">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-white" style={{ fontFamily: 'var(--font-fraunces)' }}>Discover Places</h3>
            <p className="text-white/80" style={{ fontFamily: 'var(--font-dm-sans)' }}>Swipe through personalized recommendations</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-white/10 backdrop-blur-md rounded-xl shadow-md p-6 hover:bg-white/20 transition-all cursor-pointer border border-white/20"
            onClick={() => router.push('/new-trip')}
          >
            <div className="w-12 h-12 mb-4 text-white">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-white" style={{ fontFamily: 'var(--font-fraunces)' }}>Create New Trip</h3>
            <p className="text-white/80" style={{ fontFamily: 'var(--font-dm-sans)' }}>Start planning your next adventure</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="bg-white/10 backdrop-blur-md rounded-xl shadow-md p-6 hover:bg-white/20 transition-all cursor-pointer border border-white/20"
            onClick={() => setShowJoinModal(true)}
          >
            <div className="w-12 h-12 mb-4 text-white">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-white" style={{ fontFamily: 'var(--font-fraunces)' }}>Join Trip</h3>
            <p className="text-white/80" style={{ fontFamily: 'var(--font-dm-sans)' }}>Enter a trip code to join a shared trip</p>
          </motion.div>
        </div>

        {showJoinModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => {
              setShowJoinModal(false);
              setJoinCode('');
              setJoinError(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl p-8 border border-white/20 max-w-md w-full"
            >
              <h3 className="text-2xl font-bold mb-4 text-white" style={{ fontFamily: 'var(--font-fraunces)' }}>
                Join Trip
              </h3>
              <p className="text-white/80 mb-6" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Enter the 6-character trip code to join
              </p>
              <div className="space-y-4">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                  maxLength={6}
                  className="w-full px-4 py-3 border border-white/20 rounded-lg focus:ring-2 focus:ring-white/50 focus:border-transparent bg-white/10 backdrop-blur-sm text-white placeholder-white/50 text-center text-2xl font-bold tracking-widest uppercase"
                  style={{ fontFamily: 'var(--font-dm-sans)' }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') handleJoinTrip();
                  }}
                />
                {joinError && (
                  <p className="text-red-400 text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {joinError}
                  </p>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowJoinModal(false);
                      setJoinCode('');
                      setJoinError(null);
                    }}
                    className="flex-1 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleJoinTrip}
                    disabled={isJoining || !joinCode.trim()}
                    className="flex-1 px-4 py-2 bg-white text-black rounded-lg hover:bg-opacity-90 disabled:bg-white/30 disabled:cursor-not-allowed transition-colors font-semibold"
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  >
                    {isJoining ? 'Joining...' : 'Join'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12 bg-white/10 backdrop-blur-md rounded-xl shadow-md p-8 border border-white/20"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-fraunces)' }}>My Trips</h2>
            {trips.length > 0 && (
              <span className="text-white/60 text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                {trips.length} {trips.length === 1 ? 'trip' : 'trips'}
              </span>
            )}
          </div>

          {isLoadingTrips ? (
            <div className="text-white/80 text-center py-8" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Loading trips...
            </div>
          ) : trips.length === 0 ? (
            <div className="text-white/80 text-center py-8" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              No trips yet. Create your first trip to get started!
            </div>
          ) : (
            <div className="space-y-4">
              {trips.map((trip) => {
                const isOwner = trip.userId === session?.user?.id;
                const hasSchedule = trip.itinerary && trip.itinerary.length > 0;
                const days = trip.itinerary ? Math.max(...trip.itinerary.map(item => item.day), 0) + 1 : 1;

                return (
                  <motion.div
                    key={trip._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
                    onClick={() => {
                      if (hasSchedule) {
                        router.push(`/schedule?tripId=${trip._id}&days=${days}`);
                      } else {
                        router.push(`/recommendations?tripId=${trip._id}`);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-semibold text-white" style={{ fontFamily: 'var(--font-fraunces)' }}>
                            {trip.destination}
                          </h3>
                          {isOwner && (
                            <span className="px-2 py-1 bg-blue-500/30 text-blue-200 text-xs rounded-full" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                              Owner
                            </span>
                          )}
                          {!isOwner && (
                            <span className="px-2 py-1 bg-purple-500/30 text-purple-200 text-xs rounded-full" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                              Participant
                            </span>
                          )}
                        </div>
                        <p className="text-white/60 text-sm mb-3" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                          {new Date(trip.startDate).toLocaleDateString()} - {new Date(trip.endDate).toLocaleDateString()}
                        </p>
                        {trip.tripCode && (
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-white/60 text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>Trip Code:</span>
                            <code className="px-3 py-1 bg-white/10 text-white font-mono text-sm rounded border border-white/20">
                              {trip.tripCode}
                            </code>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(trip.tripCode!);
                                setCopiedTripCode(trip.tripCode!);
                                setTimeout(() => setCopiedTripCode(null), 2000);
                              }}
                              className="text-white/60 hover:text-white transition-colors relative"
                              title="Copy trip code"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              {copiedTripCode === trip.tripCode && (
                                <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-green-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                                  copied!
                                </span>
                              )}
                            </button>
                          </div>
                        )}
                        {hasSchedule ? (
                          <div className="flex items-center gap-2 text-green-300 text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Schedule ready ({trip.itinerary?.length} activities)
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-yellow-300 text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {trip.status === 'collecting_preferences' ? 'Collecting preferences' : 'In progress'}
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        {hasSchedule ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/schedule?tripId=${trip._id}&days=${days}`);
                            }}
                            className="px-4 py-2 bg-white text-black rounded-lg hover:bg-opacity-90 transition-colors font-semibold text-sm"
                            style={{ fontFamily: 'var(--font-dm-sans)' }}
                          >
                            View Schedule
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/recommendations?tripId=${trip._id}`);
                            }}
                            className="px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors font-semibold text-sm"
                            style={{ fontFamily: 'var(--font-dm-sans)' }}
                          >
                            Continue
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
