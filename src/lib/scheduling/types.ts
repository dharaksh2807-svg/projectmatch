export type AvailabilityVisibility = "PUBLIC" | "TEAM_ONLY" | "PRIVATE";

export interface TimeInterval {
  start: string; // "HH:mm" (24h format, e.g. "09:00", "19:30")
  end: string;   // "HH:mm" (24h format, e.g. "17:00", "02:00" if cross-midnight)
}

export interface WeeklyDaySlot {
  dayOfWeek: number; // 1 = Monday, 2 = Tuesday, ..., 7 = Sunday
  intervals: TimeInterval[];
}

export interface DateOverride {
  date: string; // "YYYY-MM-DD" in user's local timezone
  isUnavailable?: boolean; // if true, user is completely unavailable on this date
  intervals?: TimeInterval[]; // custom intervals if not completely unavailable
  note?: string; // e.g. "Hackathon Kickoff", "Final Sprint"
}

export interface UserScheduleData {
  id?: string;
  userId: string;
  timezone: string; // Recognized IANA timezone
  weeklyHours?: number | null;
  visibility: AvailabilityVisibility;
  weeklySlots: WeeklyDaySlot[];
  overrides: DateOverride[];
  updatedAt?: Date | string;
}

export interface ScheduleParticipant {
  id: string;
  name: string | null;
  image?: string | null;
  roleTitle?: string | null;
  isOwner?: boolean;
  schedule: UserScheduleData | null; // null if missing or hidden due to privacy
  scheduleStatus: "CONFIGURED" | "MISSING" | "PRIVATE";
}

export interface UtcTimeWindow {
  startMs: number; // UTC Epoch timestamp in milliseconds
  endMs: number;   // UTC Epoch timestamp in milliseconds
  durationMinutes: number;
}

export interface OverlapSlot extends UtcTimeWindow {
  availableMemberIds: string[];
  availableCount: number;
  totalTeamCount: number;
  isAllTeam: boolean;
}

export interface SuggestedWindow {
  id: string;
  startMs: number;
  endMs: number;
  durationMinutes: number;
  availableCount: number;
  totalTeamCount: number;
  availableMembers: { id: string; name: string | null; image?: string | null }[];
  isAllTeam: boolean;
  // Localized representations for viewer
  viewerDateLabel: string; // e.g. "Saturday, Oct 24, 2026"
  viewerTimeRangeLabel: string; // e.g. "7:00 PM – 9:00 PM (EDT)"
  score: number; // Ranking metric based on availability and duration
}

export interface TeamAvailabilityResult {
  projectId: string;
  projectTitle: string;
  viewerTimezone: string;
  evaluatedRange: {
    startDate: string; // "YYYY-MM-DD"
    endDate: string;   // "YYYY-MM-DD"
    totalDays: number;
  };
  participants: ScheduleParticipant[];
  totalMembers: number;
  configuredCount: number;
  missingCount: number;
  privateCount: number;
  allTeamOverlapMinutes: number;
  suggestedWindows: SuggestedWindow[];
  timelineSlots: OverlapSlot[];
}
