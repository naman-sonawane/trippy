"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import TravelAgentChat from "@/components/TravelAgentChat";

export default function NewTripPage() {
    const router = useRouter();
    const { data: session } = useSession();
    const [destination, setDestination] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [showTravelAgent, setShowTravelAgent] = useState(false);

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
                localStorage.setItem("tripStartDate", startDate);
                localStorage.setItem("tripEndDate", endDate);

                setShowTravelAgent(true);
            }
        } catch (error) {
            console.error("Error creating trip:", error);
        } finally {
            setIsCreating(false);
        }
    };

    if (showTravelAgent) {
        return (
            <TravelAgentChat
                destination={destination}
                startDate={startDate}
                endDate={endDate}
                onEnd={() => setShowTravelAgent(false)}
            />
        );
    }

    return (
        <div className="min-h-screen p-4 sm:p-8"
             style={{
               backgroundImage: "url(/dashbg.jpg)",
               backgroundSize: "cover",
               backgroundPosition: "center"
             }}>
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/60" />
            
            <div className="max-w-2xl mx-auto relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <button
                        onClick={() => router.back()}
                        className="text-white hover:text-white/80 mb-4 transition-colors"
                        style={{ fontFamily: 'var(--font-dm-sans)' }}
                    >
                        ← Back
                    </button>
                    <h1 className="text-4xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-fraunces)' }}>
                        Create New Trip
                    </h1>
                    <p className="text-white/80" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        Tell us where you're going and we'll help you plan the perfect itinerary
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl p-8 border border-white/20"
                >
                    <div className="space-y-6">
                        <div>
                            <label
                                htmlFor="destination"
                                className="block text-sm font-semibold text-white mb-2"
                                style={{ fontFamily: 'var(--font-dm-sans)' }}
                            >
                                Destination *
                            </label>
                            <input
                                id="destination"
                                type="text"
                                value={destination}
                                onChange={(e) => setDestination(e.target.value)}
                                placeholder="e.g., Paris, Tokyo, New York, Barcelona"
                                className="w-full px-4 py-3 border border-white/20 rounded-lg focus:ring-2 focus:ring-white/50 focus:border-transparent bg-white/10 backdrop-blur-sm text-white placeholder-white/50"
                                style={{ fontFamily: 'var(--font-dm-sans)' }}
                            />
                            <p className="mt-2 text-xs text-white/60" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                                Available destinations: Paris, Tokyo, New York, Barcelona
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label
                                    htmlFor="startDate"
                                    className="block text-sm font-semibold text-white mb-2"
                                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                                >
                                    Start Date *
                                </label>
                                <input
                                    id="startDate"
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full px-4 py-3 border border-white/20 rounded-lg focus:ring-2 focus:ring-white/50 focus:border-transparent bg-white/10 backdrop-blur-sm text-white"
                                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="endDate"
                                    className="block text-sm font-semibold text-white mb-2"
                                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                                >
                                    End Date *
                                </label>
                                <input
                                    id="endDate"
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    min={startDate}
                                    className="w-full px-4 py-3 border border-white/20 rounded-lg focus:ring-2 focus:ring-white/50 focus:border-transparent bg-white/10 backdrop-blur-sm text-white"
                                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                                />
                            </div>
                        </div>

                        <div className="pt-4">
                            <button
                                onClick={handleCreateTrip}
                                disabled={!destination || !startDate || !endDate || isCreating}
                                className="w-full px-6 py-4 bg-white text-black rounded-full font-semibold hover:bg-opacity-90 disabled:bg-white/30 disabled:cursor-not-allowed transition-all text-lg"
                                style={{ fontFamily: 'var(--font-dm-sans)' }}
                            >
                                {isCreating ? "Creating..." : "Talk to Travel Agent →"}
                            </button>
                        </div>
                    </div>

                    <div className="mt-8 p-4 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                        <h3 className="font-semibold text-white mb-2 flex items-center gap-2" style={{ fontFamily: 'var(--font-fraunces)' }}>
                            <span className="text-xl">🗺️</span>
                            What happens next?
                        </h3>
                        <ol className="space-y-2 text-sm text-white/80 ml-6 list-decimal" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                            <li>Chat with our AI travel agent to personalize your trip</li>
                            <li>Swipe through curated place recommendations</li>
                            <li>Build your perfect itinerary</li>
                        </ol>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}