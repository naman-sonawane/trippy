"use client";

import { useSearchParams } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import { ScheduleItem, TimeSelection } from "./types";
import ScheduleGrid from "./components/ScheduleGrid";
import AddItemModal from "./components/AddItemModal";

export default function SchedulePage() {
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

  useEffect(() => {
    if (tripId) loadItinerary();
    else setIsLoading(false);
  }, [tripId]);

  const loadItinerary = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/schedule?tripId=${tripId}`);
      if (response.ok) {
        const data = await response.json();
        setItems(data.itinerary || []);
      }
    } catch (error) {
      console.error('Error loading itinerary:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
      <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center">
        <div className="text-gray-900 dark:text-zinc-50">Loading itinerary...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-zinc-50 mb-2">
              Itinerary
            </h1>
            <p className="text-gray-600 dark:text-zinc-400">
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
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-gray-900 dark:bg-zinc-50 text-white dark:text-black rounded-md hover:bg-gray-800 dark:hover:bg-zinc-200 transition-colors font-medium"
            >
              Add Item
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

