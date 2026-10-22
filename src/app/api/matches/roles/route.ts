import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  tagMatches,
  matchesTagList,
  matchesRoleCategory,
  STANDARD_SKILLS,
} from "@/lib/filters/normalize";
import { getDiscoverableTechCatalog } from "@/lib/filters/tech-catalog-server";

/**
 * GET /api/matches/roles
 * 
 * Advanced hackathon & project role discovery endpoint with:
 * - Multi-criteria filtering (Tech, Skills, Hackathon, Team/Recruitment, Compatibility)
 * - ANY vs ALL matching semantics for technologies and skills
 * - Alias normalization (e.g. nextjs -> Next.js)
 * - Transparent requirement-coverage scoring
 * - Stable cursor pagination & sorting
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;

    // Fetch user profile and applications/bookmarks if authenticated
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

    // ─── Query Parameters ───────────────────────────────────────────────────
    const query = searchParams.get("q")?.trim();
    const typeFilter = searchParams.get("type"); // Project type (Hackathon, Startup, etc.)
    const durationFilter = searchParams.get("duration"); // Duration (< 1 week, 1-4 weeks, etc.)
    const expFilter = searchParams.get("exp"); // Experience level (Beginner, Intermediate, etc.)
    const roleCategory = searchParams.get("role") || searchParams.get("roleCategory"); // Role category
    const beginnerFriendly = searchParams.get("beginnerFriendly") === "true";

    // Multi-select technologies & skills
    const rawTechs = searchParams.getAll("tech");
    const techList = rawTechs
      .flatMap((t) => t.split(","))
      .map((t) => t.trim())
      .filter(Boolean);
    const techMode = (searchParams.get("techMode")?.toLowerCase() === "all" ? "all" : "any") as "any" | "all";

    const rawSkills = searchParams.getAll("skill");
    const skillList = rawSkills
      .flatMap((s) => s.split(","))
      .map((s) => s.trim())
      .filter(Boolean);
    const skillMode = (searchParams.get("skillMode")?.toLowerCase() === "all" ? "all" : "any") as "any" | "all";

    // Hackathon filters
    const hackathonId = searchParams.get("hackathonId");
    const hackathonMode = searchParams.get("mode") || searchParams.get("participationMode"); // ONLINE | OFFLINE | HYBRID
    const hackathonTrack = searchParams.get("track") || searchParams.get("domain");
    const openRegOnly = searchParams.get("openRegOnly") === "true";
    const collegeSlug = searchParams.get("college") || searchParams.get("collegeSlug");

    // Recruitment filters
    const openOnly = searchParams.get("openOnly") === "true";
    const minSpots = parseInt(searchParams.get("minSpots") || "0", 10);
    const commitment = searchParams.get("commitment"); // Part-time, Full-time, Flexible
    const hideApplied = searchParams.get("hideApplied") === "true";
    const bookmarkedOnly = searchParams.get("bookmarkedOnly") === "true";

    // Scoring & Pagination
    const minScoreParam = searchParams.get("minScore");
    const minScoreThreshold = minScoreParam ? parseInt(minScoreParam, 10) / 100 : 0;
    const sortBy = searchParams.get("sort") || "match";
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "12", 10), 1), 50);
    const cursor = searchParams.get("cursor");

    // Calculate active filter count
    let activeFilterCount = 0;
    if (query) activeFilterCount += 1;
    if (typeFilter && typeFilter !== "All") activeFilterCount += 1;
    if (durationFilter && durationFilter !== "All") activeFilterCount += 1;
    if (expFilter && expFilter !== "All") activeFilterCount += 1;
    if (roleCategory && roleCategory !== "All") activeFilterCount += 1;
    if (beginnerFriendly) activeFilterCount += 1;
    if (techList.length > 0) activeFilterCount += techList.length;
    if (skillList.length > 0) activeFilterCount += skillList.length;
    if (hackathonId && hackathonId !== "All") activeFilterCount += 1;
    if (hackathonMode && hackathonMode !== "ALL") activeFilterCount += 1;
    if (hackathonTrack && hackathonTrack !== "All") activeFilterCount += 1;
    if (openRegOnly) activeFilterCount += 1;
    if (collegeSlug && collegeSlug !== "ALL") activeFilterCount += 1;
    if (openOnly) activeFilterCount += 1;
    if (minSpots > 0) activeFilterCount += 1;
    if (commitment && commitment !== "All") activeFilterCount += 1;
    if (hideApplied) activeFilterCount += 1;
    if (bookmarkedOnly) activeFilterCount += 1;
    if (minScoreThreshold > 0) activeFilterCount += 1;

    const hasActiveFilters = activeFilterCount > 0;

    // ─── Build Prisma Query ─────────────────────────────────────────────────
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
          techCounts: {},
          popularTechs: [],
          techCategories: {},
          allUniqueSkills: STANDARD_SKILLS,
          availableHackathons: [],
          userHasSkills: userSkills.length > 0,
          activeFilterCount,
        });
      }
      andConditions.push({
        id: { in: bookmarkedRoleIds },
      });
    }

    // Direct relational filter on project type if specified
    if (typeFilter && typeFilter !== "All") {
      andConditions.push({
        project: {
          projectType: {
            equals: typeFilter,
            mode: "insensitive",
          },
        },
      });
    }

    // Direct relational filter on hackathon if specified
    if (hackathonId && hackathonId !== "All") {
      andConditions.push({
        project: {
          hackathonId,
        },
      });
    }

    // Query roles and available hackathons in parallel
    const [roles, availableHackathonsRaw] = await Promise.all([
      prisma.role.findMany({
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
              hackathonId: true,
              hackathon: {
                select: {
                  id: true,
                  name: true,
                  participationMode: true,
                  status: true,
                  registrationStatus: true,
                  city: true,
                  collegeName: true,
                  collegeSlug: true,
                  eligibilityScope: true,
                  tags: true,
                  themes: true,
                  startDate: true,
                  endDate: true,
                  registrationDeadline: true,
                },
              },
              owner: {
                select: {
                  name: true,
                  image: true,
                  reputationScore: true,
                  timezone: true,
                  city: true,
                  collegeName: true,
                  collegeSlug: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.hackathon.findMany({
        select: {
          id: true,
          name: true,
          participationMode: true,
          city: true,
          status: true,
          registrationStatus: true,
        },
        take: 40,
        orderBy: { name: "asc" },
      }),
    ]);

    // Format available hackathons list for filter dropdown
    const availableHackathons = availableHackathonsRaw.map((h) => ({
      id: h.id,
      name: h.name,
      mode: h.participationMode,
      city: h.city,
      status: h.status,
      registrationStatus: h.registrationStatus,
    }));

    // Dynamically retrieve the complete technology catalog across ALL discoverable projects
    const techCatalog = await getDiscoverableTechCatalog(prisma);
    const allUniqueTechs = techCatalog.allTechnologies;
    const techCounts = techCatalog.techCounts;
    const popularTechs = techCatalog.popularTechs;
    const techCategories = techCatalog.categories;

    // Extract all unique skills across published projects and standard taxonomy
    const allUniqueSkillsSet = new Set<string>(STANDARD_SKILLS);
    roles.forEach((r) => {
      r.requiredSkills?.forEach((s) => {
        const trimmed = s.trim();
        if (trimmed) allUniqueSkillsSet.add(trimmed);
      });
    });
    const allUniqueSkills = Array.from(allUniqueSkillsSet).slice(0, 50);

    // ─── Filter Evaluation & Compatibility Scoring ──────────────────────────
    const candidateSkillsPool = new Set<string>();
    techList.forEach((t) => candidateSkillsPool.add(t));
    skillList.forEach((s) => candidateSkillsPool.add(s));
    const candidateSkills = Array.from(candidateSkillsPool);
    const hasSkillFilters = candidateSkills.length > 0;

    const filtered = roles.filter((role) => {
      const openSpots = Math.max(role.headcount - role.filledCount, 0);

      // 1. Open spots filter
      if (openOnly && openSpots <= 0) return false;
      if (minSpots > 0 && openSpots < minSpots) return false;

      // 2. Duration filter
      if (durationFilter && durationFilter !== "All") {
        if (role.project.duration.toLowerCase().trim() !== durationFilter.toLowerCase().trim()) {
          return false;
        }
      }

      // 3. Experience level & Beginner-friendly filter
      if (beginnerFriendly) {
        const lvl = role.requiredExperienceLevel.toLowerCase().trim();
        if (lvl !== "beginner" && lvl !== "any") return false;
      } else if (expFilter && expFilter !== "All") {
        const rExp = role.requiredExperienceLevel.toLowerCase().trim();
        const fExp = expFilter.toLowerCase().trim();
        if (rExp !== fExp && rExp !== "any") return false;
      }

      // 4. Role category filter
      if (roleCategory && roleCategory !== "All") {
        if (!matchesRoleCategory(role.title, role.description, role.requiredSkills, roleCategory)) {
          return false;
        }
      }

      // 5. Time commitment filter
      if (commitment && commitment !== "All") {
        const roleComm = (role.timeCommitment || "").toLowerCase();
        if (!roleComm.includes(commitment.toLowerCase())) return false;
      }

      // 6. Technology multi-select filter (ANY vs ALL)
      if (techList.length > 0) {
        const combinedProjectTechs = [
          ...(role.project.techStack || []),
          ...(role.requiredSkills || []),
        ];
        if (!matchesTagList(techList, combinedProjectTechs, techMode)) {
          return false;
        }
      }

      // 7. Skills multi-select filter (ANY vs ALL)
      if (skillList.length > 0) {
        const targetSkills =
          role.requiredSkills.length > 0
            ? role.requiredSkills
            : role.project.techStack || [];
        if (!matchesTagList(skillList, targetSkills, skillMode)) {
          return false;
        }
      }

      // 8. Hackathon-specific filters
      if (hackathonMode && hackathonMode !== "ALL") {
        const pMode = role.project.hackathon?.participationMode;
        if (pMode !== hackathonMode) return false;
      }

      if (hackathonTrack && hackathonTrack !== "All") {
        const hTags = role.project.hackathon?.tags || [];
        const hThemes = role.project.hackathon?.themes || [];
        const pTechs = role.project.techStack || [];
        const combinedTracks = [...hTags, ...hThemes, ...pTechs];
        const hasTrack = combinedTracks.some((t) => tagMatches(t, hackathonTrack));
        if (!hasTrack) return false;
      }

      if (openRegOnly) {
        const regStatus = role.project.hackathon?.registrationStatus;
        if (regStatus !== "OPEN") return false;
      }

      if (collegeSlug && collegeSlug !== "ALL") {
        const hCollege = role.project.hackathon?.collegeSlug;
        const oCollege = role.project.owner?.collegeSlug;
        if (hCollege !== collegeSlug && oCollege !== collegeSlug) return false;
      }

      // 9. Free-text Search Query
      if (query) {
        const q = query.toLowerCase();
        const inRoleTitle = role.title.toLowerCase().includes(q);
        const inRoleDesc = (role.description || "").toLowerCase().includes(q);
        const inProjTitle = role.project.title.toLowerCase().includes(q);
        const inProjDesc = (role.project.description || "").toLowerCase().includes(q);
        const inSkills = (role.requiredSkills || []).some((s) => s.toLowerCase().includes(q));
        const inTechs = (role.project.techStack || []).some((t) => t.toLowerCase().includes(q));
        const inHackathon = (role.project.hackathon?.name || "").toLowerCase().includes(q);

        if (!inRoleTitle && !inRoleDesc && !inProjTitle && !inProjDesc && !inSkills && !inTechs && !inHackathon) {
          return false;
        }
      }

      return true;
    });

    // ─── Score Computation for Filtered Roles ───────────────────────────────
    let results = filtered.map((role) => {
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

      if (hasActiveFilters || userSkills.length > 0) {
        // Comparison pool: active candidate skills or user's profile skills
        const activePool = hasSkillFilters ? candidateSkills : userSkills;
        const targetSkills =
          role.requiredSkills.length > 0
            ? role.requiredSkills
            : role.project.techStack.length > 0
            ? role.project.techStack
            : [];

        let matchedSkillsCount = 0;
        if (targetSkills.length > 0 && activePool.length > 0) {
          for (const reqSkill of targetSkills) {
            const hasMatch = activePool.some((cSkill) => tagMatches(cSkill, reqSkill));
            if (hasMatch) matchedSkillsCount += 1;
          }
        }

        const skillOverlapRatio =
          targetSkills.length > 0 ? matchedSkillsCount / targetSkills.length : 0.5;

        // Non-skill factors
        let nonSkillRequirements = 0;
        let nonSkillMatches = 0;

        let typeFit = 0;
        if (typeFilter && typeFilter !== "All") {
          nonSkillRequirements += 1;
          if (role.project.projectType.toLowerCase() === typeFilter.toLowerCase()) {
            typeFit = 1;
            nonSkillMatches += 1;
          }
        }

        let durationFit = 0;
        if (durationFilter && durationFilter !== "All") {
          nonSkillRequirements += 1;
          if (role.project.duration.toLowerCase() === durationFilter.toLowerCase()) {
            durationFit = 1;
            nonSkillMatches += 1;
          }
        }

        let experienceFit = 0;
        if (expFilter && expFilter !== "All") {
          nonSkillRequirements += 1;
          const rExp = role.requiredExperienceLevel.toLowerCase();
          const fExp = expFilter.toLowerCase();
          if (rExp === fExp || rExp === "any") {
            experienceFit = 1;
            nonSkillMatches += 1;
          }
        }

        const totalFactors = targetSkills.length + nonSkillRequirements;
        const totalMatches = matchedSkillsCount + nonSkillMatches;

        const score =
          totalFactors > 0 ? Math.round((totalMatches / totalFactors) * 100) / 100 : 0.5;

        compatibility = {
          score,
          factorsMatched: totalMatches,
          totalFactors: totalFactors || 1,
          hasActiveFilters: true,
          breakdown: {
            skillOverlap: Math.round(skillOverlapRatio * 100) / 100,
            techOverlap: 0,
            typeFit,
            durationFit,
            experienceFit,
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

    // Enforce minScore threshold if requested
    if (minScoreThreshold > 0) {
      results = results.filter(
        (r) => r.compatibility && r.compatibility.score >= minScoreThreshold
      );
    }

    // ─── Sorting ─────────────────────────────────────────────────────────────
    results.sort((a, b) => {
      if (sortBy === "match" && (hasActiveFilters || userSkills.length > 0)) {
        const sa = a.compatibility?.score ?? 0;
        const sb = b.compatibility?.score ?? 0;
        if (sb !== sa) return sb - sa;

        // Tie-breaker: open spots
        if (b.openSpots !== a.openSpots) return b.openSpots - a.openSpots;
      } else if (sortBy === "spots") {
        if (b.openSpots !== a.openSpots) return b.openSpots - a.openSpots;
      } else if (sortBy === "title") {
        return a.title.localeCompare(b.title);
      } else if (sortBy === "deadline") {
        const da = a.project.hackathon?.registrationDeadline ? new Date(a.project.hackathon.registrationDeadline).getTime() : Infinity;
        const db = b.project.hackathon?.registrationDeadline ? new Date(b.project.hackathon.registrationDeadline).getTime() : Infinity;
        if (da !== db) return da - db;
      }
      // Default: newest first
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const totalAvailable = results.length;

    // ─── Cursor Pagination ──────────────────────────────────────────────────
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
      techCounts,
      popularTechs,
      techCategories,
      allUniqueSkills,
      availableHackathons,
      userHasSkills: userSkills.length > 0,
      activeFilterCount,
    });
  } catch (err) {
    console.error("GET /api/matches/roles failed:", err);
    return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 });
  }
}
