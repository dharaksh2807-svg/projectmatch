import { WeeklyDaySlot } from "./types";
import { parseTimeString } from "./timezone";

export interface AvailabilityPreset {
  id: string;
  name: string;
  description: string;
  slots: WeeklyDaySlot[];
}

/**
 * Standard editable presets for ProjectMatch availability.
 */
export const AVAILABILITY_PRESETS: AvailabilityPreset[] = [
  {
    id: "weekday-evenings",
    name: "Weekday Evenings",
    description: "Monday to Friday, 6:00 PM – 10:00 PM (20 hrs/week)",
    slots: [
      { dayOfWeek: 1, intervals: [{ start: "18:00", end: "22:00" }] },
      { dayOfWeek: 2, intervals: [{ start: "18:00", end: "22:00" }] },
      { dayOfWeek: 3, intervals: [{ start: "18:00", end: "22:00" }] },
      { dayOfWeek: 4, intervals: [{ start: "18:00", end: "22:00" }] },
      { dayOfWeek: 5, intervals: [{ start: "18:00", end: "22:00" }] },
      { dayOfWeek: 6, intervals: [] },
      { dayOfWeek: 7, intervals: [] },
    ],
  },
  {
    id: "weekends",
    name: "Weekends Only",
    description: "Saturday and Sunday, 10:00 AM – 6:00 PM (16 hrs/week)",
    slots: [
      { dayOfWeek: 1, intervals: [] },
      { dayOfWeek: 2, intervals: [] },
      { dayOfWeek: 3, intervals: [] },
      { dayOfWeek: 4, intervals: [] },
      { dayOfWeek: 5, intervals: [] },
      { dayOfWeek: 6, intervals: [{ start: "10:00", end: "18:00" }] },
      { dayOfWeek: 7, intervals: [{ start: "10:00", end: "18:00" }] },
    ],
  },
  {
    id: "flexible",
    name: "Flexible Full-Time",
    description: "Monday to Friday, 9:00 AM – 5:00 PM (40 hrs/week)",
    slots: [
      { dayOfWeek: 1, intervals: [{ start: "09:00", end: "17:00" }] },
      { dayOfWeek: 2, intervals: [{ start: "09:00", end: "17:00" }] },
      { dayOfWeek: 3, intervals: [{ start: "09:00", end: "17:00" }] },
      { dayOfWeek: 4, intervals: [{ start: "09:00", end: "17:00" }] },
      { dayOfWeek: 5, intervals: [{ start: "09:00", end: "17:00" }] },
      { dayOfWeek: 6, intervals: [] },
      { dayOfWeek: 7, intervals: [] },
    ],
  },
  {
    id: "hackathon-sprint",
    name: "Hackathon Intensive",
    description: "Friday evening (6 PM - 12 AM), Saturday & Sunday full day (10 AM - 10 PM)",
    slots: [
      { dayOfWeek: 1, intervals: [] },
      { dayOfWeek: 2, intervals: [] },
      { dayOfWeek: 3, intervals: [] },
      { dayOfWeek: 4, intervals: [] },
      { dayOfWeek: 5, intervals: [{ start: "18:00", end: "23:59" }] },
      { dayOfWeek: 6, intervals: [{ start: "10:00", end: "22:00" }] },
      { dayOfWeek: 7, intervals: [{ start: "10:00", end: "22:00" }] },
    ],
  },
];

/**
 * Calculates total weekly hours from an array of WeeklyDaySlots.
 */
export function calculateWeeklyHours(slots: WeeklyDaySlot[]): number {
  let totalMinutes = 0;

  for (const slot of slots) {
    for (const interval of slot.intervals || []) {
      if (!interval.start || !interval.end) continue;
      try {
        const start = parseTimeString(interval.start);
        const end = parseTimeString(interval.end);

        let startMins = start.hour * 60 + start.minute;
        let endMins = end.hour * 60 + end.minute;

        if (endMins <= startMins) {
          // Cross-midnight interval
          endMins += 24 * 60;
        }

        totalMinutes += endMins - startMins;
      } catch {
        // Skip invalid times
      }
    }
  }

  return Math.round((totalMinutes / 60) * 10) / 10;
}

/**
 * Creates empty weekly slots for Monday through Sunday (1 to 7).
 */
export function createDefaultWeeklySlots(): WeeklyDaySlot[] {
  return [
    { dayOfWeek: 1, intervals: [] },
    { dayOfWeek: 2, intervals: [] },
    { dayOfWeek: 3, intervals: [] },
    { dayOfWeek: 4, intervals: [] },
    { dayOfWeek: 5, intervals: [] },
    { dayOfWeek: 6, intervals: [] },
    { dayOfWeek: 7, intervals: [] },
  ];
}
