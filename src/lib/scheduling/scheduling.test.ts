import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isValidIanaTimezone,
  assertValidIanaTimezone,
  normalizeToIanaTimezone,
  localDateTimeToUtcMs,
  resolveIntervalToUtc,
  getDayOfWeekInTimezone,
  formatDateInTimezone,
  formatTimeInTimezone,
} from "./timezone";
import {
  calculateTeamScheduleOverlap,
  calculatePairwiseOverlap,
  expandParticipantScheduleToUtc,
  mergeUtcWindows,
} from "./overlap";
import {
  calculateWeeklyHours,
  AVAILABILITY_PRESETS,
  createDefaultWeeklySlots,
} from "./presets";
import {
  areUsersTeammates,
  getPermittedUserSchedule,
  upsertUserSchedule,
  getTeamAvailability,
} from "./service";
import { scoreAvailabilityFit } from "@/lib/matching";
import { ScheduleParticipant, UserScheduleData } from "./types";
import { prisma } from "@/lib/prisma";

describe("PROJECTMATCH — MUTUAL AVAILABILITY & SCHEDULE COMPATIBILITY TEST SUITE", () => {
  // In-memory data store for service tests
  let users: any[] = [];
  let userSchedules: any[] = [];
  let projects: any[] = [];
  let applications: any[] = [];

  beforeEach(() => {
    users = [
      { id: "user-alice", name: "Alice NewYork", email: "alice@example.com", timezone: "America/New_York" },
      { id: "user-bob", name: "Bob London", email: "bob@example.com", timezone: "Europe/London" },
      { id: "user-charlie", name: "Charlie India", email: "charlie@example.com", timezone: "Asia/Kolkata" },
      { id: "user-eve", name: "Eve Stranger", email: "eve@example.com", timezone: "America/Chicago" },
    ];

    userSchedules = [];
    projects = [
      {
        id: "project-hack-1",
        title: "AI Hackathon Bot",
        ownerId: "user-alice",
        owner: users[0],
      },
    ];

    applications = [
      {
        id: "app-bob",
        projectId: "project-hack-1",
        userId: "user-bob",
        status: "ACCEPTED",
        role: { title: "Backend Engineer" },
      },
      {
        id: "app-charlie",
        projectId: "project-hack-1",
        userId: "user-charlie",
        status: "ACCEPTED",
        role: { title: "Frontend Engineer" },
      },
    ];

    // Mock prisma operations
    vi.spyOn(prisma.userSchedule as any, "findUnique").mockImplementation(async ({ where }: any) => {
      return userSchedules.find((s) => s.userId === where.userId) || null;
    });

    vi.spyOn(prisma.userSchedule as any, "upsert").mockImplementation(async ({ where, create, update }: any) => {
      const idx = userSchedules.findIndex((s) => s.userId === where.userId);
      if (idx >= 0) {
        userSchedules[idx] = { ...userSchedules[idx], ...update, updatedAt: new Date() };
        return userSchedules[idx];
      }
      const record = { id: `sched-${Date.now()}`, ...create, createdAt: new Date(), updatedAt: new Date() };
      userSchedules.push(record);
      return record;
    });

    vi.spyOn(prisma.user as any, "update").mockImplementation(async ({ where, data }: any) => {
      const u = users.find((usr) => usr.id === where.id);
      if (u) Object.assign(u, data);
      return u;
    });

    vi.spyOn(prisma.application as any, "findFirst").mockImplementation(async ({ where }: any) => {
      return applications.find((a) => {
        if (where.userId && a.userId !== where.userId) return false;
        if (where.status && a.status !== where.status) return false;
        if (where.projectId && a.projectId !== where.projectId) return false;
        if (where.project?.ownerId && projects.find((p) => p.id === a.projectId)?.ownerId !== where.project.ownerId) return false;
        return true;
      }) || null;
    });

    vi.spyOn(prisma.application as any, "findMany").mockImplementation(async ({ where }: any) => {
      return applications.filter((a) => {
        if (where.status && a.status !== where.status) return false;
        if (where.userId?.in && !where.userId.in.includes(a.userId)) return false;
        return true;
      });
    });

    vi.spyOn(prisma.project as any, "findUnique").mockImplementation(async ({ where }: any) => {
      const p = projects.find((item) => item.id === where.id);
      if (!p) return null;
      const owner = users.find((u) => u.id === p.ownerId);
      const ownerSchedule = userSchedules.find((s) => s.userId === p.ownerId) || null;

      const projectApps = applications
        .filter((a) => a.projectId === p.id && a.status === "ACCEPTED")
        .map((a) => ({
          ...a,
          user: {
            ...users.find((u) => u.id === a.userId),
            schedule: userSchedules.find((s) => s.userId === a.userId) || null,
          },
        }));

      return {
        ...p,
        owner: { ...owner, schedule: ownerSchedule },
        applications: projectApps,
        hackathon: null,
      };
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 1: IANA Time Zone Validation & Unknown Rejection
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 1: Validates IANA timezones and rejects unknown timezones without silent UTC fallback", () => {
    expect(isValidIanaTimezone("America/New_York")).toBe(true);
    expect(isValidIanaTimezone("Europe/London")).toBe(true);
    expect(isValidIanaTimezone("Asia/Kolkata")).toBe(true);
    expect(isValidIanaTimezone("UTC")).toBe(true);

    expect(isValidIanaTimezone("Invalid/Unknown_Zone")).toBe(false);
    expect(isValidIanaTimezone("Mars/Curiosity")).toBe(false);
    expect(isValidIanaTimezone("")).toBe(false);

    // assertValidIanaTimezone must throw
    expect(() => assertValidIanaTimezone("Fake/Timezone")).toThrow("UNKNOWN_TIMEZONE");

    // Normalization maps known legacy strings to exact IANA identifiers
    expect(normalizeToIanaTimezone("UTC+5:30 (IST)")).toBe("Asia/Kolkata");
    expect(normalizeToIanaTimezone("UTC-5:00 (ET)")).toBe("America/New_York");
    expect(() => normalizeToIanaTimezone("CompletelyGibberish")).toThrow("UNKNOWN_TIMEZONE");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 2: Same-Time-Zone Overlap Calculation
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 2: Computes accurate schedule overlap for members in the same time zone", () => {
    // Both Alice and Partner are in America/New_York
    // Alice: Monday 18:00 - 22:00
    // Partner: Monday 19:00 - 23:00
    // Expected overlap: Monday 19:00 - 22:00 (3 hours = 180 minutes)
    const scheduleAlice: UserScheduleData = {
      userId: "alice",
      timezone: "America/New_York",
      visibility: "TEAM_ONLY",
      weeklySlots: [
        { dayOfWeek: 1, intervals: [{ start: "18:00", end: "22:00" }] },
      ],
      overrides: [],
    };

    const schedulePartner: UserScheduleData = {
      userId: "partner",
      timezone: "America/New_York",
      visibility: "TEAM_ONLY",
      weeklySlots: [
        { dayOfWeek: 1, intervals: [{ start: "19:00", end: "23:00" }] },
      ],
      overrides: [],
    };

    const participants: ScheduleParticipant[] = [
      { id: "alice", name: "Alice", isOwner: true, schedule: scheduleAlice, scheduleStatus: "CONFIGURED" },
      { id: "partner", name: "Partner", isOwner: false, schedule: schedulePartner, scheduleStatus: "CONFIGURED" },
    ];

    // Evaluate starting Monday 2026-10-26 (which is a Monday)
    const result = calculateTeamScheduleOverlap(participants, "p1", "Project 1", {
      startDate: "2026-10-26",
      days: 1,
      viewerTimezone: "America/New_York",
    });

    expect(result.allTeamOverlapMinutes).toBe(180); // 3 hours
    expect(result.suggestedWindows.length).toBeGreaterThan(0);
    expect(result.suggestedWindows[0].isAllTeam).toBe(true);
    expect(result.suggestedWindows[0].availableCount).toBe(2);
    expect(result.suggestedWindows[0].viewerTimeRangeLabel).toContain("7:00 PM – 10:00 PM");

    // Also verify pairwise overlap calculation helper
    const pairwise = calculatePairwiseOverlap(participants[0], participants[1], {
      startDate: "2026-10-26",
      days: 1,
      viewerTimezone: "America/New_York",
    });
    expect(pairwise.hasScheduleData).toBe(true);
    expect(pairwise.overlapHours).toBe(3);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 3: Different Time Zones (America/New_York vs Asia/Kolkata)
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 3: Computes exact overlap between members across different time zones", () => {
    // Alice is in America/New_York (UTC-4 in October DST).
    // Charlie is in Asia/Kolkata (UTC+5:30).
    // NY 09:00 AM EDT = UTC 13:00 = IST 18:30 (6:30 PM).
    // Alice is available Mon 09:00 - 12:00 EDT (UTC 13:00 - 16:00).
    // Charlie is available Mon 18:00 - 22:00 IST (UTC 12:30 - 16:30).
    // Overlapping UTC: 13:00 to 16:00 (3 hours = 180 minutes).
    const scheduleAlice: UserScheduleData = {
      userId: "alice",
      timezone: "America/New_York",
      visibility: "TEAM_ONLY",
      weeklySlots: [
        { dayOfWeek: 1, intervals: [{ start: "09:00", end: "12:00" }] },
      ],
      overrides: [],
    };

    const scheduleCharlie: UserScheduleData = {
      userId: "charlie",
      timezone: "Asia/Kolkata",
      visibility: "TEAM_ONLY",
      weeklySlots: [
        { dayOfWeek: 1, intervals: [{ start: "18:00", end: "22:00" }] },
      ],
      overrides: [],
    };

    const participants: ScheduleParticipant[] = [
      { id: "alice", name: "Alice", schedule: scheduleAlice, scheduleStatus: "CONFIGURED" },
      { id: "charlie", name: "Charlie", schedule: scheduleCharlie, scheduleStatus: "CONFIGURED" },
    ];

    const result = calculateTeamScheduleOverlap(participants, "p1", "Project 1", {
      startDate: "2026-10-26",
      days: 1,
      viewerTimezone: "UTC",
    });

    expect(result.allTeamOverlapMinutes).toBe(180);
    expect(result.suggestedWindows[0].durationMinutes).toBe(180);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 4: Cross-Midnight Intervals (e.g. 22:00 – 02:00 next day)
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 4: Correctly handles intervals that span across midnight into the next calendar day", () => {
    // Night coder works 22:00 to 02:00 (next day) on Monday night
    const interval = { start: "22:00", end: "02:00" };
    const resolved = resolveIntervalToUtc("2026-10-26", interval, "UTC");

    // 22:00 on Oct 26 to 02:00 on Oct 27 = 4 hours = 240 minutes
    expect(resolved.durationMinutes).toBe(240);
    expect(resolved.endMs - resolved.startMs).toBe(4 * 60 * 60 * 1000);

    const scheduleNightCoder: UserScheduleData = {
      userId: "night-coder",
      timezone: "UTC",
      visibility: "TEAM_ONLY",
      weeklySlots: [
        { dayOfWeek: 1, intervals: [interval] },
      ],
      overrides: [],
    };

    // Day coder works Tuesday morning 01:00 to 06:00
    const scheduleDayCoder: UserScheduleData = {
      userId: "day-coder",
      timezone: "UTC",
      visibility: "TEAM_ONLY",
      weeklySlots: [
        { dayOfWeek: 2, intervals: [{ start: "01:00", end: "06:00" }] },
      ],
      overrides: [],
    };

    const participants: ScheduleParticipant[] = [
      { id: "p1", name: "Night Coder", schedule: scheduleNightCoder, scheduleStatus: "CONFIGURED" },
      { id: "p2", name: "Day Coder", schedule: scheduleDayCoder, scheduleStatus: "CONFIGURED" },
    ];

    // Overlap should be on Tuesday 01:00 to 02:00 (1 hour = 60 minutes)
    const result = calculateTeamScheduleOverlap(participants, "p1", "Project", {
      startDate: "2026-10-26",
      days: 2,
      viewerTimezone: "UTC",
    });

    expect(result.allTeamOverlapMinutes).toBe(60);

    // Verify mergeUtcWindows properly coalesces adjacent intervals
    const merged = mergeUtcWindows([
      resolved,
      { startMs: resolved.endMs, endMs: resolved.endMs + 3600000, durationMinutes: 60 },
    ]);
    expect(merged.length).toBe(1);
    expect(merged[0].durationMinutes).toBe(300);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 5: Daylight Saving Time (DST) Transitions
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 5: Calculates correct UTC instants across Daylight Saving Time shifts", () => {
    // In US Eastern (America/New_York), DST ends on first Sunday in November (Nov 1, 2026).
    // Before Nov 1: EDT = UTC - 4 hours.
    // After Nov 1: EST = UTC - 5 hours.
    const summerDate = "2026-07-15"; // EDT (UTC-4)
    const winterDate = "2026-12-15"; // EST (UTC-5)

    const summerUtcMs = localDateTimeToUtcMs(summerDate, "12:00", "America/New_York");
    const winterUtcMs = localDateTimeToUtcMs(winterDate, "12:00", "America/New_York");

    const summerDateObj = new Date(summerUtcMs);
    const winterDateObj = new Date(winterUtcMs);

    // 12:00 EDT should be 16:00 UTC
    expect(summerDateObj.getUTCHours()).toBe(16);
    // 12:00 EST should be 17:00 UTC
    expect(winterDateObj.getUTCHours()).toBe(17);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 6: Different Local Dates Due to Time Zone Offset
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 6: Accounts for different local calendar dates during the same UTC instant", () => {
    // Saturday evening 20:00 in San Francisco (America/Los_Angeles) on 2026-10-24
    // UTC instant is Sunday 2026-10-25 03:00 AM!
    // In Tokyo (Asia/Tokyo, UTC+9), local date is Sunday 2026-10-25 12:00 PM (noon).
    const sfUtcMs = localDateTimeToUtcMs("2026-10-24", "20:00", "America/Los_Angeles");
    const sfDate = new Date(sfUtcMs);

    const formattedInTokyoDate = formatDateInTimezone(sfDate, "Asia/Tokyo");
    const formattedInTokyoTime = formatTimeInTimezone(sfDate, "Asia/Tokyo");

    expect(formattedInTokyoDate).toBe("2026-10-25"); // Sunday in Tokyo
    expect(formattedInTokyoTime).toBe("12:00");

    // Saturday in SF (day 6), Sunday in Tokyo (day 7)
    expect(getDayOfWeekInTimezone(sfDate, "America/Los_Angeles")).toBe(6);
    expect(getDayOfWeekInTimezone(sfDate, "Asia/Tokyo")).toBe(7);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 7: Empty Schedules (Zero Configured Hours)
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 7: Empty schedules result in 0 overlap hours without crashing", () => {
    const emptySchedule: UserScheduleData = {
      userId: "empty",
      timezone: "UTC",
      visibility: "TEAM_ONLY",
      weeklySlots: createDefaultWeeklySlots(),
      overrides: [],
    };

    const regularSchedule: UserScheduleData = {
      userId: "regular",
      timezone: "UTC",
      visibility: "TEAM_ONLY",
      weeklySlots: [
        { dayOfWeek: 1, intervals: [{ start: "09:00", end: "17:00" }] },
      ],
      overrides: [],
    };

    const participants: ScheduleParticipant[] = [
      { id: "empty", name: "Empty Member", schedule: emptySchedule, scheduleStatus: "CONFIGURED" },
      { id: "regular", name: "Regular Member", schedule: regularSchedule, scheduleStatus: "CONFIGURED" },
    ];

    const result = calculateTeamScheduleOverlap(participants, "p1", "Project", {
      startDate: "2026-10-26",
      days: 7,
      viewerTimezone: "UTC",
    });

    expect(result.allTeamOverlapMinutes).toBe(0);
    expect(calculateWeeklyHours(emptySchedule.weeklySlots)).toBe(0);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 8: Missing Schedules Are Not Assumed Free Time
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 8: Missing schedules are categorized as MISSING and never assumed to be free or fully available", () => {
    const regularSchedule: UserScheduleData = {
      userId: "regular",
      timezone: "UTC",
      visibility: "TEAM_ONLY",
      weeklySlots: [
        { dayOfWeek: 1, intervals: [{ start: "10:00", end: "18:00" }] },
      ],
      overrides: [],
    };

    const participants: ScheduleParticipant[] = [
      { id: "u1", name: "Configured User", schedule: regularSchedule, scheduleStatus: "CONFIGURED" },
      { id: "u2", name: "Unconfigured User", schedule: null, scheduleStatus: "MISSING" },
    ];

    const result = calculateTeamScheduleOverlap(participants, "p1", "Project", {
      startDate: "2026-10-26",
      days: 1,
      viewerTimezone: "UTC",
    });

    expect(result.missingCount).toBe(1);
    expect(result.configuredCount).toBe(1);
    // All-team overlap cannot exist when a member's schedule is missing (not treated as free)
    expect(result.allTeamOverlapMinutes).toBe(0);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 9: Partial Team Overlap (e.g. 3 of 4 Teammates Available)
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 9: Identifies partial team overlap intervals with exact available counts", () => {
    const makeSchedule = (id: string, start: string, end: string): UserScheduleData => ({
      userId: id,
      timezone: "UTC",
      visibility: "TEAM_ONLY",
      weeklySlots: [
        { dayOfWeek: 1, intervals: [{ start, end }] },
      ],
      overrides: [],
    });

    // 4 teammates:
    // A: 10:00 - 16:00
    // B: 10:00 - 16:00
    // C: 12:00 - 18:00
    // D: 18:00 - 22:00 (unavailable during day)
    const participants: ScheduleParticipant[] = [
      { id: "A", name: "Member A", schedule: makeSchedule("A", "10:00", "16:00"), scheduleStatus: "CONFIGURED" },
      { id: "B", name: "Member B", schedule: makeSchedule("B", "10:00", "16:00"), scheduleStatus: "CONFIGURED" },
      { id: "C", name: "Member C", schedule: makeSchedule("C", "12:00", "18:00"), scheduleStatus: "CONFIGURED" },
      { id: "D", name: "Member D", schedule: makeSchedule("D", "18:00", "22:00"), scheduleStatus: "CONFIGURED" },
    ];

    const result = calculateTeamScheduleOverlap(participants, "p1", "Project", {
      startDate: "2026-10-26",
      days: 1,
      viewerTimezone: "UTC",
    });

    expect(result.totalMembers).toBe(4);
    expect(result.allTeamOverlapMinutes).toBe(0); // D is not free during the day

    // Between 12:00 and 16:00, 3 members (A, B, C) are available
    const threeMemberWindow = result.suggestedWindows.find((w) => w.availableCount === 3);
    expect(threeMemberWindow).toBeDefined();
    expect(threeMemberWindow?.availableMembers.map((m) => m.id)).toEqual(["A", "B", "C"]);
    expect(threeMemberWindow?.durationMinutes).toBe(240); // 4 hours
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 10: Date-Specific Overrides (Full Day Unavailable & Custom Sprint)
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 10: Applies date-specific overrides correctly overriding recurring weekly slots", () => {
    const schedule: UserScheduleData = {
      userId: "sprint-dev",
      timezone: "UTC",
      visibility: "TEAM_ONLY",
      weeklySlots: [
        // Regular Monday hours: 09:00 - 17:00
        { dayOfWeek: 1, intervals: [{ start: "09:00", end: "17:00" }] },
      ],
      overrides: [
        // Exception 1: On 2026-10-26 (a Monday), Dev is sick / unavailable all day
        { date: "2026-10-26", isUnavailable: true, note: "Sick Day" },
        // Exception 2: On 2026-10-31 (Saturday, normally off), Dev works 10:00 - 22:00 hackathon sprint
        { date: "2026-10-31", isUnavailable: false, intervals: [{ start: "10:00", end: "22:00" }], note: "Hackathon Sprint" },
      ],
    };

    const participant: ScheduleParticipant = {
      id: "sprint-dev",
      name: "Sprint Dev",
      schedule,
      scheduleStatus: "CONFIGURED",
    };

    // Expanding on Monday 2026-10-26 must yield 0 windows (override: isUnavailable = true)
    const mondayWindows = expandParticipantScheduleToUtc(participant, "2026-10-26", 1);
    expect(mondayWindows.length).toBe(0);

    // Expanding on Saturday 2026-10-31 must yield 12 hours (10:00 - 22:00)
    const saturdayWindows = expandParticipantScheduleToUtc(participant, "2026-10-31", 1);
    expect(saturdayWindows.length).toBe(1);
    expect(saturdayWindows[0].durationMinutes).toBe(720); // 12 hours
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 11: Server-Side Privacy Enforcement
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 11: Server-side privacy checks strictly protect PRIVATE and TEAM_ONLY schedules", async () => {
    // 1. Configure schedule for Alice as PRIVATE
    await upsertUserSchedule("user-alice", {
      timezone: "America/New_York",
      visibility: "PRIVATE",
      weeklySlots: [{ dayOfWeek: 1, intervals: [{ start: "09:00", end: "17:00" }] }],
    });

    // Self inspects -> allowed
    const selfInspect = await getPermittedUserSchedule("user-alice", "user-alice");
    expect(selfInspect.status).toBe("CONFIGURED");
    expect(selfInspect.schedule).not.toBeNull();

    // Teammate Bob inspects private schedule -> rejected as PRIVATE
    const bobInspect = await getPermittedUserSchedule("user-alice", "user-bob");
    expect(bobInspect.status).toBe("PRIVATE");
    expect(bobInspect.schedule).toBeNull();

    // 2. Change Alice's visibility to TEAM_ONLY
    await upsertUserSchedule("user-alice", {
      timezone: "America/New_York",
      visibility: "TEAM_ONLY",
      weeklySlots: [{ dayOfWeek: 1, intervals: [{ start: "09:00", end: "17:00" }] }],
    });

    // Teammate Bob (accepted on Alice's project) inspects -> allowed
    const teammateInspect = await getPermittedUserSchedule("user-alice", "user-bob");
    expect(teammateInspect.status).toBe("CONFIGURED");
    expect(teammateInspect.schedule?.timezone).toBe("America/New_York");

    // Stranger Eve (not on project) inspects -> rejected as PRIVATE
    const strangerInspect = await getPermittedUserSchedule("user-alice", "user-eve");
    expect(strangerInspect.status).toBe("PRIVATE");
    expect(strangerInspect.schedule).toBeNull();

    // Unauthorized viewer accessing team availability endpoint throws FORBIDDEN
    await expect(getTeamAvailability("project-hack-1", "user-eve")).rejects.toThrow("FORBIDDEN");

    // Verify areUsersTeammates helper
    expect(await areUsersTeammates("user-alice", "user-bob")).toBe(true);
    expect(await areUsersTeammates("user-alice", "user-eve")).toBe(false);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 12: Matchmaking Compatibility Integration
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 12: Matchmaking incorporates schedule overlap when available and handles missing schedules without penalty", () => {
    // 1. When scheduleOverlapRatio is NOT provided (missing schedule)
    // scoreAvailabilityFit uses baseline without penalizing or assuming 0/100%
    const baselineScore = scoreAvailabilityFit(40, "6+ months", "Full-time", "6+ months");
    expect(baselineScore).toBeGreaterThan(0.9);

    // 2. When scheduleOverlapRatio is provided with high overlap (e.g. 1.0)
    // Real schedule overlap boosts the availability score
    const highOverlapScore = scoreAvailabilityFit(40, "6+ months", "Full-time", "6+ months", 1.0);
    expect(highOverlapScore).toBeGreaterThan(baselineScore);

    // 3. When scheduleOverlapRatio has lower overlap (e.g. 0.20)
    const lowOverlapScore = scoreAvailabilityFit(40, "6+ months", "Full-time", "6+ months", 0.2);
    expect(lowOverlapScore).toBeLessThan(baselineScore);

    // 4. Missing hours profile still gracefully handles null hours
    const missingHoursScore = scoreAvailabilityFit(null, null, "10 hrs/week", "1 month");
    expect(missingHoursScore).toBe(0.3);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 13: Presets & Weekly Hours Calculation
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 13: Validates standard presets and calculates total weekly working hours", () => {
    expect(AVAILABILITY_PRESETS.length).toBeGreaterThanOrEqual(3);

    const weekdayEvenings = AVAILABILITY_PRESETS.find((p) => p.id === "weekday-evenings")!;
    expect(weekdayEvenings).toBeDefined();
    // Mon-Fri: 18:00 - 22:00 = 4 hrs * 5 days = 20 hours
    expect(calculateWeeklyHours(weekdayEvenings.slots)).toBe(20);

    const weekends = AVAILABILITY_PRESETS.find((p) => p.id === "weekends")!;
    // Sat-Sun: 10:00 - 18:00 = 8 hrs * 2 days = 16 hours
    expect(calculateWeeklyHours(weekends.slots)).toBe(16);
  });
});
