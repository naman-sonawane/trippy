"use client";

import { useState, useEffect, useCallback } from "react";
import { TimeSelection } from "../types";

interface TimeSelectorProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onSelectionChange: (selection: TimeSelection | null) => void;
  slotHeight: number;
  days: number;
}

const TOTAL_SLOTS = 34; // 6 AM to 11 PM = 17 hours = 34 half-hour slots

function slotToTime(slot: number): string {
  const totalMinutes = 360 + slot * 30; // 360 = 6 AM in minutes
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

export default function TimeSelector({
  containerRef,
  onSelectionChange,
  slotHeight,
  days,
}: TimeSelectorProps) {

  const container = containerRef?.current;
  if (!container) return null;

  const [isSelecting, setIsSelecting] = useState(false);
  const [startSlot, setStartSlot] = useState<{
    day: number;
    slot: number;
  } | null>(null);
  const [endSlot, setEndSlot] = useState<{
    day: number;
    slot: number;
  } | null>(null);

  const getSlotFromEvent = useCallback(
    (e: MouseEvent): { day: number; slot: number } | null => {
      if (!containerRef.current) return null;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Calculate which day column (each day takes equal width)
      const dayWidth = rect.width / days;
      const day = Math.floor(x / dayWidth);
      if (day < 0 || day >= days) return null;

      // Calculate which time slot
      const slot = Math.floor(y / slotHeight);
      if (slot < 0 || slot >= TOTAL_SLOTS) return null;

      return { day, slot };
    },
    [containerRef, days, slotHeight]
  );

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return; // Only left click
      // Don't start selection if clicking on a schedule item or its children
      const target = e.target as HTMLElement;
      // Check if clicking on resize handles (has cursor-ns-resize class), schedule items, or buttons
      if (
        target.closest('[draggable="true"]') ||
        target.closest('button') ||
        target.classList.contains('cursor-ns-resize') ||
        target.closest('.cursor-ns-resize')
      ) {
        return;
      }
      const slot = getSlotFromEvent(e);
      if (slot) {
        setIsSelecting(true);
        setStartSlot(slot);
        setEndSlot(slot);
      }
    };

    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("mousedown", handleMouseDown);

    return () => {
      container.removeEventListener("mousedown", handleMouseDown);
    };
  }, [containerRef, getSlotFromEvent]);

  useEffect(() => {
    if (!isSelecting || !startSlot) return;

    const handleMouseMove = (e: MouseEvent) => {
      const slot = getSlotFromEvent(e);
      if (slot) {
        setEndSlot(slot);
      }
    };

    const handleMouseUp = () => {
      setEndSlot((prevEnd) => {
        if (prevEnd && startSlot) {
          // Normalize selection (start should be before end)
          const minDay = Math.min(startSlot.day, prevEnd.day);
          const maxDay = Math.max(startSlot.day, prevEnd.day);
          const minSlot = Math.min(startSlot.slot, prevEnd.slot);
          const maxSlot = Math.max(startSlot.slot, prevEnd.slot);

          const selection: TimeSelection = {
            startTime: slotToTime(minSlot),
            endTime: slotToTime(maxSlot + 1), // +1 to include the end slot
            day: minDay,
          };

          onSelectionChange(selection);
        }
        setIsSelecting(false);
        return prevEnd;
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isSelecting, startSlot, getSlotFromEvent, onSelectionChange]);

  if (!startSlot || !endSlot) return null;

  // Normalize for display
  const minDay = Math.min(startSlot.day, endSlot.day);
  const maxDay = Math.max(startSlot.day, endSlot.day);
  const minSlot = Math.min(startSlot.slot, endSlot.slot);
  const maxSlot = Math.max(startSlot.slot, endSlot.slot);

  return (
    <>
      {Array.from({ length: maxDay - minDay + 1 }).map((_, dayOffset) => {
        const day = minDay + dayOffset;
        const left = (day / days) * 100;
        const top = minSlot * slotHeight;
        const height = (maxSlot - minSlot + 1) * slotHeight;

        return (
          <div
            key={day}
            className="absolute pointer-events-none bg-blue-500/20 border-2 border-blue-500 rounded z-10"
            style={{
              left: `${left}%`,
              top: `${top}px`,
              height: `${height}px`,
              width: `${100 / days}%`,
            }}
          />
        );
      })}
    </>
  );
}
