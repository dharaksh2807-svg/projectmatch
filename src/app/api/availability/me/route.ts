import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AVAILABILITY_PRESETS, createDefaultWeeklySlots } from "@/lib/scheduling/presets";
import { POPULAR_IANA_TIMEZONES, isValidIanaTimezone } from "@/lib/scheduling/timezone";
import { UserScheduleData, WeeklyDaySlot, DateOverride } from "@/lib/scheduling/types";
import { upsertUserSchedule } from "@/lib/scheduling/service";
import { z } from "zod";

const intervalSchema = z.object({
  start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid start time format (HH:mm)"),
  end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid end time format (HH:mm)"),
});

const weeklySlotSchema = z.object({
  dayOfWeek: z.number().int().min(1).max(7),
  intervals: z.array(intervalSchema),
});

const dateOverrideSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  isUnavailable: z.boolean().optional(),
  intervals: z.array(intervalSchema).optional(),
  note: z.string().max(100).optional(),
});

const updateScheduleSchema = z.object({
  timezone: z.string().refine((tz) => isValidIanaTimezone(tz), {
    message: "Unknown or invalid IANA time zone identifier.",
  }),
  visibility: z.enum(["PUBLIC", "TEAM_ONLY", "PRIVATE"]).optional(),
  weeklySlots: z.array(weeklySlotSchema),
  overrides: z.array(dateOverrideSchema).optional(),
});

/**
 * GET /api/availability/me
 * Retrieves current user's schedule, presets, and available timezones.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user, schedule] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { timezone: true, availability: true },
    }),
    prisma.userSchedule.findUnique({
      where: { userId: session.user.id },
    }),
  ]);

  const resolvedTimezone = schedule?.timezone || user?.timezone || "UTC";

  const scheduleData: UserScheduleData = schedule
    ? {
        id: schedule.id,
        userId: schedule.userId,
        timezone: schedule.timezone,
        weeklyHours: schedule.weeklyHours,
        visibility: schedule.visibility as any,
        weeklySlots: schedule.weeklySlots as unknown as WeeklyDaySlot[],
        overrides: schedule.overrides as unknown as DateOverride[],
        updatedAt: schedule.updatedAt,
      }
    : {
        userId: session.user.id,
        timezone: resolvedTimezone,
        weeklyHours: 0,
        visibility: "TEAM_ONLY",
        weeklySlots: createDefaultWeeklySlots(),
        overrides: [],
      };

  return NextResponse.json({
    schedule: scheduleData,
    presets: AVAILABILITY_PRESETS,
    timezones: POPULAR_IANA_TIMEZONES,
  });
}

/**
 * PUT /api/availability/me
 * Updates current user's weekly availability schedule, timezone, and overrides.
 */
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const validated = updateScheduleSchema.parse(body);

    const saved = await upsertUserSchedule(session.user.id, validated);

    return NextResponse.json({
      success: true,
      schedule: saved,
      message: "Schedule updated successfully.",
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: err.flatten() },
        { status: 400 }
      );
    }
    console.error("PUT /api/availability/me error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to update schedule" },
      { status: 500 }
    );
  }
}
