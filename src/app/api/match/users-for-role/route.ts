import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rankUsersForRole, type RoleWithProject } from "@/lib/matching";

export const runtime = "nodejs";

/**
 * GET /api/match/users-for-role?roleId=xxx
 * Returns users ranked by compatibility for a given role.
 * Only the project owner can call this.
 * Optional: limit (default 20), minScore (default 0)
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const roleId = searchParams.get("roleId");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const minScore = parseFloat(searchParams.get("minScore") || "0");

  if (!roleId) {
    return NextResponse.json({ error: "roleId is required" }, { status: 400 });
  }

  const role = await prisma.role.findUnique({
    where: { id: roleId },
    include: {
      project: {
        include: {
          owner: {
            select: { name: true, image: true, email: true },
          },
        },
      },
    },
  });

  if (!role) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }

  // Only project owner can see candidates
  if (role.project.owner.email !== session.user.email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch all users (excluding the owner)
  const ownerUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  const users = await prisma.user.findMany({
    where: {
      id: { not: ownerUser?.id },
      // Only users with at least some profile data
      skills: { isEmpty: false },
    },
    select: {
      id: true,
      name: true,
      image: true,
      skills: true,
      interests: true,
      availabilityHours: true,
      availabilityDuration: true,
      experienceLevel: true,
      reputationScore: true,
      portfolioLinks: true,
    },
  });

  const roleWithProject: RoleWithProject = {
    id: role.id,
    title: role.title,
    requiredSkills: role.requiredSkills,
    requiredExperienceLevel: role.requiredExperienceLevel,
    timeCommitment: role.timeCommitment,
    headcount: role.headcount,
    filledCount: role.filledCount,
    project: {
      id: role.project.id,
      title: role.project.title,
      description: role.project.description,
      projectType: role.project.projectType,
      duration: role.project.duration,
      ownerId: role.projectId,
      owner: {
        name: role.project.owner.name,
        image: role.project.owner.image,
      },
    },
  };

  const ranked = rankUsersForRole(users, roleWithProject, { minScore, limit });

  return NextResponse.json({
    roleId,
    roleTitle: role.title,
    count: ranked.length,
    results: ranked,
  });
}
