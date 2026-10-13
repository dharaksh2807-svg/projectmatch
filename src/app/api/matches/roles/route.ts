import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/matches/roles
 *
 * Returns open roles from published projects.
 * For authenticated users: attaches a compatibility score based on profile.
 * For guests: returns a plain role list (no scores).
 *
 * Query params:
 *   type     — project type (e.g. "Hackathon")
 *   duration — project duration (e.g. "1-3 months")
 *   exp      — required experience level (e.g. "Intermediate")
 *   skill    — a single required skill (exact match)
 *   q        — free-text keyword search across role/project title+description
 *   minScore — (0–90) minimum compatibility percentage; only applied for authed users
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;

    // Fetch user's profile if logged in
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

    const searchParams = req.nextUrl.searchParams;
    const typeFilter = searchParams.get("type");
    const durationFilter = searchParams.get("duration");
    // "exp" filter: "All" means no filter; actual experience level values are
    // "Beginner" | "Intermediate" | "Advanced" | "Expert" | "Any"
    // "Any" from the FILTER means the user wants roles that require ANY level.
    // We carefully distinguish below.
    const expFilter = searchParams.get("exp");
    const skillFilter = searchParams.get("skill");
    const query = searchParams.get("q")?.trim();
    const minScoreParam = searchParams.get("minScore");
    const minScoreThreshold = minScoreParam ? parseInt(minScoreParam, 10) / 100 : 0;

    // ─── Build WHERE clause ─────────────────────────────────────────────────
    // We compose the top-level AND conditions manually so we can safely combine
    // project-relation filters with an OR block without Prisma conflicts.
    const andConditions: object[] = [
      { isOpen: true },
      { project: { isPublished: true } },
    ];

    // Project type
    if (typeFilter && typeFilter !== "All") {
      andConditions.push({
        project: { projectType: { equals: typeFilter, mode: "insensitive" } },
      });
    }

    // Project duration
    if (durationFilter && durationFilter !== "All") {
      andConditions.push({
        project: { duration: { equals: durationFilter, mode: "insensitive" } },
      });
    }

    // Experience level
    // "All" from the UI = no filter (show every level)
    // Any other value (including the literal "Any") = filter the DB column
    if (expFilter && expFilter !== "All") {
      andConditions.push({
        requiredExperienceLevel: { equals: expFilter, mode: "insensitive" },
      });
    }

    // Skill filter (exact, case-sensitive array containment — Postgres @> operator)
    if (skillFilter && skillFilter.trim()) {
      andConditions.push({
        requiredSkills: { has: skillFilter.trim() },
      });
    }

    // Free-text keyword search
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
            ownerId: true,
            owner: {
              select: { name: true, image: true, reputationScore: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      // Guard against returning massive payloads on an unfiltered public browse
      take: 200,
    });

    // ─── Compatibility scoring (authenticated users only) ───────────────────
    const results = roles.map((role) => {
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
        // Skill overlap: ratio of role skills that the user has
        const roleSkills = role.requiredSkills;
        const matchingSkills = roleSkills.filter((s) =>
          userSkills.some((us) => us.toLowerCase() === s.toLowerCase())
        );
        const skillOverlap =
          roleSkills.length > 0
            ? matchingSkills.length / roleSkills.length
            : 0.5; // no required skills → neutral

        // Experience fit
        const levels = ["Beginner", "Intermediate", "Advanced", "Expert"];
        const userLevelIdx = levels.indexOf(userExperienceLevel ?? "");
        const roleLevelIdx = levels.indexOf(role.requiredExperienceLevel);
        let experienceFit = 0.5;
        if (role.requiredExperienceLevel === "Any") {
          experienceFit = 1.0; // role accepts everyone
        } else if (userLevelIdx >= 0 && roleLevelIdx >= 0) {
          const diff = Math.abs(userLevelIdx - roleLevelIdx);
          experienceFit = diff === 0 ? 1.0 : diff === 1 ? 0.7 : 0.3;
        }

        // Availability fit: loose string containment
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

        // Interest alignment: proxy via skill overlap
        const interestAlignment = skillOverlap > 0 ? 0.75 : 0.5;

        // Reputation factor (production: use actual review data)
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

    // ─── Apply minimum score filter (server-side for authenticated users) ───
    const filtered =
      userId && minScoreThreshold > 0
        ? results.filter(
            (r) => !r.compatibility || r.compatibility.score >= minScoreThreshold
          )
        : results;

    // ─── Sort: highest compatibility first for authed users ─────────────────
    if (userId) {
      filtered.sort((a, b) => {
        const sa = a.compatibility?.score ?? 0;
        const sb = b.compatibility?.score ?? 0;
        return sb - sa;
      });
    }

    return NextResponse.json({ results: filtered });
  } catch (err) {
    console.error("GET /api/matches/roles failed:", err);
    return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 });
  }
}
