import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  HackathonStatus,
  VerificationStatus,
} from "@prisma/client";
import { classifyForDiscovery, DiscoveryView } from "@/lib/hackathons/utils/status";

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
 *   search        — full-text search across name, description, location
 *   view          — main (default) | upcoming-reg | reg-closed | past | cancelled | all
 *   page          — 1-indexed page number (default: 1)
 *   pageSize      — results per page (default: 20, max: 100)
 *   mode          — ONLINE | OFFLINE | HYBRID (filter by participation mode)
 *   sourceId      — filter by specific source (e.g. "hackclub", "kaggle")
 *   includeStale  — "true" to include stale records in MAIN view (default: false)
 *   includeFlagged — "true" to include FLAGGED verification records (default: false)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const view = parseView(searchParams.get("view"));
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));
    const mode = searchParams.get("mode")?.toUpperCase();
    const sourceId = searchParams.get("sourceId");
    const includeStale = searchParams.get("includeStale") === "true";
    const includeFlagged = searchParams.get("includeFlagged") === "true";
    const nationalOnly = searchParams.get("nationalOnly") === "true";
    const tag = searchParams.get("tag");

    // Auto-seed if empty
    const count = await prisma.hackathon.count();
    if (count === 0) {
      await prisma.hackathon.createMany({ data: DEFAULT_HACKATHONS });
    }

    // ── Database-level pre-filter ──────────────────────────────────────────
    // We apply a broad DB-level filter first to avoid loading the entire table
    // into memory. The runtime classifier then does the precise Phase 5 logic.
    //
    // Strategy: for each view, exclude records that are definitely wrong via
    // a simple date+status check. Edge cases are handled by the runtime engine.

    const now = new Date();
    const whereClause: any = {
      // Always exclude REJECTED
      verificationStatus: { not: VerificationStatus.REJECTED },
    };

    if (nationalOnly) {
      whereClause.isNational = true;
    }

    if (tag) {
      whereClause.OR = [
        { tags: { has: tag } },
        { themes: { has: tag } },
      ];
    }

    // Include / exclude FLAGGED based on caller preference
    if (!includeFlagged) {
      whereClause.NOT = { verificationStatus: VerificationStatus.FLAGGED };
    }

    // Source filter
    if (sourceId) {
      whereClause.sourceId = sourceId;
    }

    // Participation mode filter
    if (mode && ["ONLINE", "OFFLINE", "HYBRID"].includes(mode)) {
      whereClause.participationMode = mode;
    }

    // Text search
    if (search && search.trim().length > 0) {
      const searchConditions = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { organizerName: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
        { country: { contains: search, mode: "insensitive" } },
        { themes: { has: search } },
      ];

      if (whereClause.OR) {
        whereClause.AND = [
          { OR: whereClause.OR },
          { OR: searchConditions },
        ];
        delete whereClause.OR;
      } else {
        whereClause.OR = searchConditions;
      }
    }

    // Pre-filter by view at the DB level (broad, not exhaustive — runtime engine finalizes)
    if (view === "PAST") {
      // Definitely ended: endDate in the past OR DB status is ENDED
      whereClause.OR = [
        ...(whereClause.OR ?? []),
        { status: HackathonStatus.ENDED },
        { endDate: { lt: now } },
      ];
      // Ensure we don't inadvertently pull CANCELLED here
      whereClause.status = { not: HackathonStatus.CANCELLED };
    } else if (view === "CANCELLED") {
      whereClause.status = HackathonStatus.CANCELLED;
    } else if (view !== "all") {
      // MAIN, UPCOMING_REG, REG_CLOSED — exclude definitively ended and cancelled records
      whereClause.status = {
        notIn: [HackathonStatus.CANCELLED, HackathonStatus.ENDED],
      };
      // Broad date filter: exclude records whose endDate is unambiguously in the past
      whereClause.OR = [
        ...(whereClause.OR ?? []),
        { endDate: null }, // No end date — defer to runtime engine
        { endDate: { gte: now } },
      ];
    }

    // ── Fetch candidates ──────────────────────────────────────────────────
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
      orderBy: [{ startDate: "asc" }, { createdAt: "desc" }],
    });

    // ── Runtime Phase 5 classification ────────────────────────────────────
    const classified = candidates
      .map((h) => {
        const classification = classifyForDiscovery(h, now);
        return { hackathon: h, classification };
      })
      .filter(({ classification }) => {
        if (view === "all") {
          // Include everything except EXCLUDED
          return classification.view !== "EXCLUDED";
        }
        if (!includeStale && classification.view === "MAIN") {
          // Optionally exclude stale items from the main feed
          // (they are still classified MAIN, just surfaced with a warning annotation)
          // We include them by default; callers can filter client-side via `isStale`.
        }
        return classification.view === view;
      })
      .map(({ hackathon, classification }) => ({
        ...hackathon,
        // Augment each record with computed status override — the canonical truth
        computedStatus: classification.computedStatus,
        computedRegistrationStatus: classification.computedRegistrationStatus,
        discoveryView: classification.view,
        discoveryReason: classification.reason,
      }));

    // ── Pagination ────────────────────────────────────────────────────────
    const total = classified.length;
    const totalPages = Math.ceil(total / pageSize);
    const paginated = classified.slice((page - 1) * pageSize, page * pageSize);

    return NextResponse.json({
      data: paginated,
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
        search: search ?? null,
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
