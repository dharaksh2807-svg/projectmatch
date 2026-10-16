import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  VerificationStatus,
  ParticipationMode,
  EligibilityScope,
  Prisma,
} from "@prisma/client";
import { classifyForDiscovery } from "@/lib/hackathons/utils/status";
import { loadWeights, parseWeightsOverride } from "@/lib/hackathons/ranking/weights";
import { buildDiscoverySections } from "@/lib/hackathons/ranking/sections";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type EligibilityFilter = "ALL" | EligibilityScope;
type SortByOption = "ranked" | "deadline" | "startDate" | "prize";

/**
 * Safely merges multiple OR condition arrays into a Prisma AND of ORs.
 *
 * Prisma does not allow multiple top-level `OR` keys on the same where object.
 * When we have N independent OR groups (e.g. college filter, tag filter, search
 * filter), each must be wrapped as { OR: [...] } and combined under AND so that
 * all groups must be satisfied simultaneously.
 *
 * Example:
 *   mergeOrGroups(where, [collegeOr, tagOr, searchOr])
 *   → where.AND = [{ OR: collegeOr }, { OR: tagOr }, { OR: searchOr }]
 */
function mergeOrGroups(
  where: Prisma.HackathonWhereInput,
  orGroups: Prisma.HackathonWhereInput[][]
): void {
  const nonEmpty = orGroups.filter((g) => g.length > 0);
  if (nonEmpty.length === 0) return;

  if (nonEmpty.length === 1) {
    // Single OR group — attach directly
    where.OR = nonEmpty[0];
    return;
  }

  // Multiple OR groups — each becomes an AND member
  const existingAnd = Array.isArray(where.AND)
    ? (where.AND as Prisma.HackathonWhereInput[])
    : where.AND
    ? [where.AND as Prisma.HackathonWhereInput]
    : [];

  where.AND = [
    ...existingAnd,
    ...nonEmpty.map((g) => ({ OR: g } as Prisma.HackathonWhereInput)),
  ];
  delete where.OR;
}

