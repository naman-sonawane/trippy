"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import { ScheduleItem, TimeSelection } from "./types";
import ScheduleGrid from "./components/ScheduleGrid";
import AddItemModal from "./components/AddItemModal";
import ConfirmScheduleModal from "./components/ConfirmScheduleModal";

export default function SchedulePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const daysParam = searchParams.get("days");
  const tripId = searchParams.get("tripId");
  const days = Math.max(1, Math.min(7, parseInt(daysParam || "1", 10) || 1));

  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [timeSelection, setTimeSelection] = useState<TimeSelection | null>(
    null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [destination, setDestination] = useState<string>("");

  const generateInitialSchedule = useCallback(async () => {
    if (!tripId) return;
    
    try {
      const tripResponse = await fetch(`/api/trips/${tripId}`);
      if (!tripResponse.ok) return;
      
      const tripData = await tripResponse.json();
      const destination = tripData.trip?.destination;
      if (!destination) return;

      const response = await fetch("/api/generate-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination,
          tripId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setItems(data.schedule || []);
      }
    } catch (error) {
      console.error('Error generating initial schedule:', error);
    }
  }, [tripId]);

  const loadItinerary = useCallback(async () => {
    if (!tripId) return;
    
    try {
      setIsLoading(true);
      const tripResponse = await fetch(`/api/trips/${tripId}`);
      if (tripResponse.ok) {
        const tripData = await tripResponse.json();
        if (tripData.trip?.destination) {
          setDestination(tripData.trip.destination);
        }
      }

      const response = await fetch(`/api/schedule?tripId=${tripId}`);
      if (response.ok) {
        const data = await response.json();
        const itinerary = data.itinerary || [];
        
        if (itinerary.length === 0) {
          await generateInitialSchedule();
        } else {
          setItems(itinerary);
        }
      }
    } catch (error) {
      console.error('Error loading itinerary:', error);
    } finally {
      setIsLoading(false);
    }
  }, [tripId, generateInitialSchedule]);

  useEffect(() => {
    if (tripId) loadItinerary();
    else setIsLoading(false);
  }, [tripId, loadItinerary]);

  const saveItinerary = async (updatedItems: ScheduleItem[]) => {
    if (!tripId) return;
    
    try {
      setIsSaving(true);
      await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId, itinerary: updatedItems }),
      });
    } catch (error) {
      console.error('Error saving itinerary:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddItem = useCallback(
    (name: string, description: string, color: string, startTime: string, endTime: string, day: number) => {
      const newItem: ScheduleItem = {
        id: `item-${Date.now()}-${Math.random()}`,
        name,
        description,
        color,
        startTime,
        endTime,
        day,
      };
      const updatedItems = [...items, newItem];
      setItems(updatedItems);
      saveItinerary(updatedItems);
    },
    [items, tripId]
  );

  const handleDeleteItem = useCallback((id: string) => {
    const updatedItems = items.filter((item) => item.id !== id);
    setItems(updatedItems);
    saveItinerary(updatedItems);
  }, [items, tripId]);

  const handleItemDrop = useCallback(
    (itemId: string, day: number, time: string) => {
      const updatedItems = items.map((item) => {
        if (item.id === itemId) {
          const startMinutes = timeToMinutes(time);
          const originalStart = timeToMinutes(item.startTime);
          const originalEnd = timeToMinutes(item.endTime);
          const duration = originalEnd - originalStart;
          const newEndMinutes = startMinutes + duration;
          return {
            ...item,
            day,
            startTime: time,
            endTime: minutesToTime(newEndMinutes),
          };
        }
        return item;
      });
      setItems(updatedItems);
      saveItinerary(updatedItems);
    },
    [items, tripId]
  );

  const handleItemResize = useCallback(
    (itemId: string, newStartTime: string, newEndTime: string) => {
      const updatedItems = items.map((item) => {
        if (item.id === itemId) {
          return {
            ...item,
            startTime: newStartTime,
            endTime: newEndTime,
          };
        }
        return item;
      });
      setItems(updatedItems);
      saveItinerary(updatedItems);
    },
    [items, tripId]
  );

  const handleRegenerate = useCallback(async () => {
    if (!timeSelection || !tripId) {
      return;
    }

    setIsRegenerating(true);
    setRegenerateError(null);

    try {
      // Get trip to get destination
      const tripResponse = await fetch(`/api/trips/${tripId}`);
      if (!tripResponse.ok) {
        throw new Error('Failed to fetch trip');
      }

      const tripData = await tripResponse.json();
      const destination = tripData.trip?.destination;

      if (!destination) {
        throw new Error('Trip destination not found');
      }

      // Call regenerate endpoint
      const response = await fetch('/api/regenerate-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          timeSelection,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to regenerate schedule');
      }

      const data = await response.json();
      
      // Update items with new itinerary
      setItems(data.itinerary || []);
      
      // Clear time selection
      setTimeSelection(null);
    } catch (error) {
      console.error('Error regenerating schedule:', error);
      setRegenerateError(
        error instanceof Error
          ? error.message
          : 'Failed to regenerate schedule. Please try again.'
      );
    } finally {
      setIsRegenerating(false);
    }
  }, [timeSelection, tripId]);

  if (isLoading) {
    return (
      <div className="min-h-screen relative flex items-center justify-center"
           style={{
             backgroundImage: "url(/anotherbg.jpg)",
             backgroundSize: "cover",
             backgroundPosition: "center",
             backgroundRepeat: "no-repeat",
             backgroundAttachment: "fixed"
           }}>
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/70" />
        <div className="relative z-10 text-white">Loading itinerary...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative p-4 sm:p-8"
         style={{
           backgroundImage: "url(/anotherbg.jpg)",
           backgroundSize: "cover",
           backgroundPosition: "center",
           backgroundRepeat: "no-repeat",
           backgroundAttachment: "fixed"
         }}>
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/70" />
      <div className="relative z-10 max-w-7xl mx-auto">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => router.push('/dashboard')}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                title="Back to Dashboard"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <h1 className="text-3xl font-semibold text-white">
                Itinerary
              </h1>
            </div>
            <p className="text-white/80">
              {days === 1 ? "Single Day View" : `${days} Day View`}
              {isSaving && <span className="ml-2 text-sm">Saving...</span>}
            </p>
          </div>
          <div className="flex gap-3">
            {timeSelection && (
              <div className="flex flex-col gap-1">
                <button
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isRegenerating ? 'Regenerating...' : 'Regenerate'}
                </button>
                {regenerateError && (
                  <p className="text-xs text-red-600 dark:text-red-400 max-w-xs">
                    {regenerateError}
                  </p>
                )}
              </div>
            )}
            {tripId && (
              <button
                onClick={() => router.push(`/schedule/map?tripId=${tripId}`)}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Map
              </button>
            )}
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-gray-900 dark:bg-zinc-50 text-white dark:text-black rounded-md hover:bg-gray-800 dark:hover:bg-zinc-200 transition-colors font-medium"
            >
              Add Item
            </button>
            <button
              onClick={() => setIsConfirmModalOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              Confirm Schedule
            </button>
          </div>
        </div>

        <ScheduleGrid
          days={days}
          items={items}
          onItemDelete={handleDeleteItem}
          onItemDrop={handleItemDrop}
          onItemResize={handleItemResize}
          onSelectionChange={setTimeSelection}
        />

        <AddItemModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onAdd={handleAddItem}
          days={days}
        />

        <ConfirmScheduleModal
          isOpen={isConfirmModalOpen}
          onClose={() => setIsConfirmModalOpen(false)}
          onConfirm={() => {
            setIsConfirmModalOpen(false);
            if (tripId) {
              router.push(`/confirm-flights-hotels?tripId=${tripId}`);
            }
          }}
          items={items}
          destination={destination}
        />
      </div>
    </div>
  );
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

