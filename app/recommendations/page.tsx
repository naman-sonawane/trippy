"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SwipeInterface } from "@/components/SwipeInterface";
import { motion } from "framer-motion";

export default function RecommendationsPage() {
  const router = useRouter();
  const [destination, setDestination] = useState("");
  const [showSwipe, setShowSwipe] = useState(false);

  useEffect(() => {
    const savedDestination = localStorage.getItem("currentDestination");
    if (savedDestination) {
      setDestination(savedDestination);
      setShowSwipe(true);
    }
  }, []);

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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-100 dark:from-zinc-950 dark:to-zinc-900 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-gray-700 dark:text-zinc-300 hover:text-gray-900 dark:hover:text-zinc-100 mb-4"
          >
            ← Back
          </button>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-zinc-50 mb-2">
            Discover Places
          </h1>
          <p className="text-gray-600 dark:text-zinc-400">
            Swipe through personalized recommendations for your destination
          </p>
        </div>

        {!showSwipe ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8"
          >
            <div className="mb-6">
              <label
                htmlFor="destination"
                className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2"
              >
                Where are you going?
              </label>
              <input
                id="destination"
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g., Paris, Tokyo, New York"
                className="w-full px-4 py-3 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-50"
                onKeyPress={(e) => {
                  if (e.key === "Enter") handleStart();
                }}
              />
            </div>

            <button
              onClick={handleStart}
              disabled={!destination.trim()}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all"
            >
              Start Swiping
            </button>

            <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
              <h3 className="font-semibold text-gray-900 dark:text-zinc-50 mb-2">
                How it works:
              </h3>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-zinc-300">
                <li>• Swipe right (or tap ❤️) to save places you like</li>
                <li>• Swipe left (or tap ✕) to pass on places</li>
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
            className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8"
          >
            <SwipeInterface destination={destination} onComplete={handleComplete} />
          </motion.div>
        )}
      </div>
    </div>
  );
}
