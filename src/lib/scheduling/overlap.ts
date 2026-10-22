import {
  ScheduleParticipant,
  OverlapSlot,
  SuggestedWindow,
  TeamAvailabilityResult,
  UtcTimeWindow,
} from "./types";
import {
  assertValidIanaTimezone,
  addDaysToDateString,
  getDayOfWeekInTimezone,
  resolveIntervalToUtc,
  formatDateInTimezone,
} from "./timezone";

export interface OverlapOptions {
  startDate?: string; // "YYYY-MM-DD" in viewer timezone (defaults to today)
  days?: number;      // defaults to 7 days
  viewerTimezone?: string; // defaults to "UTC"
  minWindowMinutes?: number; // minimum duration to qualify as a suggested meeting window (default 30)
}

/**
 * Expands a participant's schedule across a calendar date range into raw UTC intervals.
 * Correctly accounts for:
 * - Participant's IANA timezone and local day-of-week
 * - Cross-midnight intervals spanning into the next calendar day
 * - Date-specific overrides (override intervals or total unavailability)
 * - Missing schedules (returns empty array, marked as MISSING)
 */
export function expandParticipantScheduleToUtc(
  participant: ScheduleParticipant,
  startDateStr: string,
  totalDays: number
): UtcTimeWindow[] {
  if (!participant.schedule || !participant.schedule.weeklySlots) {
    return [];
  }

  const { timezone, weeklySlots, overrides = [] } = participant.schedule;
  assertValidIanaTimezone(timezone);

  const overrideMap = new Map<string, { isUnavailable?: boolean; intervals?: { start: string; end: string }[] }>();
  for (const ov of overrides) {
    if (ov.date) {
      overrideMap.set(ov.date, ov);
    }
  }

  const slotsByDayOfWeek = new Map<number, { start: string; end: string }[]>();
  for (const slot of weeklySlots) {
    slotsByDayOfWeek.set(slot.dayOfWeek, slot.intervals || []);
  }

  const resultWindows: UtcTimeWindow[] = [];

  // We iterate through each date in the range, plus 1 buffer day before and after
  // to catch cross-midnight spill-overs across timezones
  const bufferedStartDate = addDaysToDateString(startDateStr, -1);
  const bufferedTotalDays = totalDays + 2;

  for (let i = 0; i < bufferedTotalDays; i++) {
    const currentDateStr = addDaysToDateString(bufferedStartDate, i);

    let intervalsToProcess: { start: string; end: string }[] = [];

    // Check date-specific override first
    if (overrideMap.has(currentDateStr)) {
      const ov = overrideMap.get(currentDateStr)!;
      if (ov.isUnavailable) {
        // Completely unavailable on this date
        intervalsToProcess = [];
      } else if (ov.intervals && ov.intervals.length > 0) {
        intervalsToProcess = ov.intervals;
      }
    } else {
      // Determine day of week in participant's timezone for this date
      const [y, m, d] = currentDateStr.split("-").map((v) => parseInt(v, 10));
      const approxUtcDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      const dayOfWeek = getDayOfWeekInTimezone(approxUtcDate, timezone);

      intervalsToProcess = slotsByDayOfWeek.get(dayOfWeek) || [];
    }

    for (const interval of intervalsToProcess) {
      if (!interval.start || !interval.end) continue;
      try {
        const resolved = resolveIntervalToUtc(currentDateStr, interval, timezone);
        if (resolved.endMs > resolved.startMs) {
          resultWindows.push(resolved);
        }
      } catch (err) {
        console.warn(`Failed to resolve interval '${interval.start}-${interval.end}' on ${currentDateStr} in ${timezone}:`, err);
      }
    }
  }

  // Sort and merge any overlapping intervals for the same participant
  return mergeUtcWindows(resultWindows);
}

/**
 * Merges overlapping or contiguous UTC windows for a single participant.
 */
export function mergeUtcWindows(windows: UtcTimeWindow[]): UtcTimeWindow[] {
  if (windows.length <= 1) return windows;

  const sorted = [...windows].sort((a, b) => a.startMs - b.endMs);
  const merged: UtcTimeWindow[] = [];

  let current = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    if (next.startMs <= current.endMs) {
      // Overlapping or adjacent
      current = {
        startMs: current.startMs,
        endMs: Math.max(current.endMs, next.endMs),
        durationMinutes: Math.round((Math.max(current.endMs, next.endMs) - current.startMs) / (60 * 1000)),
      };
    } else {
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);

  return merged;
}

/**
 * Calculates mutual schedule overlap across all participants for a team or group.
 * Produces discrete overlap timeline slices and suggested meeting/coding windows.
 */
