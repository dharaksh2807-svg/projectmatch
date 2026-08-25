import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rankUsersForRole, type RoleWithProject } from "@/lib/matching";

export const runtime = "nodejs";

/**
 * GET /api/matches/candidates?roleId=xxx
 * Returns candidates ranked by compatibility for a given role.
 * Only the project owner can call this.
 * Optional query params: limit (default 30), minScore (default 0)
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(request.url);
  const roleId = searchParams.get("roleId");
  const limit = Math.min(parseInt(searchParams.get("limit") || "30"), 100);
  const minScore = parseFloat(searchParams.get("minScore") || "0");

  if (!roleId) {
    return NextResponse.json({ error: "roleId parameter is required" }, { status: 400 });
  }

  const role = await prisma.role.findUnique({
    where: { id: roleId },
    include: {
      project: {
        include: {
          owner: {
            select: { id: true, name: true, image: true, email: true },
          },
        },
      },
    },
  });

  if (!role) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }

  let ownerEmail = session?.user?.email;

  // In development mode, allow viewing the candidate ranking if unauthenticated to facilitate local testing
  if (!ownerEmail && process.env.NODE_ENV !== "production") {
    ownerEmail = role.project.owner.email;
  }

  if (!ownerEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify ownership
  const ownerUser = await prisma.user.findUnique({
    where: { email: ownerEmail },
    select: { id: true },
  });

  if (!ownerUser || role.project.ownerId !== ownerUser.id) {
    return NextResponse.json(
      { error: "Forbidden: You must be the project owner to view ranked candidates for this role." },
      { status: 403 }
    );
  }

  // Fetch all potential candidates (excluding the project owner)
  const candidates = await prisma.user.findMany({
    where: {
      id: { not: ownerUser.id },
      // Candidate must have at least 1 skill
      skills: { isEmpty: false },
    },
    select: {
      id: true,
      name: true,
      email: true,
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
      ownerId: role.project.ownerId,
      owner: {
        name: role.project.owner.name,
        image: role.project.owner.image,
      },
    },
  };

  const ranked = rankUsersForRole(candidates, roleWithProject, { minScore, limit });

  return NextResponse.json({
    role: {
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
        projectType: role.project.projectType,
        duration: role.project.duration,
      },
    },
    count: ranked.length,
    results: ranked,
  });
}
