"use client";

import { useState, useRef, useEffect } from "react";
import { ScheduleItem as ScheduleItemType } from "../types";

interface ScheduleItemProps {
  item: ScheduleItemType;
  onDelete: (id: string) => void;
  onDragStart: (e: React.DragEvent, item: ScheduleItemType) => void;
  onResize: (itemId: string, newStartTime: string, newEndTime: string) => void;
  slotHeight: number; // Height of each 30-minute slot in pixels
}

export default function ScheduleItem({
  item,
  onDelete,
  onDragStart,
  onResize,
  slotHeight,
}: ScheduleItemProps) {
  const [isResizingTop, setIsResizingTop] = useState(false);
  const [isResizingBottom, setIsResizingBottom] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);

  const startMinutes = timeToMinutes(item.startTime);
  const endMinutes = timeToMinutes(item.endTime);
  const duration = endMinutes - startMinutes;
  const height = (duration / 30) * slotHeight;
  const top = ((startMinutes - 360) / 30) * slotHeight; // 360 = 6 AM in minutes

  const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!itemRef.current) return;

      if (isResizingTop || isResizingBottom) {
        const container = itemRef.current.closest('[data-day-column]') as HTMLElement;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const slot = Math.round(y / slotHeight); // Round to nearest slot for better snapping
        const clampedSlot = Math.max(0, Math.min(slot, 34)); // 34 slots total (0-34, since we can resize to 11:30 PM)
        const newMinutes = 360 + clampedSlot * 30; // 360 = 6 AM in minutes

        if (isResizingTop) {
          // Resize from top - change start time
          const currentEnd = timeToMinutes(item.endTime);
          // Ensure minimum duration of 30 minutes and don't go below 6 AM
          if (newMinutes < currentEnd - 30 && newMinutes >= 360) {
            onResize(item.id, minutesToTime(newMinutes), item.endTime);
          }
        } else if (isResizingBottom) {
          // Resize from bottom - change end time
          const currentStart = timeToMinutes(item.startTime);
          // Ensure minimum duration of 30 minutes and don't go above 11:30 PM (1410 minutes)
          const maxEnd = 1410; // 11:30 PM
          if (newMinutes > currentStart + 30 && newMinutes <= maxEnd) {
            onResize(item.id, item.startTime, minutesToTime(newMinutes));
          }
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizingTop(false);
      setIsResizingBottom(false);
    };

    if (isResizingTop || isResizingBottom) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isResizingTop, isResizingBottom, item, slotHeight, onResize]);

  return (
    <div
      ref={itemRef}
      draggable={!isResizingTop && !isResizingBottom}
      onDragStart={(e) => {
        if (isResizingTop || isResizingBottom) {
          e.preventDefault();
          return;
        }
        e.stopPropagation();
        onDragStart(e, item);
      }}
      className="absolute left-0 right-0 rounded-md border border-black/10 p-2 shadow-sm transition-all hover:shadow-md group z-20"
      style={{
        backgroundColor: item.color,
        top: `${top}px`,
        height: `${height}px`,
        minHeight: "40px",
        cursor: isResizingTop || isResizingBottom ? "ns-resize" : "move",
      }}
    >
      {/* Top resize handle */}
      <div
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setIsResizingTop(true);
        }}
        className="absolute top-0 left-0 right-0 h-3 cursor-ns-resize hover:bg-black/30 rounded-t-md z-30 group-hover:bg-black/10 transition-colors border-b border-black/20"
        style={{ touchAction: "none" }}
        title="Resize from top"
      >
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-0.5 bg-black/40 group-hover:bg-black/60"></div>
      </div>

      <div className="flex items-start justify-between h-full pt-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-gray-900 truncate">
            {item.name}
          </h3>
          {item.description && (
            <p className="text-xs text-gray-700 mt-1 line-clamp-2">
              {item.description}
            </p>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item.id);
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 text-gray-600 hover:text-red-600 text-sm font-bold"
          aria-label="Delete item"
        >
          ×
        </button>
      </div>

      {/* Bottom resize handle */}
      <div
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setIsResizingBottom(true);
        }}
        className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize hover:bg-black/30 rounded-b-md z-30 group-hover:bg-black/10 transition-colors border-t border-black/20"
        style={{ touchAction: "none" }}
        title="Resize from bottom"
      >
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-0.5 bg-black/40 group-hover:bg-black/60"></div>
      </div>
    </div>
  );
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}


