import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const roleSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  requiredSkills: z.array(z.string()).max(20).default([]),
  requiredExperienceLevel: z.enum(["Beginner", "Intermediate", "Advanced", "Expert", "Any"]),
  timeCommitment: z.string().min(1).max(100),
  headcount: z.number().int().min(1).max(50).default(1),
});

const projectSchema = z.object({
  title: z.string().min(3).max(120).trim(),
  description: z.string().min(20).max(5000).trim(),
  projectType: z.enum(["Hackathon", "Startup", "Open Source", "Side Project", "Research", "Competition"]),
  duration: z.enum(["< 1 week", "1-4 weeks", "1-3 months", "3-6 months", "6+ months"]),
  techStack: z.array(z.string()).max(30).default([]),
  repoUrl: z.string().url().optional().or(z.literal("")),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  isPublished: z.boolean().default(false),
  roles: z.array(roleSchema).min(1, "At least one role is required").max(10),
});

/**
 * GET /api/projects
 * Returns all published projects with their roles and owner info.
 * Optional query params: type, duration, skill, search
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const duration = searchParams.get("duration");
  const skill = searchParams.get("skill");
  const search = searchParams.get("search");
  const ownedBy = searchParams.get("ownedBy"); // "me" — returns user's own projects

  const session = await getServerSession(authOptions);

  try {
    const projects = await prisma.project.findMany({
      where: {
        // If asking for own projects, return all (including drafts); otherwise only published
        ...(ownedBy === "me" && session?.user?.id
          ? { ownerId: session.user.id }
          : { isPublished: true }),
        ...(type && type !== "All" ? { projectType: type } : {}),
        ...(duration && duration !== "All" ? { duration } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(skill
          ? { techStack: { has: skill } }
          : {}),
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            image: true,
            reputationScore: true,
          },
        },
        roles: {
          where: { isOpen: true },
          orderBy: { createdAt: "asc" },
        },
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(projects);
  } catch (err) {
    console.error("GET /api/projects failed:", err);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

/**
 * POST /api/projects
 * Creates a new project with one or more roles.
 * Requires authentication.
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

  const parsed = projectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.format() },
      { status: 400 }
    );
  }

  const { roles, repoUrl, websiteUrl, ...projectData } = parsed.data;

  try {
    const project = await prisma.project.create({
      data: {
        ...projectData,
        repoUrl: repoUrl || null,
        websiteUrl: websiteUrl || null,
        ownerId: session.user.id,
        roles: {
          create: roles,
        },
      },
      include: {
        roles: true,
        owner: {
          select: { id: true, name: true, image: true },
        },
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (err) {
    console.error("POST /api/projects failed:", err);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