/**
 * GET /api/hackathons/ranked
 *
 * Returns four Phase 6 discovery sections plus a local campus section:
 *   - featured      — Verified national competitions with open registration
 *   - closingSoon   — Open registration deadline within 72 hours
 *   - localCampus   — Community-submitted hackathons matching college/city filter
 *   - upcoming      — Active opportunities sorted by rank score
 *   - other         — Verified events with closed/upcoming registration
 *
 * Query parameters:
 *   weights      — base64-encoded RankingWeights JSON override (non-prod only)
 *   search       — full-text search across name, description, organizer, city
 *   mode         — ALL | ONLINE | OFFLINE | HYBRID
 *   college      — collegeSlug exact match OR collegeName contains (e.g. "srm-ist")
 *   city         — city name, case-insensitive exact match (e.g. "Chennai")
 *   eligibility  — ALL | OPEN_TO_ALL | ANY_COLLEGE_STUDENT | HOST_COLLEGE_ONLY
 *   openRegOnly  — "true" → only events whose registrationDeadline >= now
 *   sortBy       — ranked (default) | deadline | startDate | prize
 *   sourceId     — filter by ingestion source slug
 *   nationalOnly — "true" → restrict to national events
 *   tag          — filter by tag/theme
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const now = new Date();

    // ── Weights ───────────────────────────────────────────────────────────────
    const weightsOverride = parseWeightsOverride(searchParams.get("weights"));
    const weights = weightsOverride ?? loadWeights();

    // ── Parse filters ─────────────────────────────────────────────────────────
    const search = searchParams.get("search")?.trim() ?? null;
    const mode = searchParams.get("mode")?.toUpperCase() ?? "ALL";
    const college = searchParams.get("college")?.trim() ?? null;
    const city = searchParams.get("city")?.trim() ?? null;
    const eligibility = (searchParams.get("eligibility")?.toUpperCase() ?? "ALL") as EligibilityFilter;
    const openRegOnly = searchParams.get("openRegOnly") === "true";
    const sortBy = (searchParams.get("sortBy") ?? "ranked") as SortByOption;
    const sourceId = searchParams.get("sourceId") ?? null;
    const nationalOnly = searchParams.get("nationalOnly") === "true";
    const tag = searchParams.get("tag") ?? null;

    // ── Build type-safe Prisma where clause ───────────────────────────────────
    const where: Prisma.HackathonWhereInput = {
      // Always exclude REJECTED records
      verificationStatus: { not: VerificationStatus.REJECTED },
      // Exclude explicitly cancelled events — they are never actionable
      NOT: { status: "CANCELLED" },
      // Only surface upcoming or ongoing events in the discovery feed
      status: { in: ["UPCOMING", "ONGOING"] },
    };

    // 1. National-only guard
    if (nationalOnly) {
      where.isNational = true;
    }

    // 2. Participation mode filter
    if (mode && mode !== "ALL" && ["ONLINE", "OFFLINE", "HYBRID"].includes(mode)) {
      where.participationMode = mode as ParticipationMode;
    }

    // 3. Eligibility scope filter
    if (eligibility && eligibility !== "ALL") {
      where.eligibilityScope = eligibility as EligibilityScope;
    }

    // 4. Open registration guard — require deadline is still in the future
    if (openRegOnly) {
      where.registrationDeadline = { gte: now };
    }

    // 5. Source filter
    if (sourceId) {
      where.sourceId = sourceId;
    }

    // ── Collect independent OR-groups to merge safely ─────────────────────────
    const orGroups: Prisma.HackathonWhereInput[][] = [];

    // 6. College filter (slug exact + name contains)
    if (college && college !== "ALL") {
      orGroups.push([
        { collegeSlug: { equals: college.toLowerCase() } },
        { collegeName: { contains: college, mode: "insensitive" } },
      ]);
    }

    // 7. City filter — exact case-insensitive match
    if (city && city !== "ALL") {
      where.city = { equals: city, mode: "insensitive" };
    }

    // 8. Tag filter
    if (tag) {
      orGroups.push([
        { tags: { has: tag } },
        { themes: { has: tag } },
      ]);
    }

    // 9. Full-text search across multiple fields
    if (search && search.length > 0) {
      orGroups.push([
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { organizerName: { contains: search, mode: "insensitive" } },
        { organizerClubName: { contains: search, mode: "insensitive" } },
        { collegeName: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
        { country: { contains: search, mode: "insensitive" } },
      ]);
    }

    // Merge all OR-groups safely into the where clause
    mergeOrGroups(where, orGroups);

    // ── Determine DB-level sort for non-ranked modes ──────────────────────────
    // For ranked, we fetch all candidates and re-sort after scoring.
    // For other sortBy values we can also rely on the ranking post-sort,
    // but we set a sensible pre-sort to keep the result stable.
    const dbOrderBy: Prisma.HackathonOrderByWithRelationInput[] =
      sortBy === "deadline"
        ? [{ registrationDeadline: "asc" }, { startDate: "asc" }]
        : sortBy === "startDate"
        ? [{ startDate: "asc" }, { createdAt: "desc" }]
        : sortBy === "prize"
        ? [{ prizeAmount: "desc" }, { startDate: "asc" }]
        : [{ startDate: "asc" }, { createdAt: "desc" }]; // ranked — post-sort handles final order

    // ── Fetch candidates ──────────────────────────────────────────────────────
    const hackathons = await prisma.hackathon.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        location: true,
        city: true,
        state: true,
        country: true,
        countryCode: true,
        collegeName: true,
        collegeSlug: true,
        campusName: true,
        venueAddress: true,
        websiteUrl: true,
        devpostUrl: true,
        bannerUrl: true,
        registrationUrl: true,
        startDate: true,
        endDate: true,
        registrationDeadline: true,
        registrationStartDate: true,
        timezone: true,
        status: true,
        registrationStatus: true,
        verificationStatus: true,
        isNational: true,
        isCommunitySubmitted: true,
        stream: true,
        eligibilityScope: true,
        organizerName: true,
        organizerCredibility: true,
        organizerClubName: true,
        organizerContact: true,
        organizerType: true,
        themes: true,
        tags: true,
        prizeAmount: true,
        prizeCurrency: true,
        registrationFee: true,
        participationMode: true,
        minTeamSize: true,
        maxTeamSize: true,
        eligibilityRequirements: true,
        sourceId: true,
        lastSyncAt: true,
        createdAt: true,
        uploadedByUserId: true,
        _count: { select: { projects: true } },
      },
      orderBy: dbOrderBy,
    });

    // ── Phase 5 runtime classification ────────────────────────────────────────
    const actionable = hackathons
      .map((h) => {
        const cls = classifyForDiscovery(h, now);
        return {
          ...h,
          computedStatus: cls.computedStatus,
          computedRegistrationStatus: cls.computedRegistrationStatus,
          _discoveryView: cls.view,
        };
      })
      .filter((h) => !["EXCLUDED", "PAST", "CANCELLED"].includes(h._discoveryView));

    // ── Apply post-scoring sort overrides ─────────────────────────────────────
    if (sortBy !== "ranked") {
      actionable.sort((a, b) => {
        if (sortBy === "deadline") {
          const da = a.registrationDeadline ? a.registrationDeadline.getTime() : Infinity;
          const db = b.registrationDeadline ? b.registrationDeadline.getTime() : Infinity;
          return da - db;
        }
        if (sortBy === "startDate") {
          const da = a.startDate ? a.startDate.getTime() : Infinity;
          const db = b.startDate ? b.startDate.getTime() : Infinity;
          return da - db;
        }
        if (sortBy === "prize") {
          return (b.prizeAmount ?? 0) - (a.prizeAmount ?? 0);
        }
        return 0;
      });
    }

    // ── Carve out local campus section before ranking ─────────────────────────
    // Community-submitted and campus hackathons are surfaced in a dedicated
    // "Local Campus" section and separated from the standard national ranking
    // pool to highlight grassroots and institutional opportunities prominently.
    const localCampus = actionable.filter(
      (h) =>
        h.isCommunitySubmitted === true ||
        h.stream === "COMMUNITY_LOCAL"
    );
    const localCampusIds = new Set(localCampus.map((h) => h.id));

    // Remaining pool fed to the standard ranking engine (primarily national automated stream)
    const rankingPool = actionable.filter((h) => !localCampusIds.has(h.id));

    // ── Build standard discovery sections ─────────────────────────────────────
    const sections = buildDiscoverySections(rankingPool, weights, now);

    // ── Compute total count across all sections ────────────────────────────────
    const totalCount =
      sections.featured.length +
      sections.closingSoon.length +
      localCampus.length +
      sections.upcoming.length +
      sections.other.length;

    return NextResponse.json({
      count: totalCount,
      hackathons: actionable.map(({ _discoveryView: _dv, ...rest }) => rest),
      sections: {
        featured: sections.featured.map(({ hackathon, rankScore }) => ({
          ...hackathon,
          rankScore,
        })),
        closingSoon: sections.closingSoon.map(({ hackathon, rankScore }) => ({
          ...hackathon,
          rankScore,
        })),
        localCampus,
        upcoming: sections.upcoming.map(({ hackathon, rankScore }) => ({
          ...hackathon,
          rankScore,
        })),
        other: sections.other.map(({ hackathon, rankScore }) => ({
          ...hackathon,
          rankScore,
        })),
      },
      meta: {
        ...sections.meta,
        rankedAt: sections.meta.rankedAt.toISOString(),
        totalCandidates: sections.meta.totalCandidates,
        localCampusCount: localCampus.length,
        unassignedCount: sections.unassigned.length,
        weights,
        filters: {
          search: search ?? null,
          mode: mode !== "ALL" ? mode : null,
          college: college ?? null,
          city: city ?? null,
          eligibility: eligibility !== "ALL" ? eligibility : null,
          openRegOnly,
          sortBy,
          sourceId: sourceId ?? null,
          nationalOnly,
          tag: tag ?? null,
        },
      },
    });
  } catch (err) {
    console.error("GET /api/hackathons/ranked failed:", err);
    return NextResponse.json({ error: "Failed to build ranked sections" }, { status: 500 });
  }
}
