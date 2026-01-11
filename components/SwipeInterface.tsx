"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
    budget?: string;
    energy_level?: string;
    image_url?: string;
  };
  location?: string;
  type: "place" | "activity";
  score: number;
}

interface SwipeCardProps {
  item: RecommendationItem;
  onSwipe: (direction: "like" | "dislike") => void;
  isTop: boolean;
  onPanoramicClick?: () => void;
}

const SwipeCard = ({ item, onSwipe, isTop, onPanoramicClick }: SwipeCardProps) => {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 100 && isTop) {
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
        zIndex: isTop ? 10 : 9,
      }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      whileDrag={{ cursor: "grabbing", zIndex: 20 }}
      initial={{ scale: isTop ? 1 : 0.95, y: isTop ? 0 : 10 }}
      animate={{ scale: isTop ? 1 : 0.95, y: isTop ? 0 : 10 }}
      transition={{ duration: 0.2 }}
    >
      <div className="w-full h-full bg-white dark:bg-zinc-900 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-zinc-800">
        {item.features.image_url ? (
          <div className="h-2/5 relative bg-gray-200 dark:bg-zinc-800">
            <img
              src={item.features.image_url}
              alt={item.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                if (e.currentTarget.nextElementSibling) {
                  (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                }
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute top-4 right-4 z-20">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPanoramicClick?.();
                }}
                className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white flex items-center justify-center shadow-lg transition-all hover:scale-110"
                aria-label="View on map"
                title="View on map"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
            <div className="absolute bottom-4 left-4 right-4">
              <h2 className="text-2xl font-bold text-white drop-shadow-lg">
                {item.name}
              </h2>
              <p className="text-white/90 text-sm mt-1">{item.category}</p>
            </div>
          </div>
        ) : (
          <div className="h-2/5 bg-gradient-to-br from-blue-500 to-purple-600 relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-16 h-16 text-white opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="absolute top-4 right-4 z-20">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPanoramicClick?.();
                }}
                className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white flex items-center justify-center shadow-lg transition-all hover:scale-110"
                aria-label="View on map"
                title="View on map"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
            <div className="absolute bottom-4 left-4 right-4">
              <h2 className="text-2xl font-bold text-white drop-shadow-lg">
                {item.name}
              </h2>
              <p className="text-white/90 text-sm mt-1">{item.category}</p>
            </div>
          </div>
        )}

        <div className="h-3/5 p-6 overflow-y-auto">
          {item.location && (
            <div className="mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-600 dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-sm font-semibold text-gray-700 dark:text-zinc-300">
                {item.location}
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

            {(item.features.budget || item.features.price_range) && (
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-600 dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-semibold text-gray-700 dark:text-zinc-300">
                  Budget:
                </span>
                <span className="text-sm text-gray-600 dark:text-zinc-400">
                  {item.features.budget || item.features.price_range}
                </span>
              </div>
            )}

            {item.features.energy_level && (
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-600 dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-sm font-semibold text-gray-700 dark:text-zinc-300">
                  Energy:
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
                      style={{ width: `${Math.min(100, 100 - item.score * 10)}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
                    {(100 - item.score * 10).toFixed(0)}%
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
  const [panoramicLocation, setPanoramicLocation] = useState<string | null>(null);
  const [isPanoramicOpen, setIsPanoramicOpen] = useState(false);
  const [isFingerTrackingActive, setIsFingerTrackingActive] = useState(true);
  const [lastSwipeDetected, setLastSwipeDetected] = useState<0 | 1 | 2>(0);
  const handleSwipeRef = useRef<((direction: "like" | "dislike") => Promise<void>) | undefined>(undefined);
  
  const ALGORITHM_API_URL = "http://localhost:8000";

  useEffect(() => {
    loadRecommendations();
  }, [destination, tripId]);

  useEffect(() => {
    const checkBackendAndEnable = async () => {
      try {
        const response = await fetch(`${ALGORITHM_API_URL}/api/status`);
        const data = await response.json();
        if (data.running) {
          setIsFingerTrackingActive(true);
        }
      } catch (error) {
        console.error("Cannot connect to algorithm API:", error);
      }
    };
    checkBackendAndEnable();
  }, []);

  useEffect(() => {
    if (!isFingerTrackingActive) return;

    let alive = true;
    let inFlight = false;
    let lastSwipeValue = 0;

    const POLL_INTERVAL_MS = 100;

    async function checkSwipe() {
      if (!alive || inFlight || currentIndex >= cards.length) return;

      inFlight = true;
      try {
        const response = await fetch(`${ALGORITHM_API_URL}/api/finger-track`);
        if (!alive) return;

        if (response.ok) {
          const data = await response.json();
          const swipe = data.swipe as 0 | 1 | 2;
          
          setLastSwipeDetected(swipe);

          if (swipe !== 0 && swipe !== lastSwipeValue) {
            lastSwipeValue = swipe;
            if (swipe === 1 && handleSwipeRef.current) {
              handleSwipeRef.current("like");
            } else if (swipe === 2 && handleSwipeRef.current) {
              handleSwipeRef.current("dislike");
            }
          } else if (swipe === 0) {
            lastSwipeValue = 0;
          }
        } else {
          console.error("Algorithm API error:", response.status, response.statusText);
        }
      } catch (error) {
        console.error("Error checking swipe from algorithm API:", error);
      } finally {
        inFlight = false;
      }
    }

    const interval = setInterval(() => void checkSwipe(), POLL_INTERVAL_MS);

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [isFingerTrackingActive, currentIndex, cards.length]);

  const toggleFingerTracking = async () => {
    if (!isFingerTrackingActive) {
      try {
        const response = await fetch(`${ALGORITHM_API_URL}/api/status`);
        const data = await response.json();
        if (data.running) {
          setIsFingerTrackingActive(true);
        } else {
          alert("Algorithm API camera not running. Please start the Python backend first (algorithm/api.py).");
        }
      } catch (error) {
        alert(`Cannot connect to algorithm API at ${ALGORITHM_API_URL}. Make sure the Python server is running on port 8000.`);
      }
    } else {
      setIsFingerTrackingActive(false);
    }
  };

  const generateFallbackRecommendations = (dest: string): RecommendationItem[] => {
    const categories = [
      { category: "Restaurant", tags: ["dining", "local cuisine"] },
      { category: "Museum", tags: ["culture", "history", "art"] },
      { category: "Park", tags: ["nature", "outdoors", "relaxing"] },
      { category: "Landmark", tags: ["iconic", "sightseeing", "photo spot"] },
      { category: "Market", tags: ["shopping", "local", "souvenirs"] },
      { category: "Cafe", tags: ["coffee", "relaxing", "cozy"] },
      { category: "Beach", tags: ["water", "sun", "relaxing"] },
      { category: "Theater", tags: ["entertainment", "culture", "evening"] },
      { category: "Bar", tags: ["nightlife", "drinks", "social"] },
      { category: "Gallery", tags: ["art", "culture", "indoor"] },
    ];

    const priceRanges = ["$", "$$", "$$$", "$$$$"];
    const energyLevels = ["Low", "Moderate", "High"];

    return categories.map((cat, idx) => ({
      id: `fallback-${dest}-${idx}`,
      name: `${cat.category} in ${dest}`,
      category: cat.category,
      description: `Experience the best ${cat.category.toLowerCase()} that ${dest} has to offer. This is a popular local spot recommended by our travel experts.`,
      features: {
        tags: cat.tags,
        price_range: priceRanges[Math.floor(Math.random() * priceRanges.length)],
        energy_level: energyLevels[Math.floor(Math.random() * energyLevels.length)],
      },
      location: dest,
      type: "place" as const,
      score: 0.7 + Math.random() * 0.3,
    }));
  };

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
        const recommendations = data.recommendations || [];
        // deduplicate by id and name
        const seenIds = new Set<string>();
        const seenNames = new Set<string>();
        const uniqueCards = recommendations.filter((card: RecommendationItem) => {
          const id = card.id || '';
          const name = (card.name || '').toLowerCase().trim();
          
          if (seenIds.has(id) || (name && seenNames.has(name))) {
            return false;
          }
          seenIds.add(id);
          if (name) seenNames.add(name);
          return true;
        });
        setCards(uniqueCards);
        setCurrentIndex(0);
      } else {
        console.warn("api failed, using fallback recommendations");
        const fallbackData = generateFallbackRecommendations(destination);
        setCards(fallbackData);
        setCurrentIndex(0);
      }
    } catch (error) {
      console.error("error loading recommendations, using fallback:", error);
      const fallbackData = generateFallbackRecommendations(destination);
      setCards(fallbackData);
      setCurrentIndex(0);
    } finally {
      setIsLoading(false);
    }
  };

  const generateSchedule = useCallback(async () => {
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
  }, [destination, router]);

  const handleSwipe = useCallback(async (direction: "like" | "dislike") => {
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
  }, [cards, currentIndex, destination, tripId, onComplete, generateSchedule]);
  
  handleSwipeRef.current = handleSwipe;

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
        <svg className="w-16 h-16 text-blue-500 mb-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
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
        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
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
        <svg className="w-16 h-16 text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="text-gray-900 dark:text-zinc-50 text-2xl font-bold">
          All Done!
        </div>
        <div className="text-gray-600 dark:text-zinc-400">
          <p className="text-center">
            You've seen all recommendations for {destination}
          </p>
          <div className="mt-4 flex gap-6 justify-center text-sm">
            <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
              Liked: {likedCount}
            </span>
            <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Passed: {dislikedCount}
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
      <div className="flex gap-6 text-sm text-gray-600 dark:text-zinc-400 items-center">
        <span className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          {likedCount}
        </span>
        <span className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          {dislikedCount}
        </span>
        <span>
          {currentIndex + 1} / {cards.length}
        </span>
        <button
          onClick={toggleFingerTracking}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            isFingerTrackingActive
              ? "bg-green-500 hover:bg-green-600 text-white"
              : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-zinc-50"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
          </svg>
          {isFingerTrackingActive ? "Finger Tracking ON" : "Enable Finger Tracking"}
        </button>
        {isFingerTrackingActive && lastSwipeDetected !== 0 && (
          <span className="text-xs text-blue-500">
            {lastSwipeDetected === 1 ? "→ Swiped Right" : "← Swiped Left"}
          </span>
        )}
      </div>

      <div className="relative w-full max-w-md h-[600px]">
        {cards.slice(currentIndex, currentIndex + 2).map((card, idx) => (
          <SwipeCard
            key={`${card.id}-${currentIndex + idx}`}
            item={card}
            onSwipe={handleSwipe}
            isTop={idx === 0}
            onPanoramicClick={() => {
              const location = card.location || card.name;
              router.push(`/panaroma?location=${encodeURIComponent(location)}`);
            }}
          />
        ))}
      </div>


      <div className="flex gap-6">
        <button
          onClick={() => handleSwipe("dislike")}
          className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <button
          onClick={() => handleSwipe("like")}
          className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110"
        >
          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        </button>
      </div>

      <p className="text-gray-500 dark:text-zinc-500 text-sm">
        Swipe right to like, left to pass
      </p>
    </div>
  );
};
