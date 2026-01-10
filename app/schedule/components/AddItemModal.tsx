"use client";

import { useState, useEffect } from "react";

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, description: string, color: string, startTime: string, endTime: string, day: number) => void;
  defaultStartTime?: string;
  defaultEndTime?: string;
  defaultDay?: number;
  days?: number; // Number of days to show day selector if > 1
}

const COLOR_OPTIONS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
];

// Generate time options from 6 AM to 11 PM in 30-minute intervals
const generateTimeOptions = () => {
  const options = [];
  for (let hour = 6; hour <= 23; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      if (hour === 23 && minute > 0) break; // Stop at 11 PM
      const time = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
      const displayTime = `${hour > 12 ? hour - 12 : hour === 0 ? 12 : hour}:${minute.toString().padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
      options.push({ value: time, label: displayTime });
    }
  }
  return options;
};

const TIME_OPTIONS = generateTimeOptions();

export default function AddItemModal({
  isOpen,
  onClose,
  onAdd,
  defaultStartTime = "09:00",
  defaultEndTime = "10:00",
  defaultDay = 0,
  days = 1,
}: AddItemModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [endTime, setEndTime] = useState(defaultEndTime);
  const [day, setDay] = useState(defaultDay);

  // Reset form when modal opens/closes - MUST be called before any early returns
  useEffect(() => {
    if (isOpen) {
      setStartTime(defaultStartTime);
      setEndTime(defaultEndTime);
      setDay(defaultDay);
    }
  }, [isOpen, defaultStartTime, defaultEndTime, defaultDay]);

  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  };

  // Early return AFTER all hooks
  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      // Validate that end time is after start time
      const startMinutes = timeToMinutes(startTime);
      const endMinutes = timeToMinutes(endTime);
      if (endMinutes <= startMinutes) {
        alert("End time must be after start time");
        return;
      }
      onAdd(name.trim(), description.trim(), color, startTime, endTime, day);
      setName("");
      setDescription("");
      setColor(COLOR_OPTIONS[0]);
      setStartTime(defaultStartTime);
      setEndTime(defaultEndTime);
      setDay(defaultDay);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl p-6 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-zinc-50">
          Add Schedule Item
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1"
            >
              Name *
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Item name"
              required
              autoFocus
            />
          </div>
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1"
            >
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Item description"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="startTime"
                className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1"
              >
                Start Time *
              </label>
              <select
                id="startTime"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {TIME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="endTime"
                className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1"
              >
                End Time *
              </label>
              <select
                id="endTime"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {TIME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {days > 1 && (
            <div>
              <label
                htmlFor="day"
                className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1"
              >
                Day
              </label>
              <select
                id="day"
                value={day}
                onChange={(e) => setDay(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: days }).map((_, i) => {
                  const date = new Date();
                  date.setDate(date.getDate() + i);
                  const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
                  return (
                    <option key={i} value={i}>
                      Day {i + 1} ({dayName})
                    </option>
                  );
                })}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
              Color
            </label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-10 h-10 rounded-md border-2 transition-all ${
                    color === c
                      ? "border-gray-900 dark:border-zinc-50 scale-110"
                      : "border-gray-300 dark:border-zinc-700 hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Select color ${c}`}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Add Item
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

