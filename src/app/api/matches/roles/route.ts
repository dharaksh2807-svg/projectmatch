import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Helper to compute real text token intersection for interest alignment
 */
function computeTextOverlapScore(text1: string, text2: string): number {
  if (!text1.trim() || !text2.trim()) return 0;
  const stopWords = new Set([
    "the", "and", "a", "an", "in", "on", "for", "with", "to", "of", "at", "by", "from", "is", "it", "or", "as", "be", "this", "that"
  ]);

  const extractWords = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));

  const words1 = new Set(extractWords(text1));
  const words2 = new Set(extractWords(text2));

  if (words1.size === 0 || words2.size === 0) return 0;

  let common = 0;
  for (const w of words1) {
    if (words2.has(w)) common++;
  }

  const union = new Set([...words1, ...words2]).size;
  return union > 0 ? common / union : 0;
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
    let userExperienceLevel: string | null = null;
    let userAvailability: string | null = null;
    let userBio: string = "";
    let userReputationScore = 0;
    let appliedRoleIds: string[] = [];
    let bookmarkedRoleIds: string[] = [];

    if (userId) {
      const [user, applications, bookmarks] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: {
            skills: true,
            experienceLevel: true,
            availability: true,
            reputationScore: true,
            bio: true,
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
        userExperienceLevel = user.experienceLevel ?? null;
        userAvailability = user.availability ?? null;
        userBio = user.bio ?? "";
        userReputationScore = typeof user.reputationScore === "number" ? user.reputationScore : 0;
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

    // Multi-select skill filter using hasSome
    if (skillList.length > 0) {
      andConditions.push({
        requiredSkills: { hasSome: skillList },
      });
    }

    // Multi-select tech stack filter using hasSome
    if (techList.length > 0) {
      andConditions.push({
        project: { techStack: { hasSome: techList } },
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
          userHasSkills: userSkills.length > 0,
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

    // Extract all unique techStack items across published projects
    const allUniqueTechsSet = new Set<string>();
    roles.forEach((r) => {
      r.project.techStack?.forEach((t) => allUniqueTechsSet.add(t));
    });
    const allUniqueTechs = Array.from(allUniqueTechsSet).slice(0, 30);

    const userHasSkills = userSkills.length > 0;
    const userNormalizedSkills = userSkills.map((s) => s.toLowerCase().trim());

    // ─── Proportional Factor Matching Engine ────────────────────────────────
    // Every role has a defined set of requirements/factors:
    // 1. Each required skill (or project tech item) = 1 factor
    // 2. Experience level requirement = 1 factor
    // 3. Availability commitment = 1 factor
    // 4. Project domain & interest alignment = 1 factor
    //
    // Total Match % = (Total Matched Factors / Total Role Factors) * 100
    // - If the user has not selected anything: 0 factors matched => 0% Match.
    // - If there are 10 factors and user matches 4: 4 / 10 => 40% Match.
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
            factorsMatched?: number;
            totalFactors?: number;
          }
        | undefined = undefined;

      if (userId) {
        // Target skills list
        const targetSkills =
          role.requiredSkills.length > 0
            ? role.requiredSkills
            : (role.project.techStack.length > 0 ? role.project.techStack : []);

        const totalSkillFactors = targetSkills.length;
        let matchedSkillsCount = 0;

        if (totalSkillFactors > 0 && userSkills.length > 0) {
          matchedSkillsCount = targetSkills.filter((reqSkill) => {
            const reqNorm = reqSkill.toLowerCase().trim();
            return userNormalizedSkills.some(
              (uNorm) =>
                uNorm === reqNorm ||
                uNorm.includes(reqNorm) ||
                reqNorm.includes(uNorm)
            );
          }).length;
        }

        // Experience Level Factor (1 factor)
        const totalExpFactors = 1;
        let matchedExpCount = 0;
        if (userExperienceLevel) {
          if (role.requiredExperienceLevel === "Any") {
            // Role welcomes any experience and user provided a level
            matchedExpCount = 1;
          } else if (
            userExperienceLevel.toLowerCase() ===
            role.requiredExperienceLevel.toLowerCase()
          ) {
            matchedExpCount = 1;
          } else {
            const levels = ["beginner", "intermediate", "advanced", "expert"];
            const uIdx = levels.indexOf(userExperienceLevel.toLowerCase());
            const rIdx = levels.indexOf(role.requiredExperienceLevel.toLowerCase());
            if (uIdx >= 0 && rIdx >= 0 && Math.abs(uIdx - rIdx) === 1) {
              matchedExpCount = 0.5; // close match partial credit
            }
          }
        }

        // Availability Factor (1 factor)
        const totalAvailFactors = 1;
        let matchedAvailCount = 0;
        if (userAvailability && role.timeCommitment) {
          const uAv = userAvailability.toLowerCase();
          const rTime = role.timeCommitment.toLowerCase();
          if (uAv === "flexible") {
            matchedAvailCount = 1;
          } else if (rTime.includes(uAv) || uAv.includes(rTime)) {
            matchedAvailCount = 1;
          } else if (uAv.includes("part-time") && rTime.includes("10-15h")) {
            matchedAvailCount = 1;
          } else if (uAv.includes("full-time") && rTime.includes("part-time")) {
            matchedAvailCount = 1;
          }
        }

        // Domain / Project Interest Factor (1 factor)
        const totalDomainFactors = 1;
        let matchedDomainCount = 0;
        if (userBio || userSkills.length > 0) {
          const userText = `${userBio} ${userSkills.join(" ")}`;
          const projectText = `${role.project.title} ${role.project.projectType} ${role.project.description}`;
          const overlap = computeTextOverlapScore(userText, projectText);
          if (overlap >= 0.05) {
            matchedDomainCount = 1;
          }
        }

        // Proportional total calculation
        const totalFactors =
          totalSkillFactors + totalExpFactors + totalAvailFactors + totalDomainFactors;
        const matchedFactors =
          matchedSkillsCount + matchedExpCount + matchedAvailCount + matchedDomainCount;

        // If user has not selected anything (0 skills, no exp, no avail), score is exactly 0%
        const score =
          totalFactors > 0
            ? Math.round((matchedFactors / totalFactors) * 100) / 100
            : 0;

        compatibility = {
          score,
          breakdown: {
            skillOverlap:
              totalSkillFactors > 0
                ? Math.round((matchedSkillsCount / totalSkillFactors) * 100) / 100
                : 0,
            availabilityFit: matchedAvailCount >= 1 ? 1 : matchedAvailCount,
            interestAlignment: matchedDomainCount,
            experienceFit: matchedExpCount >= 1 ? 1 : matchedExpCount,
            reputationScore: userReputationScore > 0 ? Math.min(userReputationScore / 100, 1) : 0,
          },
          factorsMatched: Math.round(matchedFactors * 10) / 10,
          totalFactors,
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
      userHasSkills,
    });
  } catch (err) {
    console.error("GET /api/matches/roles failed:", err);
    return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 });
  }
}