export function calculateTeamScheduleOverlap(
  participants: ScheduleParticipant[],
  projectId: string,
  projectTitle: string,
  options: OverlapOptions = {}
): TeamAvailabilityResult {
  const viewerTimezone = options.viewerTimezone || "UTC";
  assertValidIanaTimezone(viewerTimezone);

  const startDateStr = options.startDate || formatDateInTimezone(new Date(), viewerTimezone);
  const totalDays = options.days || 7;
  const endDateStr = addDaysToDateString(startDateStr, totalDays - 1);
  const minWindowMinutes = options.minWindowMinutes || 30;

  // Global evaluation bounds in UTC
  const rangeStartUtcMs = resolveIntervalToUtc(startDateStr, { start: "00:00", end: "23:59" }, viewerTimezone).startMs;
  const rangeEndUtcMs = resolveIntervalToUtc(endDateStr, { start: "00:00", end: "23:59" }, viewerTimezone).endMs;

  const totalMembers = participants.length;
  const configuredCount = participants.filter((p) => p.scheduleStatus === "CONFIGURED").length;
  const missingCount = participants.filter((p) => p.scheduleStatus === "MISSING").length;
  const privateCount = participants.filter((p) => p.scheduleStatus === "PRIVATE").length;

  // 1. Expand schedules for each participant into UTC segments clipped to evaluation bounds
  const participantWindows = new Map<string, UtcTimeWindow[]>();
  const allBoundariesSet = new Set<number>();
  allBoundariesSet.add(rangeStartUtcMs);
  allBoundariesSet.add(rangeEndUtcMs);

  for (const p of participants) {
    const windows = expandParticipantScheduleToUtc(p, startDateStr, totalDays)
      .map((w) => ({
        startMs: Math.max(w.startMs, rangeStartUtcMs),
        endMs: Math.min(w.endMs, rangeEndUtcMs),
        durationMinutes: 0,
      }))
      .filter((w) => w.endMs > w.startMs)
      .map((w) => ({
        ...w,
        durationMinutes: Math.round((w.endMs - w.startMs) / (60 * 1000)),
      }));

    participantWindows.set(p.id, windows);

    for (const w of windows) {
      allBoundariesSet.add(w.startMs);
      allBoundariesSet.add(w.endMs);
    }
  }

  // 2. Sweep-line interval intersections across all critical boundary timestamps
  const boundaries = Array.from(allBoundariesSet).sort((a, b) => a - b);
  const rawSlots: OverlapSlot[] = [];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const startMs = boundaries[i];
    const endMs = boundaries[i + 1];
    if (endMs <= startMs) continue;

    const midMs = startMs + (endMs - startMs) / 2;

    const availableMemberIds: string[] = [];
    for (const [pId, windows] of participantWindows.entries()) {
      const isAvailable = windows.some((w) => w.startMs <= midMs && midMs <= w.endMs);
      if (isAvailable) {
        availableMemberIds.push(pId);
      }
    }

    if (availableMemberIds.length > 0) {
      const durationMinutes = Math.round((endMs - startMs) / (60 * 1000));
      rawSlots.push({
        startMs,
        endMs,
        durationMinutes,
        availableMemberIds: availableMemberIds.sort(),
        availableCount: availableMemberIds.length,
        totalTeamCount: totalMembers,
        isAllTeam: totalMembers > 0 && availableMemberIds.length === totalMembers,
      });
    }
  }

  // 3. Coalesce contiguous adjacent slots with the exact same available participants
  const coalescedTimeline: OverlapSlot[] = [];
  if (rawSlots.length > 0) {
    let curr = rawSlots[0];
    for (let i = 1; i < rawSlots.length; i++) {
      const next = rawSlots[i];
      const sameMembers =
        curr.availableMemberIds.length === next.availableMemberIds.length &&
        curr.availableMemberIds.every((id, idx) => id === next.availableMemberIds[idx]);

      if (curr.endMs === next.startMs && sameMembers) {
        curr = {
          ...curr,
          endMs: next.endMs,
          durationMinutes: curr.durationMinutes + next.durationMinutes,
        };
      } else {
        coalescedTimeline.push(curr);
        curr = next;
      }
    }
    coalescedTimeline.push(curr);
  }

  // 4. Calculate total all-team overlap duration
  let allTeamOverlapMinutes = 0;
  for (const slot of coalescedTimeline) {
    if (slot.isAllTeam) {
      allTeamOverlapMinutes += slot.durationMinutes;
    }
  }

  // 5. Build Suggested Collaboration / Meeting Windows
  // Criteria:
  // - Duration >= minWindowMinutes
  // - Minimum 2 participants (or 1 if team size is 1)
  const candidateWindows = coalescedTimeline.filter((slot) => {
    if (slot.durationMinutes < minWindowMinutes) return false;
    if (totalMembers <= 1) return slot.availableCount >= 1;
    return slot.availableCount >= 2;
  });

  const memberMap = new Map<string, ScheduleParticipant>(participants.map((p) => [p.id, p]));

  const suggestedWindows: SuggestedWindow[] = candidateWindows
    .map((slot) => {
      const startDate = new Date(slot.startMs);
      const endDate = new Date(slot.endMs);

      // Localized display labels in viewer's timezone
      const viewerDateLabel = new Intl.DateTimeFormat("en-US", {
        timeZone: viewerTimezone,
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(startDate);

      const startTimeStr = new Intl.DateTimeFormat("en-US", {
        timeZone: viewerTimezone,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(startDate);

      const endTimeStr = new Intl.DateTimeFormat("en-US", {
        timeZone: viewerTimezone,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZoneName: "short",
      }).format(endDate);

      const availableMembers = slot.availableMemberIds
        .map((id) => memberMap.get(id))
        .filter(Boolean)
        .map((p) => ({ id: p!.id, name: p!.name, image: p!.image }));

      // Scoring metric:
      // - 70% participation ratio
      // - 30% duration scale (up to 3 hours = 180 mins)
      // - 20 point bonus for 100% all-team availability
      const participationRatio = totalMembers > 0 ? slot.availableCount / totalMembers : 0;
      const durationScore = Math.min(slot.durationMinutes / 180, 1.0);
      const allTeamBonus = slot.isAllTeam ? 20 : 0;
      const score = Math.round(participationRatio * 70 + durationScore * 30 + allTeamBonus);

      return {
        id: `window-${slot.startMs}-${slot.endMs}`,
        startMs: slot.startMs,
        endMs: slot.endMs,
        durationMinutes: slot.durationMinutes,
        availableCount: slot.availableCount,
        totalTeamCount: totalMembers,
        availableMembers,
        isAllTeam: slot.isAllTeam,
        viewerDateLabel,
        viewerTimeRangeLabel: `${startTimeStr} – ${endTimeStr}`,
        score,
      };
    })
    .sort((a, b) => b.score - a.score || b.durationMinutes - a.durationMinutes);

  return {
    projectId,
    projectTitle,
    viewerTimezone,
    evaluatedRange: {
      startDate: startDateStr,
      endDate: endDateStr,
      totalDays,
    },
    participants,
    totalMembers,
    configuredCount,
    missingCount,
    privateCount,
    allTeamOverlapMinutes,
    suggestedWindows: suggestedWindows.slice(0, 10), // Top 10 suggested windows
    timelineSlots: coalescedTimeline,
  };
}

/**
 * Calculates pairwise overlap hours between two participants over a given date window.
 * Returns:
 * - overlapHours: number of overlapping working hours
 * - overlapRatio: overlapping hours / userAHours
 * - hasScheduleData: boolean (false if either schedule is missing)
 */
export function calculatePairwiseOverlap(
  participantA: ScheduleParticipant,
  participantB: ScheduleParticipant,
  options: OverlapOptions = {}
): {
  overlapHours: number;
  userATotalHours: number;
  userBTotalHours: number;
  overlapRatio: number;
  hasScheduleData: boolean;
} {
  if (!participantA.schedule || !participantB.schedule) {
    return {
      overlapHours: 0,
      userATotalHours: 0,
      userBTotalHours: 0,
      overlapRatio: 0,
      hasScheduleData: false,
    };
  }

  const startDateStr = options.startDate || formatDateInTimezone(new Date(), options.viewerTimezone || "UTC");
  const days = options.days || 7;

  const windowsA = expandParticipantScheduleToUtc(participantA, startDateStr, days);
  const windowsB = expandParticipantScheduleToUtc(participantB, startDateStr, days);

  const totalMinutesA = windowsA.reduce((sum, w) => sum + (w.endMs - w.startMs) / (60 * 1000), 0);
  const totalMinutesB = windowsB.reduce((sum, w) => sum + (w.endMs - w.startMs) / (60 * 1000), 0);

  // Compute intersections
  let overlapMinutes = 0;
  for (const a of windowsA) {
    for (const b of windowsB) {
      const overlapStart = Math.max(a.startMs, b.startMs);
      const overlapEnd = Math.min(a.endMs, b.endMs);
      if (overlapEnd > overlapStart) {
        overlapMinutes += (overlapEnd - overlapStart) / (60 * 1000);
      }
    }
  }

  const overlapHours = Math.round((overlapMinutes / 60) * 10) / 10;
  const userATotalHours = Math.round((totalMinutesA / 60) * 10) / 10;
  const userBTotalHours = Math.round((totalMinutesB / 60) * 10) / 10;

  const baselineMinutes = Math.min(totalMinutesA, totalMinutesB);
  const overlapRatio = baselineMinutes > 0 ? Math.min(overlapMinutes / baselineMinutes, 1.0) : 0;

  return {
    overlapHours,
    userATotalHours,
    userBTotalHours,
    overlapRatio: Math.round(overlapRatio * 100) / 100,
    hasScheduleData: true,
  };
}
