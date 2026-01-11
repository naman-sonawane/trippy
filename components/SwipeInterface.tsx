"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";

export interface RecommendationItem {
  id: string;
  name: string;
  category: string;
  description: string;
  features: {
    tags?: string[];
    price_range?: string;
    energy_level?: string;
  };
  location?: string;
  type: "place" | "activity";
  score: number;
}

interface SwipeCardProps {
  item: RecommendationItem;
  onSwipe: (direction: "like" | "dislike") => void;
  isTop: boolean;
}

const SwipeCard = ({ item, onSwipe, isTop }: SwipeCardProps) => {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 100) {
      onSwipe(info.offset.x > 0 ? "like" : "dislike");
    }
  };

  return (
    <motion.div
      className="absolute w-full h-full"
      style={{
        x,
        rotate,
        opacity,
        cursor: isTop ? "grab" : "default",
        pointerEvents: isTop ? "auto" : "none",
      }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      whileDrag={{ cursor: "grabbing" }}
      initial={{ scale: isTop ? 1 : 0.95, y: isTop ? 0 : 10 }}
      animate={{ scale: isTop ? 1 : 0.95, y: isTop ? 0 : 10 }}
      transition={{ duration: 0.2 }}
    >
      <div className="w-full h-full bg-white dark:bg-zinc-900 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-zinc-800">
        <div className="h-2/5 bg-gradient-to-br from-blue-500 to-purple-600 relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-white text-6xl font-bold opacity-20">
              {item.type === "place" ? "📍" : "🎯"}
            </div>
          </div>
          <div className="absolute bottom-4 left-4 right-4">
            <h2 className="text-2xl font-bold text-white drop-shadow-lg">
              {item.name}
            </h2>
            <p className="text-white/90 text-sm mt-1">{item.category}</p>
          </div>
        </div>

        <div className="h-3/5 p-6 overflow-y-auto">
          {item.location && (
            <div className="mb-3">
              <span className="text-sm font-semibold text-gray-700 dark:text-zinc-300">
                📍 {item.location}
              </span>
            </div>
          )}

          {item.description && (
            <p className="text-gray-600 dark:text-zinc-400 mb-4">
              {item.description}
            </p>
          )}

          <div className="space-y-2">
            {item.features.tags && item.features.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {item.features.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {item.features.price_range && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-700 dark:text-zinc-300">
                  💰 Price:
                </span>
                <span className="text-sm text-gray-600 dark:text-zinc-400">
                  {item.features.price_range}
                </span>
              </div>
            )}

            {item.features.energy_level && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-700 dark:text-zinc-300">
                  ⚡ Energy:
                </span>
                <span className="text-sm text-gray-600 dark:text-zinc-400">
                  {item.features.energy_level}
                </span>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-zinc-500">
                  Match Score
                </span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-gray-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-600"
                      style={{ width: `${Math.min(100, item.score * 10)}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
                    {(item.score * 10).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

interface SwipeInterfaceProps {
  destination: string;
  tripId?: string;
  onComplete?: () => void;
}

export const SwipeInterface = ({
  destination,
  tripId,
  onComplete,
}: SwipeInterfaceProps) => {
  const router = useRouter();
  const [cards, setCards] = useState<RecommendationItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [likedCount, setLikedCount] = useState(0);
  const [dislikedCount, setDislikedCount] = useState(0);
  const [isGeneratingSchedule, setIsGeneratingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  useEffect(() => {
    loadRecommendations();
  }, [destination, tripId]);

  const loadRecommendations = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination, topN: 20, tripId }),
      });

      if (response.ok) {
        const data = await response.json();
        setCards(data.recommendations || []);
        setCurrentIndex(0);
      }
    } catch (error) {
      console.error("Error loading recommendations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwipe = async (direction: "like" | "dislike") => {
    const currentCard = cards[currentIndex];
    if (!currentCard) return;

    try {
      const response = await fetch("/api/swipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: currentCard.id,
          action: direction,
          destination,
          tripId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to record swipe");
      }

      const data = await response.json();

      if (direction === "like") {
        setLikedCount((prev) => prev + 1);
      } else {
        setDislikedCount((prev) => prev + 1);
      }

      // Check if schedule is ready before incrementing
      if (data.scheduleReady) {
        setCurrentIndex((prev) => prev + 1);
        await generateSchedule();
        return;
      }

      // Check if we've reached the end before incrementing
      const nextIndex = currentIndex + 1;
      if (nextIndex >= cards.length) {
        setCurrentIndex(nextIndex);
        if (onComplete) onComplete();
      } else {
        setCurrentIndex(nextIndex);
      }
    } catch (error) {
      console.error("Error recording swipe:", error);
    }
  };

  const generateSchedule = async () => {
    const tripId = localStorage.getItem("currentTripId");
    if (!tripId) {
      setScheduleError("Trip ID not found. Please create a trip first.");
      return;
    }

    setIsGeneratingSchedule(true);
    setScheduleError(null);

    try {
      const response = await fetch("/api/generate-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination,
          tripId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate schedule");
      }

      const data = await response.json();
      const days = data.days || 3;

      // Navigate to schedule page
      router.push(`/schedule?tripId=${tripId}&days=${days}`);
    } catch (error) {
      console.error("Error generating schedule:", error);
      setScheduleError(
        error instanceof Error
          ? error.message
          : "Failed to generate schedule. Please try again."
      );
      setIsGeneratingSchedule(false);
      // Still allow manual completion if schedule generation fails
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <div className="text-gray-900 dark:text-zinc-50">
          Loading recommendations...
        </div>
      </div>
    );
  }

  if (isGeneratingSchedule) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px] gap-4">
        <div className="text-6xl mb-4">✨</div>
        <div className="text-gray-900 dark:text-zinc-50 text-2xl font-bold">
          Generating Your Schedule
        </div>
        <div className="text-gray-600 dark:text-zinc-400">
          <p className="text-center">
            We're creating a personalized itinerary for {destination}
          </p>
          <p className="text-center text-sm mt-2">
            This may take a moment...
          </p>
        </div>
        {scheduleError && (
          <div className="mt-4 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg max-w-md">
            <p className="text-sm">{scheduleError}</p>
            <button
              onClick={() => {
                setIsGeneratingSchedule(false);
                setScheduleError(null);
              }}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
            >
              Continue Swiping
            </button>
          </div>
        )}
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px] gap-4">
        <div className="text-2xl">🏝️</div>
        <div className="text-gray-900 dark:text-zinc-50 text-lg font-semibold">
          No recommendations found
        </div>
        <p className="text-gray-600 dark:text-zinc-400 text-sm">
          Try a different destination or check back later
        </p>
      </div>
    );
  }

  if (currentIndex >= cards.length) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px] gap-4">
        <div className="text-6xl mb-4">✨</div>
        <div className="text-gray-900 dark:text-zinc-50 text-2xl font-bold">
          All Done!
        </div>
        <div className="text-gray-600 dark:text-zinc-400">
          <p className="text-center">
            You've seen all recommendations for {destination}
          </p>
          <div className="mt-4 flex gap-6 justify-center text-sm">
            <span className="text-green-600 dark:text-green-400">
              ❤️ Liked: {likedCount}
            </span>
            <span className="text-red-600 dark:text-red-400">
              ✕ Passed: {dislikedCount}
            </span>
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <button
            onClick={loadRecommendations}
            className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Restart
          </button>
          {onComplete && (
            <button
              onClick={onComplete}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Build Itinerary →
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex gap-6 text-sm text-gray-600 dark:text-zinc-400">
        <span>❤️ {likedCount}</span>
        <span>✕ {dislikedCount}</span>
        <span>
          {currentIndex + 1} / {cards.length}
        </span>
      </div>

      <div className="relative w-full max-w-md h-[600px]">
        {cards.slice(currentIndex, currentIndex + 2).map((card, idx) => (
          <SwipeCard
            key={card.id}
            item={card}
            onSwipe={handleSwipe}
            isTop={idx === 0}
          />
        ))}
      </div>

      <div className="flex gap-6">
        <button
          onClick={() => handleSwipe("dislike")}
          className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white text-2xl flex items-center justify-center shadow-lg transition-transform hover:scale-110"
        >
          ✕
        </button>
        <button
          onClick={() => handleSwipe("like")}
          className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 text-white text-2xl flex items-center justify-center shadow-lg transition-transform hover:scale-110"
        >
          ❤️
        </button>
      </div>

      <p className="text-gray-500 dark:text-zinc-500 text-sm">
        Swipe right to like, left to pass
      </p>
    </div>
  );
};
