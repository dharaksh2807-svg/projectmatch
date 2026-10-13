import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Domain-specific keyword map for intelligent semantic matching
 * when role or project doesn't have exact string matches.
 */
const DOMAIN_KEYWORD_MAP: Record<string, string[]> = {
  frontend: ["react", "vue", "angular", "next.js", "nextjs", "tailwind", "css", "html", "javascript", "typescript", "ui", "ux", "web"],
  ui: ["figma", "design", "css", "tailwind", "frontend", "prototyping", "ux", "wireframing"],
  backend: ["node", "nodejs", "python", "fastapi", "express", "go", "golang", "java", "sql", "postgresql", "prisma", "mongodb", "rest", "api"],
  fullstack: ["react", "next.js", "node", "typescript", "python", "sql", "javascript", "tailwind", "prisma"],
  mobile: ["react native", "flutter", "swift", "kotlin", "ios", "android"],
  ai: ["python", "pytorch", "tensorflow", "machine learning", "llm", "langchain", "gemini", "openai", "nlp"],
  ml: ["python", "pytorch", "scikit-learn", "data science", "pandas", "numpy"],
  devops: ["docker", "kubernetes", "aws", "gcp", "ci/cd", "terraform", "linux"],
};

/**
 * Helper to compute real text token intersection for interest alignment
 */
