import { TimeInterval } from "./types";

/**
 * Validates whether a given string is a recognized IANA time zone identifier.
 * Uses Intl.DateTimeFormat under the hood.
 * Unknown / invalid time zones return false and MUST NOT be silently treated as UTC.
 */
export function isValidIanaTimezone(tz: string | null | undefined): boolean {
  if (!tz || typeof tz !== "string") return false;
  const trimmed = tz.trim();
  if (trimmed === "" || trimmed.toLowerCase() === "invalid") return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    return true;
  } catch {
    return false;
  }
}

/**
 * Asserts that a timezone is a valid IANA identifier.
 * Throws an explicit error if invalid, preventing silent fallback to UTC.
 */
export function assertValidIanaTimezone(tz: string): void {
  if (!isValidIanaTimezone(tz)) {
    throw new Error(`UNKNOWN_TIMEZONE: '${tz}' is not a recognized IANA time-zone identifier.`);
  }
}

/**
 * Normalizes common legacy or formatted timezone strings into strict IANA identifiers.
 * E.g. "UTC+5:30 (IST)" -> "Asia/Kolkata"
 */
export function normalizeToIanaTimezone(tz: string | null | undefined): string {
  if (!tz) return "UTC";
  const trimmed = tz.trim();
  if (isValidIanaTimezone(trimmed)) return trimmed;

  const legacyMap: Record<string, string> = {
    "UTC": "UTC",
    "UTC+5:30 (IST)": "Asia/Kolkata",
    "UTC-5:00 (ET)": "America/New_York",
    "UTC-4:00 (Atlantic)": "America/Halifax",
    "UTC-6:00 (CT)": "America/Chicago",
    "UTC-7:00 (MT)": "America/Denver",
    "UTC-8:00 (PT)": "America/Los_Angeles",
    "UTC+0:00 (London)": "Europe/London",
    "UTC+1:00 (CET)": "Europe/Paris",
    "UTC+2:00 (EET)": "Europe/Athens",
    "UTC+3:00 (Moscow)": "Europe/Moscow",
    "UTC+4:00 (Dubai)": "Asia/Dubai",
    "UTC+6:00 (BST)": "Asia/Dhaka",
    "UTC+7:00 (ICT)": "Asia/Bangkok",
    "UTC+8:00 (SGT)": "Asia/Singapore",
    "UTC+9:00 (JST)": "Asia/Tokyo",
    "UTC+10:00 (AEST)": "Australia/Sydney",
    "UTC+12:00 (NZST)": "Pacific/Auckland",
  };

  if (legacyMap[trimmed] && isValidIanaTimezone(legacyMap[trimmed])) {
    return legacyMap[trimmed];
  }

  // Do not silently fallback if user provided an unrecognized custom string
  throw new Error(`UNKNOWN_TIMEZONE: '${tz}' is not a recognized IANA time-zone identifier.`);
}

/**
 * Curated list of popular IANA timezones with human-readable labels for the editor dropdown.
 */
export interface IanaTimezoneOption {
  value: string;
  label: string;
  region: string;
}

export const POPULAR_IANA_TIMEZONES: IanaTimezoneOption[] = [
  { value: "America/New_York", label: "Eastern Time (US & Canada)", region: "Americas" },
  { value: "America/Chicago", label: "Central Time (US & Canada)", region: "Americas" },
  { value: "America/Denver", label: "Mountain Time (US & Canada)", region: "Americas" },
  { value: "America/Los_Angeles", label: "Pacific Time (US & Canada)", region: "Americas" },
  { value: "America/Toronto", label: "Toronto, Montreal", region: "Americas" },
  { value: "America/Vancouver", label: "Vancouver", region: "Americas" },
  { value: "America/Sao_Paulo", label: "São Paulo, Brasília", region: "Americas" },
  { value: "America/Buenos_Aires", label: "Buenos Aires", region: "Americas" },
  { value: "Europe/London", label: "London, Dublin, Lisbon", region: "Europe" },
  { value: "Europe/Paris", label: "Paris, Berlin, Rome, Madrid, Amsterdam", region: "Europe" },
  { value: "Europe/Athens", label: "Athens, Bucharest, Helsinki", region: "Europe" },
  { value: "Europe/Moscow", label: "Moscow, St. Petersburg", region: "Europe" },
  { value: "Asia/Dubai", label: "Dubai, Abu Dhabi, Muscat", region: "Middle East" },
  { value: "Asia/Kolkata", label: "India Standard Time (IST — Mumbai, Delhi, Bengaluru)", region: "Asia" },
  { value: "Asia/Dhaka", label: "Dhaka, Bangladesh", region: "Asia" },
  { value: "Asia/Bangkok", label: "Bangkok, Hanoi, Jakarta", region: "Asia" },
  { value: "Asia/Singapore", label: "Singapore, Kuala Lumpur", region: "Asia" },
  { value: "Asia/Hong_Kong", label: "Hong Kong, Beijing, Shanghai", region: "Asia" },
  { value: "Asia/Tokyo", label: "Tokyo, Osaka, Seoul", region: "Asia" },
  { value: "Australia/Sydney", label: "Sydney, Melbourne, Canberra", region: "Oceania" },
  { value: "Australia/Perth", label: "Perth", region: "Oceania" },
  { value: "Pacific/Auckland", label: "Auckland, Wellington", region: "Oceania" },
  { value: "UTC", label: "Coordinated Universal Time (UTC)", region: "Global" },
];

