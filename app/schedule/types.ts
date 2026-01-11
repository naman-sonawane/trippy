export interface ScheduleItem {
  id: string;
  name: string;
  description: string;
  color: string;
  startTime: string; // "HH:MM" format
  endTime: string; // "HH:MM" format
  day: number; // 0-6 for day offset
}

export interface TimeSelection {
  startTime: string;
  endTime: string;
  day: number;
}

export interface Location {
  name: string;
  lat: number;
  lng: number;
}

