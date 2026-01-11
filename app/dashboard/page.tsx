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
  status?: string;
  userId: string;
}

const Dashboard = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [tripId, setTripId] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(true);
  const [copiedTripId, setCopiedTripId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    } else if (status === 'authenticated') {
      loadTrips();
    }
  }, [status, router]);

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

  const copyTripId = async (tripId: string) => {
    try {
      await navigator.clipboard.writeText(tripId);
      setCopiedTripId(tripId);
      setTimeout(() => setCopiedTripId(null), 2000);
    } catch (error) {
      console.error('Failed to copy trip ID:', error);
    }
  };

  const handleJoinTrip = async () => {
    if (!tripId.trim()) {
      setJoinError('Please enter a trip ID');
      return;
    }

    setIsJoining(true);
    setJoinError(null);

    try {
      const response = await fetch('/api/trips/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId: tripId.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join trip');
      }

      // Success - redirect to recommendations page with tripId
      router.push(`/recommendations?tripId=${tripId.trim()}`);
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : 'Failed to join trip');
    } finally {
      setIsJoining(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Trippy" width={36} height={36} className="w-9 h-9" />
            <span className="text-2xl font-normal" style={{ fontFamily: 'var(--font-dm-sans)' }}>trippy</span>
          </div>

          <div className="flex items-center gap-4">
            {session.user.image && (
              <Image 
                src={session.user.image} 
                alt={session.user.name || "User"} 
                width={40} 
                height={40} 
                className="rounded-full"
              />
            )}
            <div className="text-right">
              <div className="font-medium text-gray-900">{session.user.name}</div>
              <div className="text-sm text-gray-500">{session.user.email}</div>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => signOut({ callbackUrl: '/' })}
              className="bg-red-500 text-white px-6 py-2 rounded-full text-sm font-medium hover:bg-red-600 transition-all"
            >
              Logout
            </motion.button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'var(--font-fraunces)' }}>
            Welcome back, {session.user.name?.split(' ')[0]}!
          </h1>
          <p className="text-gray-600 mb-8">Plan your next adventure with trippy</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => router.push('/recommendations')}
          >
            <div className="text-4xl mb-4">💝</div>
            <h3 className="text-xl font-semibold mb-2">Discover Places</h3>
            <p className="text-gray-600">Swipe through personalized recommendations</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => router.push('/new-trip')}
          >
            <div className="text-4xl mb-4">✈️</div>
            <h3 className="text-xl font-semibold mb-2">Create New Trip</h3>
            <p className="text-gray-600">Start planning your next adventure</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => setIsJoinModalOpen(true)}
          >
            <div className="text-4xl mb-4">👥</div>
            <h3 className="text-xl font-semibold mb-2">Join Trip</h3>
            <p className="text-gray-600">Join a trip with a trip ID</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
          >
            <div className="text-4xl mb-4">📍</div>
            <h3 className="text-xl font-semibold mb-2">My Trips</h3>
            <p className="text-gray-600">View all your saved itineraries</p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12 bg-white rounded-xl shadow-md p-8"
        >
          <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'var(--font-fraunces)' }}>My Trips</h2>
          {isLoadingTrips ? (
            <div className="text-gray-500 text-center py-8">Loading trips...</div>
          ) : trips.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              No trips yet. Create your first trip to get started!
            </div>
          ) : (
            <div className="space-y-4">
              {trips.map((trip) => {
                const isOwner = trip.userId === session?.user?.id;
                const statusLabels: Record<string, string> = {
                  collecting_preferences: 'Collecting Preferences',
                  ready: 'Ready',
                  active: 'Active',
                };
                const statusColors: Record<string, string> = {
                  collecting_preferences: 'bg-yellow-100 text-yellow-800',
                  ready: 'bg-blue-100 text-blue-800',
                  active: 'bg-green-100 text-green-800',
                };
                return (
                  <div
                    key={trip._id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{trip.destination}</h3>
                          {trip.status && (
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full ${
                                statusColors[trip.status] || 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {statusLabels[trip.status] || trip.status}
                            </span>
                          )}
                          {!isOwner && (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                              Joined
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-3">
                          {new Date(trip.startDate).toLocaleDateString()} -{' '}
                          {new Date(trip.endDate).toLocaleDateString()}
                        </p>
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium text-gray-700">Trip ID:</label>
                          <div className="flex items-center gap-2 flex-1">
                            <code className="px-3 py-1.5 bg-gray-100 rounded-md text-sm font-mono text-gray-800 flex-1">
                              {trip._id}
                            </code>
                            <button
                              onClick={() => copyTripId(trip._id)}
                              className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-1"
                            >
                              {copiedTripId === trip._id ? (
                                <>
                                  <span>✓</span>
                                  <span>Copied!</span>
                                </>
                              ) : (
                                <>
                                  <span>📋</span>
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="ml-4 flex flex-col gap-2">
                        {trip.status === 'ready' || trip.status === 'active' ? (
                          <button
                            onClick={() => router.push(`/schedule?tripId=${trip._id}`)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                          >
                            View Schedule
                          </button>
                        ) : (
                          <button
                            onClick={() => router.push(`/recommendations?tripId=${trip._id}`)}
                            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm font-medium"
                          >
                            Continue Planning
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Join Trip Modal */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full"
          >
            <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'var(--font-fraunces)' }}>
              Join Trip
            </h2>
            <p className="text-gray-600 mb-4">
              Enter the trip ID to join a trip and start planning together.
            </p>
            
            <div className="mb-4">
              <label htmlFor="tripId" className="block text-sm font-medium text-gray-700 mb-2">
                Trip ID
              </label>
              <input
                id="tripId"
                type="text"
                value={tripId}
                onChange={(e) => {
                  setTripId(e.target.value);
                  setJoinError(null);
                }}
                placeholder="Enter trip ID"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleJoinTrip();
                  }
                }}
              />
              {joinError && (
                <p className="mt-2 text-sm text-red-600">{joinError}</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setIsJoinModalOpen(false);
                  setTripId('');
                  setJoinError(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                disabled={isJoining}
              >
                Cancel
              </button>
              <button
                onClick={handleJoinTrip}
                disabled={isJoining}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
              >
                {isJoining ? 'Joining...' : 'Join Trip'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
