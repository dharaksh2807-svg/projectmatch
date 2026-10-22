import { prisma } from "@/lib/prisma";
import {
  AvailabilityVisibility,
  DateOverride,
  ScheduleParticipant,
  TeamAvailabilityResult,
  UserScheduleData,
  WeeklyDaySlot,
} from "./types";
import { assertValidIanaTimezone, normalizeToIanaTimezone } from "./timezone";
import { calculateWeeklyHours } from "./presets";
import { calculateTeamScheduleOverlap, OverlapOptions } from "./overlap";

export interface UpsertScheduleInput {
  timezone: string;
  visibility?: AvailabilityVisibility;
  weeklySlots: WeeklyDaySlot[];
  overrides?: DateOverride[];
}

/**
 * Checks whether two users share team membership on any project.
 * Teammates:
 * - User A is owner, User B is accepted applicant
 * - User B is owner, User A is accepted applicant
 * - User A and User B are both accepted applicants on the same project
 */
export async function areUsersTeammates(userAId: string, userBId: string): Promise<boolean> {
  if (userAId === userBId) return true;

  // 1. Check if userA owns a project where userB is accepted
  const aOwnsBAccepted = await prisma.application.findFirst({
    where: {
      userId: userBId,
      status: "ACCEPTED",
      project: { ownerId: userAId },
    },
    select: { id: true },
  });
  if (aOwnsBAccepted) return true;

  // 2. Check if userB owns a project where userA is accepted
  const bOwnsAAccepted = await prisma.application.findFirst({
    where: {
      userId: userAId,
      status: "ACCEPTED",
      project: { ownerId: userBId },
    },
    select: { id: true },
  });
  if (bOwnsAAccepted) return true;

  // 3. Check if both are accepted applicants on the same project
  const sharedProjects = await prisma.application.findMany({
    where: {
      userId: { in: [userAId, userBId] },
      status: "ACCEPTED",
    },
    select: { projectId: true, userId: true },
  });

  const projectsA = new Set(sharedProjects.filter((p) => p.userId === userAId).map((p) => p.projectId));
  const hasShared = sharedProjects.some((p) => p.userId === userBId && projectsA.has(p.projectId));
  return hasShared;
}

/**
 * Retrieves a user's schedule with server-side privacy enforcement.
 */
export async function getPermittedUserSchedule(
  targetUserId: string,
  viewerUserId?: string | null
): Promise<{ schedule: UserScheduleData | null; status: "CONFIGURED" | "MISSING" | "PRIVATE" }> {
  const record = await prisma.userSchedule.findUnique({
    where: { userId: targetUserId },
  });

  if (!record) {
    return { schedule: null, status: "MISSING" };
  }

  const isSelf = viewerUserId === targetUserId;

  // If viewing self, always permitted
  if (isSelf) {
    return {
      schedule: {
        id: record.id,
        userId: record.userId,
        timezone: record.timezone,
        weeklyHours: record.weeklyHours,
        visibility: record.visibility as AvailabilityVisibility,
        weeklySlots: record.weeklySlots as unknown as WeeklyDaySlot[],
        overrides: record.overrides as unknown as DateOverride[],
        updatedAt: record.updatedAt,
      },
      status: "CONFIGURED",
    };
  }

  // Privacy checks
  if (record.visibility === "PRIVATE") {
    return { schedule: null, status: "PRIVATE" };
  }

  if (record.visibility === "TEAM_ONLY") {
    if (!viewerUserId) {
      return { schedule: null, status: "PRIVATE" };
    }
    const isTeammate = await areUsersTeammates(targetUserId, viewerUserId);
    if (!isTeammate) {
      return { schedule: null, status: "PRIVATE" };
    }
  }

  // PUBLIC or authorized TEAM_ONLY
  return {
    schedule: {
      id: record.id,
      userId: record.userId,
      timezone: record.timezone,
      weeklyHours: record.weeklyHours,
      visibility: record.visibility as AvailabilityVisibility,
      weeklySlots: record.weeklySlots as unknown as WeeklyDaySlot[],
      overrides: record.overrides as unknown as DateOverride[],
      updatedAt: record.updatedAt,
    },
    status: "CONFIGURED",
  };
}

/**
 * Upserts a user's availability schedule.
 * Enforces strict IANA time zone validation (rejects invalid/unknown timezones).
 */
