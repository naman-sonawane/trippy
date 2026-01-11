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
    const [createdTrip, setCreatedTrip] = useState<{ _id: string; tripCode?: string } | null>(null);
    const [showCopied, setShowCopied] = useState(false);

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

                setCreatedTrip(trip);
            }
        } catch (error) {
            console.error("Error creating trip:", error);
        } finally {
            setIsCreating(false);
        }
    };

    if (createdTrip) {
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
                        className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl p-8 border border-white/20"
                    >
                        <div className="text-center mb-6">
                            <div className="mb-4 flex justify-center">
                              <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                              </svg>
                            </div>
                            <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-fraunces)' }}>
                                Trip Created!
                            </h2>
                            <p className="text-white/80" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                                Share this code with friends to plan together
                            </p>
                        </div>

                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 mb-6">
                            <label className="block text-sm font-semibold text-white/80 mb-3 text-center" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                                Your Trip Code
                            </label>
                            {createdTrip.tripCode ? (
                                <>
                                    <div className="flex items-center justify-center gap-3">
                                        <code className="px-6 py-4 bg-white/20 text-white font-mono text-3xl font-bold rounded-lg border-2 border-white/30 tracking-widest">
                                            {createdTrip.tripCode}
                                        </code>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(createdTrip.tripCode!);
                                                setShowCopied(true);
                                                setTimeout(() => setShowCopied(false), 2000);
                                            }}
                                            className="px-4 py-4 bg-white text-black rounded-lg hover:bg-opacity-90 transition-colors font-semibold relative"
                                            style={{ fontFamily: 'var(--font-dm-sans)' }}
                                            title="Copy trip code"
                                        >
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                            {showCopied && (
                                                <span className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-green-500 text-white text-xs px-3 py-1 rounded whitespace-nowrap">
                                                    copied!
                                                </span>
                                            )}
                                        </button>
                                    </div>
                                    <p className="text-center text-white/60 text-sm mt-4" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                                        Friends can enter this code on the dashboard to join your trip
                                    </p>
                                </>
                            ) : (
                                <div className="text-center">
                                    <p className="text-white/60 text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                                        Trip code will be available on the dashboard
                                    </p>
                                    <p className="text-white/40 text-xs mt-2" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                                        Trip ID: {createdTrip._id?.slice(0, 8)}...
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowTravelAgent(true);
                                    setCreatedTrip(null);
                                }}
                                className="flex-1 px-6 py-3 bg-white text-black rounded-full font-semibold hover:bg-opacity-90 transition-all"
                                style={{ fontFamily: 'var(--font-dm-sans)' }}
                            >
                                Continue Planning →
                            </button>
                            <button
                                onClick={() => {
                                    router.push('/dashboard');
                                }}
                                className="px-6 py-3 bg-white/10 text-white rounded-full font-semibold hover:bg-white/20 transition-all border border-white/20"
                                style={{ fontFamily: 'var(--font-dm-sans)' }}
                            >
                                Go to Dashboard
                            </button>
                        </div>
                    </motion.div>
                </div>
            </div>
        );
    }

    if (showTravelAgent) {
        return (
            <TravelAgentChat
                destination={destination}
                startDate={startDate}
                endDate={endDate}
                onEnd={() => {
                    const tripId = localStorage.getItem("currentTripId");
                    if (tripId) {
                        router.push(`/recommendations?tripId=${tripId}`);
                    } else {
                        router.push("/recommendations");
                    }
                }}
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
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                            </svg>
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