/**
 * Parses "HH:mm" string into hour and minute numbers.
 */
export function parseTimeString(timeStr: string): { hour: number; minute: number } {
  const parts = timeStr.trim().split(":");
  if (parts.length < 2) {
    throw new Error(`Invalid time string: '${timeStr}'. Expected 'HH:mm'.`);
  }
  const hour = parseInt(parts[0], 10);
  const minute = parseInt(parts[1], 10);
  if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`Invalid time components: '${timeStr}'.`);
  }
  return { hour, minute };
}

/**
 * Formats a Date into "HH:mm" in a target IANA time zone.
 */
export function formatTimeInTimezone(date: Date, tz: string): string {
  assertValidIanaTimezone(tz);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hour = parts.find((p) => p.type === "hour")?.value || "00";
  const minute = parts.find((p) => p.type === "minute")?.value || "00";
  return `${hour}:${minute}`;
}

/**
 * Formats a Date into "YYYY-MM-DD" in a target IANA time zone.
 */
export function formatDateInTimezone(date: Date, tz: string): string {
  assertValidIanaTimezone(tz);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value || "1970";
  const month = parts.find((p) => p.type === "month")?.value || "01";
  const day = parts.find((p) => p.type === "day")?.value || "01";
  return `${year}-${month}-${day}`;
}

/**
 * Returns the day of week (1=Monday, ..., 7=Sunday) for a Date in a target IANA time zone.
 */
export function getDayOfWeekInTimezone(date: Date, tz: string): number {
  assertValidIanaTimezone(tz);
  // In en-US, weekday can be derived
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  });
  const weekday = formatter.format(date); // "Mon", "Tue", etc.
  const map: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  return map[weekday] ?? 1;
}

/**
 * Converts a local wall-clock date ("YYYY-MM-DD") and time ("HH:mm") in a specific
 * IANA time zone into an exact UTC Epoch timestamp (milliseconds).
 *
 * Correctly accounts for Daylight Saving Time (DST) shifts on that specific calendar day.
 */
export function localDateTimeToUtcMs(dateStr: string, timeStr: string, tz: string): number {
  assertValidIanaTimezone(tz);
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const { hour, minute } = parseTimeString(timeStr);

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    throw new Error(`Invalid date string: '${dateStr}'. Expected 'YYYY-MM-DD'.`);
  }

  // 1. Initial approximate UTC timestamp assuming 0 offset
  let guessUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);

  // 2. Iteratively adjust offset to match target wall clock time in tz
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  for (let iter = 0; iter < 3; iter++) {
    const parts = formatter.formatToParts(new Date(guessUtcMs));
    const partMap: Record<string, number> = {};
    for (const p of parts) {
      if (p.type !== "literal") {
        partMap[p.type] = parseInt(p.value, 10);
      }
    }

    // What wall-clock time did guessUtcMs produce in tz?
    const wallYear = partMap.year ?? year;
    const wallMonth = partMap.month ?? month;
    const wallDay = partMap.day ?? day;
    const wallHour = partMap.hour === 24 ? 0 : (partMap.hour ?? 0);
    const wallMinute = partMap.minute ?? 0;

    // Difference in milliseconds between what guess produced and target
    const targetWallMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
    const producedWallMs = Date.UTC(wallYear, wallMonth - 1, wallDay, wallHour, wallMinute, 0, 0);
    const diffMs = producedWallMs - targetWallMs;

    if (diffMs === 0) {
      return guessUtcMs;
    }

    guessUtcMs -= diffMs;
  }

  return guessUtcMs;
}

/**
 * Adds N days to a "YYYY-MM-DD" string.
 */
export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map((v) => parseInt(v, 10));
  const date = new Date(Date.UTC(y, m - 1, d + days));
  const newY = date.getUTCFullYear();
  const newM = String(date.getUTCMonth() + 1).padStart(2, "0");
  const newD = String(date.getUTCDate()).padStart(2, "0");
  return `${newY}-${newM}-${newD}`;
}

/**
 * Resolves a local time interval (e.g. "19:00" to "22:00", or cross-midnight "22:00" to "02:00")
 * on a given calendar date in timezone tz into exact UTC start and end Epoch timestamps.
 */
export function resolveIntervalToUtc(
  dateStr: string,
  interval: TimeInterval,
  tz: string
): { startMs: number; endMs: number; durationMinutes: number } {
  assertValidIanaTimezone(tz);

  const startMs = localDateTimeToUtcMs(dateStr, interval.start, tz);

  // Cross-midnight check: if end <= start, interval ends on the next calendar day!
  const startParts = parseTimeString(interval.start);
  const endParts = parseTimeString(interval.end);
  const isCrossMidnight =
    endParts.hour < startParts.hour ||
    (endParts.hour === startParts.hour && endParts.minute <= startParts.minute);

  const endDateStr = isCrossMidnight ? addDaysToDateString(dateStr, 1) : dateStr;
  const endMs = localDateTimeToUtcMs(endDateStr, interval.end, tz);

  const durationMinutes = Math.round((endMs - startMs) / (60 * 1000));
  return { startMs, endMs, durationMinutes };
}
