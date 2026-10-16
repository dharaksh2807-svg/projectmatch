import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { VerificationStatus } from "@prisma/client";
import { classifyForDiscovery } from "@/lib/hackathons/utils/status";
import { loadWeights, parseWeightsOverride } from "@/lib/hackathons/ranking/weights";
import { buildDiscoverySections } from "@/lib/hackathons/ranking/sections";

/**
 * GET /api/hackathons/ranked
 *
 * Returns the four Phase 6 discovery sections:
 *   - featured      — Verified national competitions with open/unknown registration
 *   - closingSoon   — Open registration deadline within 72 hours
 *   - upcoming      — Active opportunities sorted by rank score
 *   - other         — Verified events with closed/upcoming registration
 *
 * Query parameters:
 *   weights   — base64-encoded RankingWeights JSON override (non-production only)
 *   search    — filter candidates by text before ranking
 *   mode      — ONLINE | OFFLINE | HYBRID participation mode filter
 *   sourceId  — filter by ingestion source
 *
 * Phase 6 guarantees:
 * - Only eligible, publishable events are scored.
 * - No event appears in more than one section.
 * - Closed-registration events never surface as actionable opportunities.
 * - National-level events require verifiable evidence (isNational flag).
 * - Rank score is computed deterministically at query time.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const now = new Date();

    // ── Weights ─────────────────────────────────────────────────────────────
    const weightsOverride = parseWeightsOverride(searchParams.get("weights"));
    const weights = weightsOverride ?? loadWeights();

    // ── Filters ──────────────────────────────────────────────────────────────
    const search = searchParams.get("search");
    const mode = searchParams.get("mode")?.toUpperCase();
    const sourceId = searchParams.get("sourceId");

    const where: any = {
      // Always exclude REJECTED from every feed (Phase 5 invariant)
      verificationStatus: { not: VerificationStatus.REJECTED },
      // Exclude explicitly cancelled (Phase 5: not actionable)
      NOT: { status: "CANCELLED" },
    };

    if (search?.trim()) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
        { country: { contains: search, mode: "insensitive" } },
      ];
    }

    if (mode && ["ONLINE", "OFFLINE", "HYBRID"].includes(mode)) {
      where.participationMode = mode;
    }

    if (sourceId) {
      where.sourceId = sourceId;
    }

    // ── Fetch candidates ─────────────────────────────────────────────────────
    const hackathons = await prisma.hackathon.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        location: true,
        city: true,
        country: true,
        countryCode: true,
        websiteUrl: true,
        devpostUrl: true,
        bannerUrl: true,
        startDate: true,
        endDate: true,
        registrationDeadline: true,
        registrationStartDate: true,
        timezone: true,
        status: true,
        registrationStatus: true,
        verificationStatus: true,
        isNational: true,
        organizerName: true,
        organizerCredibility: true,
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
        _count: { select: { projects: true } },
      },
      orderBy: { startDate: "asc" },
    });

    // ── Apply Phase 5 runtime classification ─────────────────────────────────
    // We use classifyForDiscovery to pre-screen and get computed statuses.
    // Events classified as EXCLUDED, PAST, or CANCELLED are not passed to the
    // ranking engine — they cannot appear in any section.
    const actionable = hackathons
      .map((h) => {
        const cls = classifyForDiscovery(h, now);
        return { ...h, computedStatus: cls.computedStatus, computedRegistrationStatus: cls.computedRegistrationStatus, _discoveryView: cls.view };
      })
      .filter((h) => !["EXCLUDED", "PAST", "CANCELLED"].includes(h._discoveryView));

    // ── Build discovery sections ─────────────────────────────────────────────
    const sections = buildDiscoverySections(actionable, weights, now);

    return NextResponse.json({
      sections: {
        featured: sections.featured.map(({ hackathon, rankScore }) => ({
          ...hackathon,
          rankScore,
        })),
        closingSoon: sections.closingSoon.map(({ hackathon, rankScore }) => ({
          ...hackathon,
          rankScore,
        })),
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
        unassignedCount: sections.unassigned.length,
        weights,
        filters: {
          search: search ?? null,
          mode: mode ?? null,
          sourceId: sourceId ?? null,
        },
      },
    });
  } catch (err) {
    console.error("GET /api/hackathons/ranked failed:", err);
    return NextResponse.json({ error: "Failed to build ranked sections" }, { status: 500 });
  }
}