function computeTextOverlapScore(text1: string, text2: string): number {
  if (!text1.trim() || !text2.trim()) return 0;
  const stopWords = new Set(["the", "and", "a", "an", "in", "on", "for", "with", "to", "of", "at", "by", "from", "is", "it", "or", "as"]);
  
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

  // Jaccard similarity
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

    // Fetch user profile and existing applications/bookmarks
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

    // Extract all unique techStack items
    const allUniqueTechsSet = new Set<string>();
    roles.forEach((r) => {
      r.project.techStack?.forEach((t) => allUniqueTechsSet.add(t));
    });
    const allUniqueTechs = Array.from(allUniqueTechsSet).slice(0, 20);

    // Profile status flag: does the user have enough profile data to score?
    const userHasSkills = userSkills.length > 0;
    const userNormalizedSkills = userSkills.map((s) => s.toLowerCase().trim());

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

      // ONLY compute compatibility if the user is authenticated AND has skills/profile data!
      // If user has not filled skills in their profile, we do NOT fake a score!
      if (userId && userHasSkills) {
        // ─── 1. SKILL OVERLAP (45% weight) ─────────────────────────────────
        // Target skills come from role.requiredSkills + project.techStack + role title domain
        const roleExplicitSkills = (role.requiredSkills || []).map((s) => s.toLowerCase().trim());
        const projectTech = (role.project.techStack || []).map((t) => t.toLowerCase().trim());
        
        // Find domain skills from role title (e.g. "Frontend Dev" -> React, Vue, CSS...)
        const roleTitleLower = role.title.toLowerCase();
        const domainMatches: string[] = [];
        for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORD_MAP)) {
          if (roleTitleLower.includes(domain)) {
            domainMatches.push(...keywords);
          }
        }

        let skillOverlap = 0;
        if (roleExplicitSkills.length > 0) {
          // Exact matches on explicit role requirements
          const matchedExplicit = roleExplicitSkills.filter((rs) =>
            userNormalizedSkills.some((us) => us === rs || us.includes(rs) || rs.includes(us))
          );
          skillOverlap = matchedExplicit.length / roleExplicitSkills.length;
        } else if (projectTech.length > 0) {
          // Fall back to project's declared tech stack
          const matchedTech = projectTech.filter((pt) =>
            userNormalizedSkills.some((us) => us === pt || us.includes(pt) || pt.includes(us))
          );
          skillOverlap = (matchedTech.length / projectTech.length) * 0.9;
        } else if (domainMatches.length > 0) {
          // Fall back to domain keyword alignment with role title
          const domainOverlap = domainMatches.filter((dm) =>
            userNormalizedSkills.includes(dm)
          );
          skillOverlap = domainOverlap.length > 0 ? Math.min(domainOverlap.length / 3, 0.75) : 0.05;
        } else {
          // Role has no skills specified, no project tech stack, and non-tech title
          // Low baseline — cannot claim high match when requirements are unknown
          skillOverlap = 0.1;
        }

        // ─── 2. EXPERIENCE FIT (25% weight) ────────────────────────────────
        const levels = ["Beginner", "Intermediate", "Advanced", "Expert"];
        const userLevelIdx = userExperienceLevel ? levels.indexOf(userExperienceLevel) : -1;
        const roleLevelIdx = levels.indexOf(role.requiredExperienceLevel);
        
        let experienceFit = 0.3; // unstated penalty
        if (role.requiredExperienceLevel === "Any") {
          // Any experience welcome: good baseline fit, but exact level is better
          experienceFit = userLevelIdx >= 0 ? 0.85 : 0.6;
        } else if (userLevelIdx >= 0 && roleLevelIdx >= 0) {
          const diff = Math.abs(userLevelIdx - roleLevelIdx);
          if (diff === 0) experienceFit = 1.0;
          else if (diff === 1) experienceFit = 0.65;
          else if (diff === 2) experienceFit = 0.35;
          else experienceFit = 0.1;
        }

        // ─── 3. AVAILABILITY FIT (15% weight) ──────────────────────────────
        let availabilityFit = 0.2; // default if not specified in profile
        if (userAvailability) {
          const userAv = userAvailability.toLowerCase();
          const roleTime = role.timeCommitment.toLowerCase();

          if (userAv === "flexible") {
            availabilityFit = 0.95;
          } else if (roleTime.includes(userAv) || userAv.includes(roleTime)) {
            availabilityFit = 1.0;
          } else if (userAv.includes("part-time") && roleTime.includes("10-15h")) {
            availabilityFit = 1.0;
          } else if (userAv.includes("weekends") && roleTime.includes("part-time")) {
            availabilityFit = 0.65;
          } else if (userAv.includes("full-time") && roleTime.includes("part-time")) {
            availabilityFit = 0.85;
          } else {
            availabilityFit = 0.3;
          }
        }

        // ─── 4. INTEREST ALIGNMENT (10% weight) ────────────────────────────
        // Compute real text token overlap between user's profile and the project description/title
        const userText = `${userBio} ${userSkills.join(" ")}`;
        const projectText = `${role.project.title} ${role.project.projectType} ${role.project.description}`;
        const rawOverlap = computeTextOverlapScore(userText, projectText);
        // Normalize: small overlap in free text is significant
        const interestAlignment = Math.min(Math.max(rawOverlap * 3.5, 0.05), 1.0);

        // ─── 5. REPUTATION (5% weight) ─────────────────────────────────────
        // Actual user reputation from DB (0-100) normalized to 0-1
        const reputationScore = userReputationScore > 0 ? Math.min(userReputationScore / 100, 1.0) : 0.0;

        // Weighted total
        const rawScore =
          skillOverlap * 0.45 +
          experienceFit * 0.25 +
          availabilityFit * 0.15 +
          interestAlignment * 0.10 +
          reputationScore * 0.05;

        const score = Math.round(Math.min(Math.max(rawScore, 0), 1) * 100) / 100;

        compatibility = {
          score,
          breakdown: {
            skillOverlap: Math.round(skillOverlap * 100) / 100,
            availabilityFit: Math.round(availabilityFit * 100) / 100,
            interestAlignment: Math.round(interestAlignment * 100) / 100,
            experienceFit: Math.round(experienceFit * 100) / 100,
            reputationScore: Math.round(reputationScore * 100) / 100,
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

    // Filter "minScore" (only if user has compatibility scores)
    if (userId && userHasSkills && minScoreThreshold > 0) {
      results = results.filter(
        (r) => !r.compatibility || r.compatibility.score >= minScoreThreshold
      );
    }

    // Sorting
    results.sort((a, b) => {
      if (sortBy === "match" && userId && userHasSkills) {
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
      userHasSkills,
    });
  } catch (err) {
    console.error("GET /api/matches/roles failed:", err);
    return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 });
  }
}
