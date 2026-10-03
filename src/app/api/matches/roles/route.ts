import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/matches/roles
 *
 * Returns roles from published projects.
 * For authenticated users: also attaches a compatibility score based on skill overlap.
 * For guests: returns plain role list (no scores).
 *
 * Public endpoint — no auth required for browsing.
 */
export async function GET(req: NextRequest) {
  try {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  // Fetch user's skills if logged in
  let userSkills: string[] = [];
  let userExperienceLevel: string | null = null;
  let userAvailability: string | null = null;

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { skills: true, experienceLevel: true, availability: true, reputationScore: true },
    });
    if (user) {
      userSkills = user.skills;
      userExperienceLevel = user.experienceLevel ?? null;
      userAvailability = user.availability ?? null;
    }
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const typeFilter = searchParams.get("type");
    const durationFilter = searchParams.get("duration");
    const expFilter = searchParams.get("exp");
    const skillFilter = searchParams.get("skill");
    const query = searchParams.get("q");

    // Build the Prisma where clause
    const whereClause: any = {
      isOpen: true,
      project: { isPublished: true },
    };

    if (typeFilter && typeFilter !== "All") {
      whereClause.project.projectType = { equals: typeFilter, mode: "insensitive" };
    }

    if (durationFilter && durationFilter !== "All") {
      whereClause.project.duration = { equals: durationFilter, mode: "insensitive" };
    }

    if (expFilter && expFilter !== "All") {
      whereClause.requiredExperienceLevel = { equals: expFilter, mode: "insensitive" };
    }

    if (skillFilter) {
      whereClause.requiredSkills = { has: skillFilter };
    }

    if (query) {
      whereClause.OR = [
        { title: { contains: query, mode: "insensitive" } },
        { project: { title: { contains: query, mode: "insensitive" } } },
        { project: { description: { contains: query, mode: "insensitive" } } },
      ];
    }

    const roles = await prisma.role.findMany({
      where: whereClause,
      include: {
        project: {
          select: {
            id: true,
            title: true,
            description: true,
            projectType: true,
            duration: true,
            ownerId: true,
            owner: {
              select: { name: true, image: true, reputationScore: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Attach compatibility score for authenticated users
    const results = roles.map((role) => {
      let compatibility: {
        score: number;
        breakdown: {
          skillOverlap: number;
          availabilityFit: number;
          interestAlignment: number;
          experienceFit: number;
          reputationScore: number;
        };
      } | undefined = undefined;

      if (userId && userSkills.length > 0) {
        // Skill overlap: ratio of user skills matching role requirements
        const roleSkills = role.requiredSkills;
        const matchingSkills = roleSkills.filter((s) =>
          userSkills.some((us) => us.toLowerCase() === s.toLowerCase())
        );
        const skillOverlap = roleSkills.length > 0
          ? matchingSkills.length / roleSkills.length
          : 0.5; // no requirement = neutral

        // Experience fit: compare user vs role levels
        const levels = ["Beginner", "Intermediate", "Advanced", "Expert"];
        const userLevelIdx = levels.indexOf(userExperienceLevel ?? "");
        const roleLevelIdx = levels.indexOf(role.requiredExperienceLevel);
        let experienceFit = 0.5;
        if (role.requiredExperienceLevel === "Any") {
          experienceFit = 1.0;
        } else if (userLevelIdx >= 0 && roleLevelIdx >= 0) {
          const diff = Math.abs(userLevelIdx - roleLevelIdx);
          experienceFit = diff === 0 ? 1.0 : diff === 1 ? 0.7 : 0.3;
        }

        // Availability fit: loose string match
        const availabilityFit =
          !userAvailability || !role.timeCommitment
            ? 0.5
            : role.timeCommitment.toLowerCase().includes(userAvailability.toLowerCase()) ||
              userAvailability.toLowerCase() === "flexible"
            ? 1.0
            : 0.4;

        // Interest alignment: placeholder — would use NLP in production
        const interestAlignment = skillOverlap > 0 ? 0.75 : 0.5;

        // Reputation — treat as fixed 0.7 (production: factor in peer reviews)
        const reputationScore = 0.7;

        const score =
          skillOverlap * 0.4 +
          experienceFit * 0.25 +
          availabilityFit * 0.2 +
          interestAlignment * 0.1 +
          reputationScore * 0.05;

        compatibility = {
          score: Math.min(Math.max(score, 0), 1),
          breakdown: {
            skillOverlap,
            availabilityFit,
            interestAlignment,
            experienceFit,
            reputationScore,
          },
        };
      }

      return { ...role, compatibility };
    });

    // Sort: authenticated users get recommended (score >= 0.5) first
    if (userId) {
      results.sort((a, b) => {
        const sa = a.compatibility?.score ?? 0;
        const sb = b.compatibility?.score ?? 0;
        return sb - sa;
      });
    }

    return NextResponse.json({ results });
  } catch (err) {
    console.error("GET /api/matches/roles failed:", err);
    return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 });
  }
  } catch (outerErr) {
    console.error("GET /api/matches/roles unhandled error:", outerErr);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
