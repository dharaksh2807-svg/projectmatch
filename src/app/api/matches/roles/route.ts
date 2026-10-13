import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/matches/roles
 *
 * Query params:
 *   type        — project type (e.g. "Hackathon")
 *   duration    — project duration (e.g. "1-3 months")
 *   exp         — required experience level (e.g. "Intermediate", "Any")
 *   skill       — required skill
 *   tech        — project tech stack item
 *   q           — search query
 *   minScore    — minimum match score (0-90)
 *   openOnly    — "true" | "false" (spots available only)
 *   hideApplied — "true" | "false" (hide roles user already applied for)
 *   bookmarkedOnly — "true" | "false" (show only saved roles)
 *   sort        — "match" | "newest" | "spots" | "title"
 *   cursor      — pagination cursor (role ID)
 *   limit       — page size (default: 12)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;

    // Fetch user's profile and applications if logged in
    let userSkills: string[] = [];
    let userExperienceLevel: string | null = null;
    let userAvailability: string | null = null;
    let appliedRoleIds: string[] = [];
    let bookmarkedRoleIds: string[] = [];

    if (userId) {
      const [user, applications, bookmarks] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { skills: true, experienceLevel: true, availability: true, reputationScore: true },
        }),
        prisma.application.findMany({
          where: { userId },
          select: { roleId: true },
        }),
        prisma.roleBookmark.findMany({
          where: { userId },
          select: { roleId: true },
        }),
      ]);

      if (user) {
        userSkills = user.skills;
        userExperienceLevel = user.experienceLevel ?? null;
        userAvailability = user.availability ?? null;
      }
      appliedRoleIds = applications.map((a) => a.roleId);
      bookmarkedRoleIds = bookmarks.map((b) => b.roleId);
    }

    const searchParams = req.nextUrl.searchParams;
    const typeFilter = searchParams.get("type");
    const durationFilter = searchParams.get("duration");
    const expFilter = searchParams.get("exp");
    const skillFilter = searchParams.get("skill");
    const techFilter = searchParams.get("tech");
    const query = searchParams.get("q")?.trim();
    const minScoreParam = searchParams.get("minScore");
    const minScoreThreshold = minScoreParam ? parseInt(minScoreParam, 10) / 100 : 0;
    const openOnly = searchParams.get("openOnly") === "true";
    const hideApplied = searchParams.get("hideApplied") === "true";
    const bookmarkedOnly = searchParams.get("bookmarkedOnly") === "true";
    const sortBy = searchParams.get("sort") || (userId ? "match" : "newest");
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "12", 10), 1), 50);
    const cursor = searchParams.get("cursor");

    // ─── Build WHERE clause ─────────────────────────────────────────────────
    const andConditions: any[] = [
      { isOpen: true },
      { project: { isPublished: true } },
    ];

    if (typeFilter && typeFilter !== "All") {
      andConditions.push({
        project: { projectType: { equals: typeFilter, mode: "insensitive" } },
      });
    }

    if (durationFilter && durationFilter !== "All") {
      andConditions.push({
        project: { duration: { equals: durationFilter, mode: "insensitive" } },
      });
    }

    if (expFilter && expFilter !== "All") {
      andConditions.push({
        requiredExperienceLevel: { equals: expFilter, mode: "insensitive" },
      });
    }

    if (skillFilter && skillFilter.trim()) {
      andConditions.push({
        requiredSkills: { has: skillFilter.trim() },
      });
    }

    if (techFilter && techFilter.trim()) {
      andConditions.push({
        project: { techStack: { has: techFilter.trim() } },
      });
    }

    if (query) {
      andConditions.push({
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { project: { title: { contains: query, mode: "insensitive" } } },
          { project: { description: { contains: query, mode: "insensitive" } } },
        ],
      });
    }

    if (hideApplied && appliedRoleIds.length > 0) {
      andConditions.push({
        id: { notIn: appliedRoleIds },
      });
    }

    if (bookmarkedOnly) {
      if (!userId || bookmarkedRoleIds.length === 0) {
        return NextResponse.json({
          results: [],
          nextCursor: null,
          hasMore: false,
          totalAvailable: 0,
          appliedRoleIds,
          bookmarkedRoleIds,
          allUniqueTechs: [],
        });
      }
      andConditions.push({
        id: { in: bookmarkedRoleIds },
      });
    }

    // Fetch roles
    const roles = await prisma.role.findMany({
      where: { AND: andConditions },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            description: true,
            projectType: true,
            duration: true,
            techStack: true,
            ownerId: true,
            owner: {
              select: { name: true, image: true, reputationScore: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Extract all unique techStack items across published projects for the filter UI
    const allUniqueTechsSet = new Set<string>();
    roles.forEach((r) => {
      r.project.techStack?.forEach((t) => allUniqueTechsSet.add(t));
    });
    const allUniqueTechs = Array.from(allUniqueTechsSet).slice(0, 20);

    // Compute compatibility and open spots
    let results = roles.map((role) => {
      const openSpots = Math.max(role.headcount - role.filledCount, 0);
      const isApplied = appliedRoleIds.includes(role.id);
      const isBookmarked = bookmarkedRoleIds.includes(role.id);

      let compatibility:
        | {
            score: number;
            breakdown: {
              skillOverlap: number;
              availabilityFit: number;
              interestAlignment: number;
              experienceFit: number;
              reputationScore: number;
            };
          }
        | undefined = undefined;

      if (userId) {
        const roleSkills = role.requiredSkills;
        const matchingSkills = roleSkills.filter((s) =>
          userSkills.some((us) => us.toLowerCase() === s.toLowerCase())
        );
        const skillOverlap =
          roleSkills.length > 0
            ? matchingSkills.length / roleSkills.length
            : 0.5;

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

        let availabilityFit = 0.5;
        if (userAvailability && role.timeCommitment) {
          const userAv = userAvailability.toLowerCase();
          const roleTime = role.timeCommitment.toLowerCase();
          if (userAv === "flexible" || roleTime.includes(userAv) || userAv.includes(roleTime)) {
            availabilityFit = 1.0;
          } else {
            availabilityFit = 0.4;
          }
        }

        const interestAlignment = skillOverlap > 0 ? 0.75 : 0.5;
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

      return {
        ...role,
        openSpots,
        isApplied,
        isBookmarked,
        compatibility,
      };
    });

    // Filter "Spots available"
    if (openOnly) {
      results = results.filter((r) => r.openSpots > 0);
    }

    // Filter "minScore"
    if (userId && minScoreThreshold > 0) {
      results = results.filter(
        (r) => !r.compatibility || r.compatibility.score >= minScoreThreshold
      );
    }

    // Sorting
    results.sort((a, b) => {
      if (sortBy === "match" && userId) {
        const sa = a.compatibility?.score ?? 0;
        const sb = b.compatibility?.score ?? 0;
        if (sb !== sa) return sb - sa;
      } else if (sortBy === "spots") {
        if (b.openSpots !== a.openSpots) return b.openSpots - a.openSpots;
      } else if (sortBy === "title") {
        return a.title.localeCompare(b.title);
      }
      // default: newest
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const totalAvailable = results.length;

    // Cursor pagination
    let startIndex = 0;
    if (cursor) {
      const foundIdx = results.findIndex((r) => r.id === cursor);
      if (foundIdx >= 0) {
        startIndex = foundIdx + 1;
      }
    }

    const paginated = results.slice(startIndex, startIndex + limit);
    const nextItem = results[startIndex + limit];
    const nextCursor = nextItem ? paginated[paginated.length - 1]?.id || null : null;
    const hasMore = startIndex + limit < results.length;

    return NextResponse.json({
      results: paginated,
      nextCursor,
      hasMore,
      totalAvailable,
      appliedRoleIds,
      bookmarkedRoleIds,
      allUniqueTechs,
    });
  } catch (err) {
    console.error("GET /api/matches/roles failed:", err);
    return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 });
  }
}
