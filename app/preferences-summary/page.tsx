"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

interface TravelPreferences {
  age?: number;
  budget?: number;
  walkingPreference?: number;
  timePreference?: 'day' | 'night' | 'both';
  travelingWith?: string;
}

export default function PreferencesSummaryPage() {
  const router = useRouter();
  const [preferences, setPreferences] = useState<TravelPreferences | null>(null);
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedPreferences = localStorage.getItem("travelPreferences");
    const storedDestination = localStorage.getItem("currentDestination");

    if (storedPreferences) {
      setPreferences(JSON.parse(storedPreferences));
    }

    if (storedDestination) {
      setDestination(storedDestination);
    }

    setLoading(false);
  }, []);

  const handleContinue = () => {
    router.push("/recommendations");
  };

  const getWalkingDescription = (level?: number) => {
    if (!level) return "not specified";
    if (level <= 3) return "minimal walking";
    if (level <= 6) return "moderate walking";
    return "lots of walking";
  };

  const getTimePreferenceIcon = (pref?: string) => {
    if (pref === "day") return (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    );
    if (pref === "night") return (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    );
    return (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
           style={{
             backgroundImage: "url(/landingbg.jpg)",
             backgroundSize: "cover",
             backgroundPosition: "center"
           }}>
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/60" />
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white relative z-10"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-8"
         style={{
           backgroundImage: "url(/landingbg.jpg)",
           backgroundSize: "cover",
           backgroundPosition: "center"
         }}>
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/60" />
      
      <div className="max-w-3xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-2" style={{ fontFamily: "var(--font-fraunces)" }}>
            your trip preferences
          </h1>
          <p className="text-white/80" style={{ fontFamily: "var(--font-dm-sans)" }}>
            we'll use this to personalize your {destination} experience
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl p-8 mb-6 border border-white/20"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {preferences?.age && (
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-white" style={{ fontFamily: "var(--font-dm-sans)" }}>age</h3>
                  <p className="text-white/80" style={{ fontFamily: "var(--font-dm-sans)" }}>{preferences.age} years old</p>
                </div>
              </div>
            )}

            {preferences?.budget && (
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-white" style={{ fontFamily: "var(--font-dm-sans)" }}>budget</h3>
                  <p className="text-white/80" style={{ fontFamily: "var(--font-dm-sans)" }}>${preferences.budget.toLocaleString()}</p>
                </div>
              </div>
            )}

            {preferences?.walkingPreference && (
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-white" style={{ fontFamily: "var(--font-dm-sans)" }}>activity level</h3>
                  <p className="text-white/80" style={{ fontFamily: "var(--font-dm-sans)" }}>
                    {getWalkingDescription(preferences.walkingPreference)} ({preferences.walkingPreference}/10)
                  </p>
                </div>
              </div>
            )}

            {preferences?.timePreference && (
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white">
                  {getTimePreferenceIcon(preferences.timePreference)}
                </div>
                <div>
                  <h3 className="font-semibold text-white" style={{ fontFamily: "var(--font-dm-sans)" }}>preferred time</h3>
                  <p className="text-white/80 capitalize" style={{ fontFamily: "var(--font-dm-sans)" }}>{preferences.timePreference}</p>
                </div>
              </div>
            )}

            {preferences?.travelingWith && (
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-white" style={{ fontFamily: "var(--font-dm-sans)" }}>traveling with</h3>
                  <p className="text-white/80 capitalize" style={{ fontFamily: "var(--font-dm-sans)" }}>{preferences.travelingWith}</p>
                </div>
              </div>
            )}
          </div>

          {!preferences && (
            <div className="text-center py-8">
              <div className="text-white/60 mb-4 flex justify-center">
                <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <p className="text-white/80" style={{ fontFamily: "var(--font-dm-sans)" }}>
                no preferences found. you can still discover places!
              </p>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex gap-4"
        >
          <button
            onClick={() => router.back()}
            className="flex-1 px-6 py-4 bg-white/10 backdrop-blur-md text-white rounded-full font-semibold hover:bg-white/20 transition-all text-lg border border-white/20"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            ← back
          </button>
          <button
            onClick={handleContinue}
            className="flex-1 px-6 py-4 bg-white text-black rounded-full font-semibold hover:bg-opacity-90 transition-all text-lg"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            discover places →
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6 p-4 bg-white/10 backdrop-blur-md rounded-lg border border-white/20"
        >
          <p className="text-sm text-white flex items-start gap-2" style={{ fontFamily: "var(--font-dm-sans)" }}>
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span><strong>tip:</strong> we'll use these preferences to show you places that match your style. swipe right on places you like!</span>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
