"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SwipeInterface } from "@/components/SwipeInterface";
import { motion } from "framer-motion";

export default function RecommendationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tripId = searchParams.get("tripId");
  const [destination, setDestination] = useState("");
  const [showSwipe, setShowSwipe] = useState(false);

  useEffect(() => {
    const savedDestination = localStorage.getItem("currentDestination");
    if (savedDestination) {
      setDestination(savedDestination);
      setShowSwipe(true);
    }
    
    // If tripId provided, fetch trip destination
    if (tripId) {
      fetch(`/api/trips/${tripId}`)
        .then(res => res.json())
        .then(data => {
          if (data.trip) {
            setDestination(data.trip.destination);
            setShowSwipe(true);
          }
        })
        .catch(err => console.error('Error fetching trip:', err));
    }
  }, [tripId]);

  const handleStart = () => {
    if (destination.trim()) {
      localStorage.setItem("currentDestination", destination);
      setShowSwipe(true);
    }
  };

  const handleComplete = () => {
    const tripId = localStorage.getItem("currentTripId");
    if (tripId) {
      const days = Math.ceil(
        (new Date().getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      ) || 3;
      router.push(`/schedule?tripId=${tripId}&days=${days}`);
    } else {
      setShowSwipe(false);
      setDestination("");
    }
  };

  return (
    <div className="min-h-screen relative p-4 sm:p-8"
         style={{
           backgroundImage: "url(/anotherbg2.jpg)",
           backgroundSize: "cover",
           backgroundPosition: "center",
           backgroundRepeat: "no-repeat",
           backgroundAttachment: "fixed"
         }}>
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/60" />
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-white/80 hover:text-white mb-4 transition-colors flex items-center gap-2"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-4xl font-bold text-white mb-2" style={{ fontFamily: "var(--font-fraunces)" }}>
            Discover Places
          </h1>
          <p className="text-white/80" style={{ fontFamily: "var(--font-dm-sans)" }}>
            Swipe through personalized recommendations for your destination
          </p>
        </div>

        {!showSwipe ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl p-8 border border-white/20"
          >
            <div className="mb-6">
              <label
                htmlFor="destination"
                className="block text-sm font-semibold text-white mb-2"
                style={{ fontFamily: "var(--font-dm-sans)" }}
              >
                Where are you going?
              </label>
              <input
                id="destination"
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g., Paris, Tokyo, New York"
                className="w-full px-4 py-3 border border-white/20 rounded-lg focus:ring-2 focus:ring-white/50 focus:border-transparent bg-white/10 backdrop-blur-sm text-white placeholder-white/50"
                style={{ fontFamily: "var(--font-dm-sans)" }}
                onKeyPress={(e) => {
                  if (e.key === "Enter") handleStart();
                }}
              />
            </div>

            <button
              onClick={handleStart}
              disabled={!destination.trim()}
              className="w-full px-6 py-3 bg-white text-black rounded-lg font-semibold hover:bg-opacity-90 disabled:bg-white/30 disabled:cursor-not-allowed transition-all"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              Start Swiping
            </button>

            <div className="mt-8 p-4 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
              <h3 className="font-semibold text-white mb-2" style={{ fontFamily: "var(--font-fraunces)" }}>
                How it works:
              </h3>
              <ul className="space-y-2 text-sm text-white/80" style={{ fontFamily: "var(--font-dm-sans)" }}>
                <li>• Swipe right to save places you like</li>
                <li>• Swipe left to pass on places</li>
                <li>
                  • Your preferences help us learn what you enjoy
                </li>
                <li>• Recommendations get better the more you swipe</li>
              </ul>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl p-8 border border-white/20"
          >
            {tripId && (
              <div className="mb-4 p-3 bg-blue-500/20 backdrop-blur-sm rounded-lg border border-blue-500/30">
                <p className="text-sm text-blue-200" style={{ fontFamily: "var(--font-dm-sans)" }}>
                  Planning together! Recommendations are tailored to all trip participants.
                </p>
              </div>
            )}
            <SwipeInterface destination={destination} tripId={tripId || undefined} onComplete={handleComplete} />
          </motion.div>
        )}
      </div>
    </div>
  );
}
