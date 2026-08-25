import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rankRolesForUser, type RoleWithProject } from "@/lib/matching";

export const runtime = "nodejs";

/**
 * GET /api/matches/roles
 * Returns open roles ranked by compatibility for the authenticated user.
 * Supports query params: limit, minScore, skill, projectType, duration
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const minScore = parseFloat(searchParams.get("minScore") || "0");
  const skillFilter = searchParams.get("skill");
  const projectTypeFilter = searchParams.get("projectType");
  const durationFilter = searchParams.get("duration");

  let currentUser = null;
  if (session?.user?.email) {
    currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
  }

  // Fetch all open roles with their project data
  const rawRoles = await prisma.role.findMany({
    include: {
      project: {
        include: {
          owner: { select: { name: true, image: true, email: true, reputationScore: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Filter open roles
  let openRoles = rawRoles.filter((r) => r.filledCount < r.headcount);

  if (projectTypeFilter && projectTypeFilter !== "all") {
    openRoles = openRoles.filter(
      (r) => r.project.projectType.toLowerCase() === projectTypeFilter.toLowerCase()
    );
  }

  if (durationFilter && durationFilter !== "all") {
    openRoles = openRoles.filter(
      (r) => r.project.duration.toLowerCase() === durationFilter.toLowerCase()
    );
  }

  if (skillFilter && skillFilter !== "all") {
    const sLower = skillFilter.toLowerCase();
    openRoles = openRoles.filter((r) =>
      r.requiredSkills.some((skill) => skill.toLowerCase().includes(sLower))
    );
  }

  // If user is authenticated, rank them using the matching engine
  if (currentUser) {
    const formattedRoles: RoleWithProject[] = openRoles.map((r) => ({
      id: r.id,
      title: r.title,
      requiredSkills: r.requiredSkills,
      requiredExperienceLevel: r.requiredExperienceLevel,
      timeCommitment: r.timeCommitment,
      headcount: r.headcount,
      filledCount: r.filledCount,
      project: {
        id: r.project.id,
        title: r.project.title,
        description: r.project.description,
        projectType: r.project.projectType,
        duration: r.project.duration,
        ownerId: r.project.ownerId,
        owner: {
          name: r.project.owner.name,
          image: r.project.owner.image,
          reputationScore: r.project.owner.reputationScore,
        },
      },
    }));

    const ranked = rankRolesForUser(
      {
        id: currentUser.id,
        name: currentUser.name,
        image: currentUser.image,
        skills: currentUser.skills,
        interests: currentUser.interests,
        availabilityHours: currentUser.availabilityHours,
        availabilityDuration: currentUser.availabilityDuration,
        experienceLevel: currentUser.experienceLevel,
        reputationScore: currentUser.reputationScore,
        portfolioLinks: currentUser.portfolioLinks,
      },
      formattedRoles,
      {
        excludeOwnedBy: currentUser.id,
        minScore,
        limit,
      }
    );

    return NextResponse.json({
      userId: currentUser.id,
      count: ranked.length,
      results: ranked,
    });
  }

  // Fallback for unauthenticated/guest users (no personalized ranking)
  const defaultResults = openRoles.slice(0, limit).map((r) => ({
    ...r,
    compatibility: {
      score: 0,
      breakdown: {
        skillOverlap: 0,
        availabilityFit: 0,
        interestAlignment: 0,
        experienceFit: 0,
        reputationScore: 0,
      },
    },
  }));

  return NextResponse.json({
    userId: null,
    count: defaultResults.length,
    results: defaultResults,
  });
}
