import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  HackathonStatus,
  VerificationStatus,
  ParticipationMode,
  EligibilityScope,
  Prisma,
} from "@prisma/client";
import { classifyForDiscovery, DiscoveryView } from "@/lib/hackathons/utils/status";

// ─────────────────────────────────────────────────────────────────────────────
// OR-group helper — prevents illegal duplicate top-level OR keys on a single
// Prisma where object when multiple independent OR conditions coexist.
// ─────────────────────────────────────────────────────────────────────────────

function mergeOrGroups(
  where: Prisma.HackathonWhereInput,
  orGroups: Prisma.HackathonWhereInput[][]
): void {
  const nonEmpty = orGroups.filter((g) => g.length > 0);
  if (nonEmpty.length === 0) return;
  if (nonEmpty.length === 1) {
    where.OR = nonEmpty[0];
    return;
  }
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

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/hackathons — schema
// ─────────────────────────────────────────────────────────────────────────────

const createHackathonSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  devpostUrl: z.string().url("Must be a valid URL").optional().nullable(),
  websiteUrl: z.string().url("Must be a valid URL").optional().nullable(),
  location: z.string().optional().nullable(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Seed data — only used when DB has 0 hackathons
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_HACKATHONS = [
  {
    name: "Google Cloud GenAI Hackathon 2026",
    description:
      "Build cutting-edge multi-agent systems and generative AI applications using Gemini 2.5/3.1, Vertex AI, and modern cloud primitives. Compete for $100k+ in prizes and Google mentorship.",
    location: "Global Virtual",
    websiteUrl: "https://cloud.google.com/innovators",
    devpostUrl: "https://googlecloudgenai.devpost.com",
    startDate: new Date(Date.now() + 86400000 * 5),
    endDate: new Date(Date.now() + 86400000 * 25),
  },
  {
    name: "CalHacks 12.0",
    description:
      "The world's largest collegiate hackathon hosted at UC Berkeley. 2,500+ builders, hackers, and designers innovating in AI, hardware, fintech, and biotech.",
    location: "San Francisco, CA & Hybrid",
    websiteUrl: "https://calhacks.io",
    devpostUrl: "https://calhacks12.devpost.com",
    startDate: new Date(Date.now() + 86400000 * 14),
    endDate: new Date(Date.now() + 86400000 * 17),
  },
  {
    name: "HackMIT 2026",
    description:
      "MIT's flagship hackathon bringing together over 1,000 top engineers to build ambitious hardware and software prototypes in 36 intense hours.",
    location: "Cambridge, MA",
    websiteUrl: "https://hackmit.org",
    devpostUrl: "https://hackmit2026.devpost.com",
    startDate: new Date(Date.now() + 86400000 * 30),
    endDate: new Date(Date.now() + 86400000 * 32),
  },
  {
    name: "ETHGlobal San Francisco 2026",
    description:
      "Join the elite decentralized ecosystem builders for 3 days of hacking, workshops, and networking with leading protocol founders and investors.",
    location: "San Francisco, CA",
    websiteUrl: "https://ethglobal.com",
    devpostUrl: "https://ethglobal-sf.devpost.com",
    startDate: new Date(Date.now() + 86400000 * 45),
    endDate: new Date(Date.now() + 86400000 * 48),
  },
  {
    name: "AI Agents Global Sprint",
    description:
      "A worldwide virtual hackathon dedicated exclusively to autonomous AI agents, tool-using LLMs, and multi-agent coordination frameworks.",
    location: "Virtual (Discord & YouTube)",
    websiteUrl: "https://projectmatch.dev/sprint",
    devpostUrl: "https://aiagentsprint.devpost.com",
    startDate: new Date(Date.now() + 86400000 * 3),
    endDate: new Date(Date.now() + 86400000 * 10),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse and validate the ?view= query parameter.
 * Defaults to "main" (current opportunities).
 *
 * Supported views:
 *   main          — UPCOMING/ONGOING with open or unknown registration (default)
 *   upcoming-reg  — events where registration hasn't opened yet
 *   reg-closed    — upcoming events with closed registration
 *   past          — ended events (historical record)
 *   cancelled     — cancelled events
 *   all           — every non-rejected event (unfiltered by lifecycle)
 */
function parseView(raw: string | null): DiscoveryView | "all" {
  const viewMap: Record<string, DiscoveryView | "all"> = {
    main: "MAIN",
    "upcoming-reg": "UPCOMING_REG",
    "reg-closed": "REG_CLOSED",
    past: "PAST",
    cancelled: "CANCELLED",
    all: "all",
  };
  return viewMap[raw?.toLowerCase() ?? ""] ?? "MAIN";
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/hackathons
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch hackathons with Phase 5 runtime status classification.
 *
 * Query parameters:
 *   search        — full-text search across name, description, organizer, city
 *   view          — main (default) | upcoming-reg | reg-closed | past | cancelled | all
 *   page          — 1-indexed page number (default: 1)
 *   pageSize      — results per page (default: 20, max: 100)
 *   mode          — ALL | ONLINE | OFFLINE | HYBRID
 *   college       — collegeSlug exact match OR collegeName contains (e.g. "srm-ist")
 *   city          — city name, case-insensitive exact match (e.g. "Chennai")
 *   eligibility   — ALL | OPEN_TO_ALL | ANY_COLLEGE_STUDENT | HOST_COLLEGE_ONLY
 *   openRegOnly   — "true" → only events whose registrationDeadline >= now
 *   sortBy        — ranked | deadline | startDate | prize
 *   sourceId      — filter by specific source (e.g. "hackclub", "kaggle")
 *   tag           — filter by tag or theme exact match
 *   nationalOnly  — "true" → restrict to isNational = true
 *   includeStale  — "true" to include stale records in MAIN view (default: false)
 *   includeFlagged — "true" to include FLAGGED verification records (default: false)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const now = new Date();

    // ── Parse query params ────────────────────────────────────────────────────
    const search = searchParams.get("search")?.trim() ?? null;
    const view = parseView(searchParams.get("view"));
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));
    const mode = searchParams.get("mode")?.toUpperCase() ?? "ALL";
    const college = searchParams.get("college")?.trim() ?? null;
    const city = searchParams.get("city")?.trim() ?? null;
    const eligibility = searchParams.get("eligibility")?.toUpperCase() ?? "ALL";
    const openRegOnly = searchParams.get("openRegOnly") === "true";
    const sortBy = searchParams.get("sortBy") ?? "ranked";
    const sourceId = searchParams.get("sourceId") ?? null;
    const nationalOnly = searchParams.get("nationalOnly") === "true";
    const tag = searchParams.get("tag") ?? null;
    const includeStale = searchParams.get("includeStale") === "true";
    const includeFlagged = searchParams.get("includeFlagged") === "true";

    // Auto-seed if DB is empty
    const count = await prisma.hackathon.count();
    if (count === 0) {
      await prisma.hackathon.createMany({ data: DEFAULT_HACKATHONS });
    }

    // ── Build type-safe Prisma where clause ───────────────────────────────────
    const whereClause: Prisma.HackathonWhereInput = {
      verificationStatus: { not: VerificationStatus.REJECTED },
    };

    // Include / exclude FLAGGED
    if (!includeFlagged) {
      whereClause.NOT = { verificationStatus: VerificationStatus.FLAGGED };
    }

    // National-only guard
    if (nationalOnly) {
      whereClause.isNational = true;
    }

    // Source filter
    if (sourceId) {
      whereClause.sourceId = sourceId;
    }

    // Participation mode filter
    if (mode && mode !== "ALL" && ["ONLINE", "OFFLINE", "HYBRID"].includes(mode)) {
      whereClause.participationMode = mode as ParticipationMode;
    }

    // Eligibility scope filter
    if (
      eligibility &&
      eligibility !== "ALL" &&
      ["OPEN_TO_ALL", "ANY_COLLEGE_STUDENT", "HOST_COLLEGE_ONLY"].includes(eligibility)
    ) {
      whereClause.eligibilityScope = eligibility as EligibilityScope;
    }

    // Open registration guard
    if (openRegOnly) {
      whereClause.registrationDeadline = { gte: now };
    }

    // City filter — exact, case-insensitive
    if (city && city !== "ALL") {
      whereClause.city = { equals: city, mode: "insensitive" };
    }

    // ── Collect independent OR-groups for safe merging ────────────────────────
    const orGroups: Prisma.HackathonWhereInput[][] = [];

    // College filter (slug exact + name contains)
    if (college && college !== "ALL") {
      orGroups.push([
        { collegeSlug: { equals: college.toLowerCase() } },
        { collegeName: { contains: college, mode: "insensitive" } },
      ]);
    }

    // Tag filter
    if (tag) {
      orGroups.push([
        { tags: { has: tag } },
        { themes: { has: tag } },
      ]);
    }

    // Full-text search
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

    // Merge OR groups safely
    mergeOrGroups(whereClause, orGroups);

    // ── View-specific status/date pre-filter ──────────────────────────────────
    if (view === "PAST") {
      // Collect any existing OR conditions to avoid conflict
      const existingOrItems = Array.isArray(whereClause.OR) ? (whereClause.OR as Prisma.HackathonWhereInput[]) : [];
      const pastOrItems: Prisma.HackathonWhereInput[] = [
        ...existingOrItems,
        { status: HackathonStatus.ENDED },
        { endDate: { lt: now } },
      ];
      // If we had multiple OR groups merged to AND already, add the past filter directly
      if (whereClause.AND) {
        const existingAnd = Array.isArray(whereClause.AND)
          ? (whereClause.AND as Prisma.HackathonWhereInput[])
          : [whereClause.AND as Prisma.HackathonWhereInput];
        whereClause.AND = [...existingAnd, { OR: pastOrItems }];
      } else {
        whereClause.OR = pastOrItems;
      }
      whereClause.status = { not: HackathonStatus.CANCELLED };
    } else if (view === "CANCELLED") {
      whereClause.status = HackathonStatus.CANCELLED;
    } else if (view !== "all") {
      // MAIN, UPCOMING_REG, REG_CLOSED
      whereClause.status = {
        notIn: [HackathonStatus.CANCELLED, HackathonStatus.ENDED],
      };
      // Exclude records whose endDate is unambiguously in the past
      const dateOrItems: Prisma.HackathonWhereInput[] = [
        { endDate: null },
        { endDate: { gte: now } },
      ];
      if (whereClause.AND) {
        const existingAnd = Array.isArray(whereClause.AND)
          ? (whereClause.AND as Prisma.HackathonWhereInput[])
          : [whereClause.AND as Prisma.HackathonWhereInput];
        whereClause.AND = [...existingAnd, { OR: dateOrItems }];
      } else if (whereClause.OR) {
        // Already has an OR (single group path) — merge both into AND
        const existing = whereClause.OR as Prisma.HackathonWhereInput[];
        whereClause.AND = [{ OR: existing }, { OR: dateOrItems }];
        delete whereClause.OR;
      } else {
        whereClause.OR = dateOrItems;
      }
    }

    // ── Determine DB-level sort ───────────────────────────────────────────────
    const dbOrderBy: Prisma.HackathonOrderByWithRelationInput[] =
      sortBy === "deadline"
        ? [{ registrationDeadline: "asc" }, { startDate: "asc" }]
        : sortBy === "startDate"
        ? [{ startDate: "asc" }, { createdAt: "desc" }]
        : sortBy === "prize"
        ? [{ prizeAmount: "desc" }, { startDate: "asc" }]
        : [{ startDate: "asc" }, { createdAt: "desc" }];

    // ── Fetch candidates ──────────────────────────────────────────────────────
    const candidates = await prisma.hackathon.findMany({
      where: whereClause,
      include: {
        _count: { select: { projects: true } },
        projects: {
          where: { isPublished: true },
          take: 3,
          select: {
            id: true,
            title: true,
            projectType: true,
            owner: { select: { name: true, image: true } },
            roles: {
              where: { isOpen: true },
              select: { id: true, title: true, requiredSkills: true },
            },
          },
        },
      },
      orderBy: dbOrderBy,
    });

    // ── Runtime Phase 5 classification ────────────────────────────────────────
    const classified = candidates
      .map((h) => {
        const classification = classifyForDiscovery(h, now);
        return { hackathon: h, classification };
      })
      .filter(({ classification }) => {
        if (view === "all") {
          return classification.view !== "EXCLUDED";
        }
        return classification.view === view;
      })
      .map(({ hackathon, classification }) => ({
        ...hackathon,
        computedStatus: classification.computedStatus,
        computedRegistrationStatus: classification.computedRegistrationStatus,
        discoveryView: classification.view,
        discoveryReason: classification.reason,
      }));

    // ── Pagination ────────────────────────────────────────────────────────────
    const total = classified.length;
    const totalPages = Math.ceil(total / pageSize);
    const paginated = classified.slice((page - 1) * pageSize, page * pageSize);

    return NextResponse.json({
      data: paginated,
      count: total,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      meta: {
        view,
        now: now.toISOString(),
        filters: {
          search: search ?? null,
          mode: mode !== "ALL" ? mode : null,
          college: college ?? null,
          city: city ?? null,
          eligibility: eligibility !== "ALL" ? eligibility : null,
          openRegOnly,
          sortBy,
          nationalOnly,
          tag: tag ?? null,
          includeStale,
        },
      },
    });
  } catch (err) {
    console.error("GET /api/hackathons failed:", err);
    return NextResponse.json({ error: "Failed to fetch hackathons" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/hackathons — create a hackathon (authenticated)
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = createHackathonSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    try {
      const hackathon = await prisma.hackathon.create({
        data: {
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
          endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
          devpostUrl: parsed.data.devpostUrl ?? null,
          websiteUrl: parsed.data.websiteUrl ?? null,
          location: parsed.data.location ?? null,
        },
      });

      return NextResponse.json(hackathon, { status: 201 });
    } catch (err) {
      console.error("POST /api/hackathons create failed:", err);
      return NextResponse.json({ error: "Failed to create hackathon" }, { status: 500 });
    }
  } catch (outerErr) {
    console.error("POST /api/hackathons unhandled error:", outerErr);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
