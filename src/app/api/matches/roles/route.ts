import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";


/**
 * Helper to match tags with normalization and punctuation removal
 */
function tagMatches(candidate: string, target: string): boolean {
  const c = candidate.toLowerCase().trim();
  const t = target.toLowerCase().trim();
  if (c === t) return true;
  if (c.includes(t) || t.includes(c)) return true;
  const cClean = c.replace(/[^a-z0-9]/g, "");
  const tClean = t.replace(/[^a-z0-9]/g, "");
  if (cClean && tClean && (cClean === tClean || cClean.includes(tClean) || tClean.includes(cClean))) return true;
  return false;
}

/**
 * GET /api/matches/roles
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;

    // Fetch user profile and applications/bookmarks
    let userSkills: string[] = [];
    let appliedRoleIds: string[] = [];
    let bookmarkedRoleIds: string[] = [];

    if (userId) {
      const [user, applications, bookmarks] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: {
            skills: true,
          },
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
        userSkills = user.skills || [];
      }
      appliedRoleIds = applications.map((a) => a.roleId);
      bookmarkedRoleIds = bookmarks.map((b) => b.roleId);
    }

    const searchParams = req.nextUrl.searchParams;
    const typeFilter = searchParams.get("type");
    const durationFilter = searchParams.get("duration");
    const expFilter = searchParams.get("exp");

    // Multi-select support for skill and tech parameters
    const rawSkills = searchParams.getAll("skill");
    const skillList = rawSkills
      .flatMap((s) => s.split(","))
      .map((s) => s.trim())
      .filter(Boolean);

    const rawTechs = searchParams.getAll("tech");
    const techList = rawTechs
      .flatMap((t) => t.split(","))
      .map((t) => t.trim())
      .filter(Boolean);

    const query = searchParams.get("q")?.trim();
    const minScoreParam = searchParams.get("minScore");
    const minScoreThreshold = minScoreParam ? parseInt(minScoreParam, 10) / 100 : 0;
    const openOnly = searchParams.get("openOnly") === "true";
    const hideApplied = searchParams.get("hideApplied") === "true";
    const bookmarkedOnly = searchParams.get("bookmarkedOnly") === "true";
    const sortBy = searchParams.get("sort") || "match";
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "12", 10), 1), 50);
    const cursor = searchParams.get("cursor");

    // ─── Active Filter Factors Calculation ──────────────────────────────────
    // Every chosen filter element is exactly 1 factor:
    // - Project Type (if !== "All"): 1 factor
    // - Duration (if !== "All"): 1 factor
    // - Experience Level (if !== "All"): 1 factor
    // - Each selected Tech Stack tag: 1 factor
    // - Each selected Skill tag: 1 factor
    // - Search query keyword (if non-empty): 1 factor
    let totalFilterFactors = 0;
    if (typeFilter && typeFilter !== "All") totalFilterFactors += 1;
    if (durationFilter && durationFilter !== "All") totalFilterFactors += 1;
    if (expFilter && expFilter !== "All") totalFilterFactors += 1;
    if (techList.length > 0) totalFilterFactors += techList.length;
    if (skillList.length > 0) totalFilterFactors += skillList.length;
    if (query) totalFilterFactors += 1;

    const hasActiveFilters = totalFilterFactors > 0;

    // ─── Build WHERE clause ─────────────────────────────────────────────────
    // Soft scoring is used for filter criteria so roles are ranked by match %
    // rather than abruptly discarded by SQL where clauses.
    const andConditions: any[] = [
      { isOpen: true },
      { project: { isPublished: true } },
    ];

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
          userHasSkills: userSkills.length > 0,
          activeFilterCount: 0,
        });
      }
      andConditions.push({
        id: { in: bookmarkedRoleIds },
      });
    }

    // Fetch all open published roles
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

    // Extract all unique techStack items across published projects
    const allUniqueTechsSet = new Set<string>();
    roles.forEach((r) => {
      r.project.techStack?.forEach((t) => allUniqueTechsSet.add(t));
    });
    const allUniqueTechs = Array.from(allUniqueTechsSet).slice(0, 30);

    // ─── Exact Filter Matching Engine ───────────────────────────────────────
    // If hasActiveFilters:
    //   Total Match % = (Matched Factors / Total Active Filter Factors) * 100%
    //   e.g. 4 matches out of 10 active filters = 40% Match.
    // If NO active filters:
    //   compatibility hasActiveFilters is false (Match % badge is hidden in UI).
    let results = roles.map((role) => {
      const openSpots = Math.max(role.headcount - role.filledCount, 0);
      const isApplied = appliedRoleIds.includes(role.id);
      const isBookmarked = bookmarkedRoleIds.includes(role.id);

      let compatibility:
        | {
            score: number;
            factorsMatched: number;
            totalFactors: number;
            hasActiveFilters: boolean;
            breakdown: {
              skillOverlap: number;
              techOverlap: number;
              typeFit: number;
              durationFit: number;
              experienceFit: number;
            };
          }
        | undefined = undefined;

      if (hasActiveFilters) {
        let matchedCount = 0;
        let matchedType = 0;
        let matchedDuration = 0;
        let matchedExp = 0;
        let matchedTechs = 0;
        let matchedSkills = 0;

        // 1. Project Type
        if (typeFilter && typeFilter !== "All") {
          if (role.project.projectType.toLowerCase().trim() === typeFilter.toLowerCase().trim()) {
            matchedCount += 1;
            matchedType = 1;
          }
        }

        // 2. Project Duration
        if (durationFilter && durationFilter !== "All") {
          if (role.project.duration.toLowerCase().trim() === durationFilter.toLowerCase().trim()) {
            matchedCount += 1;
            matchedDuration = 1;
          }
        }

        // 3. Experience Level
        if (expFilter && expFilter !== "All") {
          const rExp = role.requiredExperienceLevel.toLowerCase().trim();
          const fExp = expFilter.toLowerCase().trim();
          if (rExp === fExp || rExp === "any") {
            matchedCount += 1;
            matchedExp = 1;
          }
        }

        // 4. Tech Stack (Each selected tech = 1 factor)
        if (techList.length > 0) {
          const roleTechs = role.project.techStack || [];
          for (const selectedTech of techList) {
            if (roleTechs.some((t) => tagMatches(t, selectedTech))) {
              matchedCount += 1;
              matchedTechs += 1;
            }
          }
        }

        // 5. Skills (Each selected skill = 1 factor)
        if (skillList.length > 0) {
          const roleSkills = role.requiredSkills || [];
          const roleTechs = role.project.techStack || [];
          for (const selectedSkill of skillList) {
            if (
              roleSkills.some((s) => tagMatches(s, selectedSkill)) ||
              roleTechs.some((t) => tagMatches(t, selectedSkill))
            ) {
              matchedCount += 1;
              matchedSkills += 1;
            }
          }
        }

        // 6. Search Query (1 factor if provided)
        if (query) {
          const q = query.toLowerCase().trim();
          const inRoleTitle = role.title.toLowerCase().includes(q);
          const inRoleDesc = (role.description || "").toLowerCase().includes(q);
          const inProjTitle = role.project.title.toLowerCase().includes(q);
          const inProjDesc = (role.project.description || "").toLowerCase().includes(q);
          const inSkills = (role.requiredSkills || []).some((s) => s.toLowerCase().includes(q));
          const inTechs = (role.project.techStack || []).some((t) => t.toLowerCase().includes(q));

          if (inRoleTitle || inRoleDesc || inProjTitle || inProjDesc || inSkills || inTechs) {
            matchedCount += 1;
          }
        }

        const score = Math.round((matchedCount / totalFilterFactors) * 100) / 100;

        compatibility = {
          score,
          factorsMatched: matchedCount,
          totalFactors: totalFilterFactors,
          hasActiveFilters: true,
          breakdown: {
            skillOverlap: skillList.length > 0 ? Math.round((matchedSkills / skillList.length) * 100) / 100 : 0,
            techOverlap: techList.length > 0 ? Math.round((matchedTechs / techList.length) * 100) / 100 : 0,
            typeFit: matchedType,
            durationFit: matchedDuration,
            experienceFit: matchedExp,
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

    // Filter "minScore" (if user adjusted slider and filters are active)
    if (hasActiveFilters && minScoreThreshold > 0) {
      results = results.filter(
        (r) => r.compatibility && r.compatibility.score >= minScoreThreshold
      );
    }

    // Sorting: Best Match sorts highest score first when filters are active
    results.sort((a, b) => {
      if (sortBy === "match" && hasActiveFilters) {
        const sa = a.compatibility?.score ?? 0;
        const sb = b.compatibility?.score ?? 0;
        if (sb !== sa) return sb - sa;
      } else if (sortBy === "spots") {
        if (b.openSpots !== a.openSpots) return b.openSpots - a.openSpots;
      } else if (sortBy === "title") {
        return a.title.localeCompare(b.title);
      }
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
      userHasSkills: userSkills.length > 0,
      activeFilterCount: totalFilterFactors,
    });
  } catch (err) {
    console.error("GET /api/matches/roles failed:", err);
    return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 });
  }
}