export async function upsertUserSchedule(
  userId: string,
  input: UpsertScheduleInput
): Promise<UserScheduleData> {
  const normalizedTz = normalizeToIanaTimezone(input.timezone);
  assertValidIanaTimezone(normalizedTz);

  const weeklyHours = calculateWeeklyHours(input.weeklySlots);
  const visibility = input.visibility || "TEAM_ONLY";
  const overrides = input.overrides || [];

  const record = await prisma.userSchedule.upsert({
    where: { userId },
    create: {
      userId,
      timezone: normalizedTz,
      weeklyHours,
      visibility,
      weeklySlots: input.weeklySlots as any,
      overrides: overrides as any,
    },
    update: {
      timezone: normalizedTz,
      weeklyHours,
      visibility,
      weeklySlots: input.weeklySlots as any,
      overrides: overrides as any,
    },
  });

  // Also sync the user's top-level timezone field for backward compatibility
  await prisma.user.update({
    where: { id: userId },
    data: { timezone: normalizedTz },
  }).catch(() => {});

  return {
    id: record.id,
    userId: record.userId,
    timezone: record.timezone,
    weeklyHours: record.weeklyHours,
    visibility: record.visibility as AvailabilityVisibility,
    weeklySlots: record.weeklySlots as unknown as WeeklyDaySlot[],
    overrides: record.overrides as unknown as DateOverride[],
    updatedAt: record.updatedAt,
  };
}

/**
 * Retrieves the team availability overlap and suggested meeting windows for a project.
 * Server-side authorization check: viewer must be project owner or accepted member.
 */
export async function getTeamAvailability(
  projectId: string,
  viewerUserId: string,
  options: OverlapOptions = {}
): Promise<TeamAvailabilityResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          image: true,
          schedule: true,
        },
      },
      applications: {
        where: { status: "ACCEPTED" },
        include: {
          role: { select: { title: true } },
          user: {
            select: {
              id: true,
              name: true,
              image: true,
              schedule: true,
            },
          },
        },
      },
      hackathon: {
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          timezone: true,
        },
      },
    },
  });

  if (!project) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  // Authorization check: viewer must be owner or accepted member
  const isOwner = project.ownerId === viewerUserId;
  const isAcceptedMember = project.applications.some((app) => app.user.id === viewerUserId);

  if (!isOwner && !isAcceptedMember) {
    throw new Error("FORBIDDEN: Only authorized team members can view shared team availability.");
  }

  // Build participant list
  const participants: ScheduleParticipant[] = [];

  // 1. Owner
  const ownerRecord = project.owner.schedule;
  let ownerSchedule: UserScheduleData | null = null;
  let ownerStatus: "CONFIGURED" | "MISSING" | "PRIVATE" = "MISSING";

  if (ownerRecord) {
    if (ownerRecord.visibility === "PRIVATE" && viewerUserId !== project.owner.id) {
      ownerStatus = "PRIVATE";
    } else {
      ownerStatus = "CONFIGURED";
      ownerSchedule = {
        id: ownerRecord.id,
        userId: ownerRecord.userId,
        timezone: ownerRecord.timezone,
        weeklyHours: ownerRecord.weeklyHours,
        visibility: ownerRecord.visibility as AvailabilityVisibility,
        weeklySlots: ownerRecord.weeklySlots as unknown as WeeklyDaySlot[],
        overrides: ownerRecord.overrides as unknown as DateOverride[],
      };
    }
  }

  participants.push({
    id: project.owner.id,
    name: project.owner.name,
    image: project.owner.image,
    roleTitle: "Project Lead",
    isOwner: true,
    schedule: ownerSchedule,
    scheduleStatus: ownerStatus,
  });

  // 2. Accepted Team Members
  for (const app of project.applications) {
    const member = app.user;
    const memberRecord = member.schedule;
    let memberSchedule: UserScheduleData | null = null;
    let memberStatus: "CONFIGURED" | "MISSING" | "PRIVATE" = "MISSING";

    if (memberRecord) {
      if (memberRecord.visibility === "PRIVATE" && viewerUserId !== member.id) {
        memberStatus = "PRIVATE";
      } else {
        memberStatus = "CONFIGURED";
        memberSchedule = {
          id: memberRecord.id,
          userId: memberRecord.userId,
          timezone: memberRecord.timezone,
          weeklyHours: memberRecord.weeklyHours,
          visibility: memberRecord.visibility as AvailabilityVisibility,
          weeklySlots: memberRecord.weeklySlots as unknown as WeeklyDaySlot[],
          overrides: memberRecord.overrides as unknown as DateOverride[],
        };
      }
    }

    participants.push({
      id: member.id,
      name: member.name,
      image: member.image,
      roleTitle: app.role.title,
      isOwner: false,
      schedule: memberSchedule,
      scheduleStatus: memberStatus,
    });
  }

  return calculateTeamScheduleOverlap(
    participants,
    project.id,
    project.title,
    options
  );
}
