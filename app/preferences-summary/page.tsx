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
    if (pref === "day") return "☀️";
    if (pref === "night") return "🌙";
    return "🌅";
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
                <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-2xl">
                  👤
                </div>
                <div>
                  <h3 className="font-semibold text-white" style={{ fontFamily: "var(--font-dm-sans)" }}>age</h3>
                  <p className="text-white/80" style={{ fontFamily: "var(--font-dm-sans)" }}>{preferences.age} years old</p>
                </div>
              </div>
            )}

            {preferences?.budget && (
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-2xl">
                  💰
                </div>
                <div>
                  <h3 className="font-semibold text-white" style={{ fontFamily: "var(--font-dm-sans)" }}>budget</h3>
                  <p className="text-white/80" style={{ fontFamily: "var(--font-dm-sans)" }}>${preferences.budget.toLocaleString()}</p>
                </div>
              </div>
            )}

            {preferences?.walkingPreference && (
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-2xl">
                  🚶
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
                <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-2xl">
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
                <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-2xl">
                  👥
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
              <div className="text-white/60 mb-4">
                <span className="text-5xl">🤷</span>
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
          <p className="text-sm text-white" style={{ fontFamily: "var(--font-dm-sans)" }}>
            💡 <strong>tip:</strong> we'll use these preferences to show you places that match your style. swipe right on places you like!
          </p>
        </motion.div>
      </div>
    </div>
  );
}
