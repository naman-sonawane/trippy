"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";

export default function NewTripPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateTrip = async () => {
    if (!destination || !startDate || !endDate) return;

    setIsCreating(true);
    try {
      const response = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination,
          startDate,
          endDate,
          activities: [],
        }),
      });

      if (response.ok) {
        const { trip } = await response.json();
        localStorage.setItem("currentTripId", trip._id);
        localStorage.setItem("currentDestination", destination);
        router.push("/agent");
      }
    } catch (error) {
      console.error("Error creating trip:", error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 dark:from-zinc-950 dark:to-zinc-900 p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => router.back()}
            className="text-gray-700 dark:text-zinc-300 hover:text-gray-900 dark:hover:text-zinc-100 mb-4"
          >
            ← Back
          </button>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-zinc-50 mb-2">
            Create New Trip
          </h1>
          <p className="text-gray-600 dark:text-zinc-400">
            Tell us where you're going and we'll help you plan the perfect itinerary
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8"
        >
          <div className="space-y-6">
            <div>
              <label
                htmlFor="destination"
                className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2"
              >
                Destination *
              </label>
              <input
                id="destination"
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g., Paris, Tokyo, New York, Barcelona"
                className="w-full px-4 py-3 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-50"
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-zinc-500">
                Available destinations: Paris, Tokyo, New York, Barcelona
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="startDate"
                  className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2"
                >
                  Start Date *
                </label>
                <input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-50"
                />
              </div>

              <div>
                <label
                  htmlFor="endDate"
                  className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2"
                >
                  End Date *
                </label>
                <input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-50"
                />
              </div>
            </div>

            <div className="pt-4">
              <button
                onClick={handleCreateTrip}
                disabled={!destination || !startDate || !endDate || isCreating}
                className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all text-lg"
              >
                {isCreating ? "Creating..." : "Continue to AI Travel Agent →"}
              </button>
            </div>
          </div>

          <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
            <h3 className="font-semibold text-gray-900 dark:text-zinc-50 mb-2 flex items-center gap-2">
              <span className="text-xl">🗺️</span>
              What happens next?
            </h3>
            <ol className="space-y-2 text-sm text-gray-700 dark:text-zinc-300 ml-6 list-decimal">
              <li>You'll chat with our AI travel agent who will ask about your preferences</li>
              <li>Swipe through personalized place recommendations</li>
              <li>Build your custom itinerary</li>
            </ol>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
