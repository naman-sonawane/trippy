'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { ScheduleItem } from '../types';

interface ConfirmScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  items: ScheduleItem[];
  destination?: string;
}

export default function ConfirmScheduleModal({
  isOpen,
  onClose,
  onConfirm,
  items,
  destination
}: ConfirmScheduleModalProps) {
  if (!isOpen) return null;

  const itemsByDay = items.reduce((acc, item) => {
    if (!acc[item.day]) acc[item.day] = [];
    acc[item.day].push(item);
    return acc;
  }, {} as Record<number, ScheduleItem[]>);

  const sortedDays = Object.keys(itemsByDay)
    .map(Number)
    .sort((a, b) => a - b);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${period}`;
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
          onClick={onClose}
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        >
          <div className="p-6 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-50">
                Confirm Your Itinerary
              </h2>
              {destination && (
                <p className="text-sm text-gray-600 dark:text-zinc-400 mt-1">
                  {destination}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600 dark:text-zinc-400" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <p className="text-gray-700 dark:text-zinc-300 mb-6">
              Do you want to proceed with this itinerary? Here's your plan for every day:
            </p>

            {sortedDays.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-zinc-400">
                No activities scheduled yet
              </div>
            ) : (
              <div className="space-y-6">
                {sortedDays.map((day) => {
                  const dayItems = itemsByDay[day]
                    .sort((a, b) => a.startTime.localeCompare(b.startTime));
                  
                  return (
                    <div
                      key={day}
                      className="border border-gray-200 dark:border-zinc-800 rounded-xl p-5 bg-gray-50 dark:bg-zinc-900/50"
                    >
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-zinc-50 mb-4">
                        Day {day + 1}
                      </h3>
                      <div className="space-y-3">
                        {dayItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex gap-4 p-3 bg-white dark:bg-zinc-800 rounded-lg"
                          >
                            <div
                              className="w-1 rounded-full shrink-0"
                              style={{ backgroundColor: item.color }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-4 mb-1">
                                <h4 className="font-medium text-gray-900 dark:text-zinc-50">
                                  {item.name}
                                </h4>
                                <span className="text-sm text-gray-500 dark:text-zinc-400 whitespace-nowrap">
                                  {formatTime(item.startTime)} - {formatTime(item.endTime)}
                                </span>
                              </div>
                              {item.description && (
                                <p className="text-sm text-gray-600 dark:text-zinc-400">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-6 border-t border-gray-200 dark:border-zinc-800 flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 text-gray-700 dark:text-zinc-300 bg-gray-100 dark:bg-zinc-800 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Confirm & Continue
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
