import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createHackathonSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  devpostUrl: z.string().url("Must be a valid URL").optional().nullable(),
  websiteUrl: z.string().url("Must be a valid URL").optional().nullable(),
  location: z.string().optional().nullable(),
});

// Seed data if DB has 0 hackathons
const DEFAULT_HACKATHONS = [
  {
    name: "Google Cloud GenAI Hackathon 2026",
    description: "Build cutting-edge multi-agent systems and generative AI applications using Gemini 2.5/3.1, Vertex AI, and modern cloud primitives. Compete for $100k+ in prizes and Google mentorship.",
    location: "Global Virtual",
    websiteUrl: "https://cloud.google.com/innovators",
    devpostUrl: "https://googlecloudgenai.devpost.com",
    startDate: new Date(Date.now() + 86400000 * 5),
    endDate: new Date(Date.now() + 86400000 * 25),
  },
  {
    name: "CalHacks 12.0",
    description: "The world's largest collegiate hackathon hosted at UC Berkeley. 2,500+ builders, hackers, and designers innovating in AI, hardware, fintech, and biotech.",
    location: "San Francisco, CA & Hybrid",
    websiteUrl: "https://calhacks.io",
    devpostUrl: "https://calhacks12.devpost.com",
    startDate: new Date(Date.now() + 86400000 * 14),
    endDate: new Date(Date.now() + 86400000 * 17),
  },
  {
    name: "HackMIT 2026",
    description: "MIT's flagship hackathon bringing together over 1,000 top engineers to build ambitious hardware and software prototypes in 36 intense hours.",
    location: "Cambridge, MA",
    websiteUrl: "https://hackmit.org",
    devpostUrl: "https://hackmit2026.devpost.com",
    startDate: new Date(Date.now() + 86400000 * 30),
    endDate: new Date(Date.now() + 86400000 * 32),
  },
  {
    name: "ETHGlobal San Francisco 2026",
    description: "Join the elite decentralized ecosystem builders for 3 days of hacking, workshops, and networking with leading protocol founders and investors.",
    location: "San Francisco, CA",
    websiteUrl: "https://ethglobal.com",
    devpostUrl: "https://ethglobal-sf.devpost.com",
    startDate: new Date(Date.now() + 86400000 * 45),
    endDate: new Date(Date.now() + 86400000 * 48),
  },
  {
    name: "AI Agents Global Sprint",
    description: "A worldwide virtual hackathon dedicated exclusively to autonomous AI agents, tool-using LLMs, and multi-agent coordination frameworks.",
    location: "Virtual (Discord & YouTube)",
    websiteUrl: "https://projectmatch.dev/sprint",
    devpostUrl: "https://aiagentsprint.devpost.com",
    startDate: new Date(Date.now() + 86400000 * 3),
    endDate: new Date(Date.now() + 86400000 * 10),
  },
];

/**
 * GET /api/hackathons
 * Fetch all hackathons with project counts and open recruiting projects.
 * Auto-seeds if empty.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");

    // Check count and seed if empty
    const count = await prisma.hackathon.count();
    if (count === 0) {
      await prisma.hackathon.createMany({
        data: DEFAULT_HACKATHONS,
      });
    }

    const whereClause: any = {};
    if (search && search.trim().length > 0) {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
      ];
    }

    const hackathons = await prisma.hackathon.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { projects: true },
        },
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
      orderBy: { startDate: "asc" },
    });

    return NextResponse.json(hackathons);
  } catch (err) {
    console.error("GET /api/hackathons failed:", err);
    return NextResponse.json({ error: "Failed to fetch hackathons" }, { status: 500 });
  }
}

/**
 * POST /api/hackathons
 * Create a new hackathon.
 */
export async function POST(req: NextRequest) {
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
    console.error("POST /api/hackathons failed:", err);
    return NextResponse.json({ error: "Failed to create hackathon" }, { status: 500 });
  }
}
