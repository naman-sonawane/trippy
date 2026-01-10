"use client";

import { useRef } from "react";
import { ScheduleItem as ScheduleItemType, TimeSelection } from "../types";
import ScheduleItem from "./ScheduleItem";
import TimeSelector from "./TimeSelector";

interface ScheduleGridProps {
  days: number;
  items: ScheduleItemType[];
  onItemDelete: (id: string) => void;
  onItemDrop: (itemId: string, day: number, time: string) => void;
  onItemResize: (itemId: string, newStartTime: string, newEndTime: string) => void;
  onSelectionChange: (selection: TimeSelection | null) => void;
}

const SLOT_HEIGHT = 60; // Height of each 30-minute slot in pixels
const START_HOUR = 6; // 6 AM
const END_HOUR = 23; // 11 PM
const TOTAL_SLOTS = (END_HOUR - START_HOUR) * 2; // 34 slots

export default function ScheduleGrid({
  days,
  items,
  onItemDelete,
  onItemDrop,
  onItemResize,
  onSelectionChange,
}: ScheduleGridProps) {
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const timeSlots = Array.from({ length: TOTAL_SLOTS }, (_, i) => {
    const hours = START_HOUR + Math.floor(i / 2);
    const minutes = (i % 2) * 30;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  });

  const getDayName = (dayOffset: number) => {
    const today = new Date();
    const day = new Date(today);
    day.setDate(today.getDate() + dayOffset);
    return day.toLocaleDateString("en-US", { weekday: "short" });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, day: number) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData("text/plain");
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const slot = Math.floor(y / SLOT_HEIGHT);
    const clampedSlot = Math.max(0, Math.min(slot, TOTAL_SLOTS - 1));
    const time = timeSlots[clampedSlot];
    onItemDrop(itemId, day, time);
  };

  return (
    <div className="flex flex-col border border-gray-300 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
      {/* Header */}
      <div className="flex border-b border-gray-300 dark:border-zinc-700">
        <div className="w-20 p-2 font-semibold text-sm text-gray-700 dark:text-zinc-300 border-r border-gray-300 dark:border-zinc-700">
          Time
        </div>
        {Array.from({ length: days }).map((_, i) => (
          <div
            key={i}
            className="flex-1 p-2 text-center font-semibold text-sm text-gray-700 dark:text-zinc-300 border-r border-gray-300 dark:border-zinc-700 last:border-r-0"
          >
            {getDayName(i)}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex overflow-auto">
        {/* Time column */}
        <div className="w-20 border-r border-gray-300 dark:border-zinc-700">
          {timeSlots.map((time, i) => (
            <div
              key={time}
              className="h-[60px] border-b border-gray-200 dark:border-zinc-800 flex items-start justify-end pr-2 pt-1"
            >
              {i % 2 === 0 && (
                <span className="text-xs text-gray-600 dark:text-zinc-400">
                  {time}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Day columns */}
        <div className="flex-1 flex relative" ref={gridContainerRef}>
          {Array.from({ length: days }).map((_, dayIndex) => (
            <div
              key={dayIndex}
              data-day-column
              className="flex-1 relative border-r border-gray-300 dark:border-zinc-700 last:border-r-0"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, dayIndex)}
            >
              {/* Time slots */}
              {timeSlots.map((time) => (
                <div
                  key={time}
                  className="h-[60px] border-b border-gray-200 dark:border-zinc-800"
                />
              ))}

              {/* Schedule items for this day */}
              {items
                .filter((item) => item.day === dayIndex)
                .map((item) => (
                  <ScheduleItem
                    key={item.id}
                    item={item}
                    onDelete={onItemDelete}
                    onDragStart={(e, item) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", item.id);
                    }}
                    onResize={onItemResize}
                    slotHeight={SLOT_HEIGHT}
                  />
                ))}
            </div>
          ))}

          {/* Time selector overlay */}
          <TimeSelector
            containerRef={gridContainerRef}
            onSelectionChange={onSelectionChange}
            slotHeight={SLOT_HEIGHT}
            days={days}
          />
        </div>
      </div>
    </div>
  );
}

