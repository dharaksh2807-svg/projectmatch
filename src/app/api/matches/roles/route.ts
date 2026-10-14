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

    // ─── Candidate Skills Pool ──────────────────────────────────────────────
    // Combine active sidebar filter selections (Tech Stack & Skills) with saved profile skills
    const candidateSkillsSet = new Set<string>();
    userSkills.forEach((s) => {
      if (s.trim()) candidateSkillsSet.add(s.trim());
    });
    techList.forEach((t) => {
      if (t.trim()) candidateSkillsSet.add(t.trim());
    });
    skillList.forEach((s) => {
      if (s.trim()) candidateSkillsSet.add(s.trim());
    });
    const candidateSkills = Array.from(candidateSkillsSet);

    // Active sidebar filters count (to know if filters are actively set)
    let activeFilterCount = 0;
    if (typeFilter && typeFilter !== "All") activeFilterCount += 1;
    if (durationFilter && durationFilter !== "All") activeFilterCount += 1;
    if (expFilter && expFilter !== "All") activeFilterCount += 1;
    if (techList.length > 0) activeFilterCount += techList.length;
    if (skillList.length > 0) activeFilterCount += skillList.length;
    if (query) activeFilterCount += 1;

    const hasActiveFilters = activeFilterCount > 0;

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

    // ─── Role Requirements Coverage Matching Engine ─────────────────────────
    // Denominator is the role's requirements (what the lead requires):
    // - Each required skill specified for the role = 1 factor
    // - Non-skill filters (Type, Duration, Experience level, Query) add 1 factor
    //   each to the role's requirements when selected by the user.
    // If the lead requires 4 skills and the candidate only has 2 of them:
    //   Score = 2 / 4 = 50% Match (NOT 100%!).
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
        // 1. Required Skills (What the lead requires)
        const targetSkills =
          role.requiredSkills.length > 0
            ? role.requiredSkills
            : (role.project.techStack.length > 0 ? role.project.techStack : []);

        const totalRoleSkills = targetSkills.length;
        let matchedSkillsCount = 0;

        if (totalRoleSkills > 0 && candidateSkills.length > 0) {
          for (const reqSkill of targetSkills) {
            const hasMatch = candidateSkills.some((candSkill) =>
              tagMatches(candSkill, reqSkill)
            );
            if (hasMatch) {
              matchedSkillsCount += 1;
            }
          }
        }

        // 2. Non-skill requirements selected in sidebar
        let nonSkillRequirementsCount = 0;
        let nonSkillMatchedCount = 0;
        let matchedType = 0;
        let matchedDuration = 0;
        let matchedExp = 0;

        if (typeFilter && typeFilter !== "All") {
          nonSkillRequirementsCount += 1;
          if (role.project.projectType.toLowerCase().trim() === typeFilter.toLowerCase().trim()) {
            nonSkillMatchedCount += 1;
            matchedType = 1;
          }
        }

        if (durationFilter && durationFilter !== "All") {
          nonSkillRequirementsCount += 1;
          if (role.project.duration.toLowerCase().trim() === durationFilter.toLowerCase().trim()) {
            nonSkillMatchedCount += 1;
            matchedDuration = 1;
          }
        }

        if (expFilter && expFilter !== "All") {
          nonSkillRequirementsCount += 1;
          const rExp = role.requiredExperienceLevel.toLowerCase().trim();
          const fExp = expFilter.toLowerCase().trim();
          if (rExp === fExp || rExp === "any") {
            nonSkillMatchedCount += 1;
            matchedExp = 1;
          }
        }

        if (query) {
          nonSkillRequirementsCount += 1;
          const q = query.toLowerCase().trim();
          const inRoleTitle = role.title.toLowerCase().includes(q);
          const inRoleDesc = (role.description || "").toLowerCase().includes(q);
          const inProjTitle = role.project.title.toLowerCase().includes(q);
          const inProjDesc = (role.project.description || "").toLowerCase().includes(q);
          const inSkills = (role.requiredSkills || []).some((s) => s.toLowerCase().includes(q));
          const inTechs = (role.project.techStack || []).some((t) => t.toLowerCase().includes(q));

          if (inRoleTitle || inRoleDesc || inProjTitle || inProjDesc || inSkills || inTechs) {
            nonSkillMatchedCount += 1;
          }
        }

        // Denominator is the role's requirements
        const totalRoleRequirements = totalRoleSkills + nonSkillRequirementsCount;
        const totalMatchedRequirements = matchedSkillsCount + nonSkillMatchedCount;

        const score =
          totalRoleRequirements > 0
            ? Math.round((totalMatchedRequirements / totalRoleRequirements) * 100) / 100
            : 0;

        compatibility = {
          score,
          factorsMatched: totalMatchedRequirements,
          totalFactors: totalRoleRequirements,
          hasActiveFilters: true,
          breakdown: {
            skillOverlap: totalRoleSkills > 0 ? Math.round((matchedSkillsCount / totalRoleSkills) * 100) / 100 : 0,
            techOverlap: 0,
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
      activeFilterCount,
    });
  } catch (err) {
    console.error("GET /api/matches/roles failed:", err);
    return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 });
  }
}

