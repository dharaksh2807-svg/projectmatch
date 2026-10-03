import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  title: z.string().min(3).max(120).trim().optional(),
  description: z.string().min(20).max(5000).trim().optional(),
  projectType: z.enum(["Hackathon", "Startup", "Open Source", "Side Project", "Research", "Competition"]).optional(),
  duration: z.enum(["< 1 week", "1-4 weeks", "1-3 months", "3-6 months", "6+ months"]).optional(),
  techStack: z.array(z.string()).max(30).optional(),
  repoUrl: z.string().url().optional().or(z.literal("")).or(z.null()),
  websiteUrl: z.string().url().optional().or(z.literal("")).or(z.null()),
  isPublished: z.boolean().optional(),
});

type Params = Promise<{ id: string }>;

/**
 * GET /api/projects/[id]
 * Returns a single project with all its roles and applications count.
 * Public — guests can view published projects.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Params }
) {
  const { id } = await params;

  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, name: true, image: true, reputationScore: true, bio: true },
        },
        roles: {
          orderBy: { createdAt: "asc" },
          include: { _count: { select: { applications: true } } },
        },
        _count: { select: { applications: true } },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!project.isPublished) {
      // Only the owner can see unpublished projects
      const session = await getServerSession(authOptions);
      if (session?.user?.id !== project.ownerId) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
    }

    return NextResponse.json(project);
  } catch (err) {
    console.error("GET /api/projects/[id] failed:", err);
    return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 });
  }
}

/**
 * PUT /api/projects/[id]
 * Updates a project. Requires ownership.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Params }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Ownership check
  const existing = await prisma.project.findUnique({ where: { id }, select: { ownerId: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.format() },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.project.update({
      where: { id },
      data: parsed.data,
      include: { roles: true },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/projects/[id] failed:", err);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[id]
 * Soft-deletes by unpublishing, or hard-deletes if specified.
 * Requires ownership.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Params }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const hardDelete = new URL(req.url).searchParams.get("hard") === "true";

  const existing = await prisma.project.findUnique({ where: { id }, select: { ownerId: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    if (hardDelete) {
      await prisma.project.delete({ where: { id } });
      return NextResponse.json({ deleted: true });
    } else {
      // Soft delete: unpublish
      await prisma.project.update({ where: { id }, data: { isPublished: false } });
      return NextResponse.json({ archived: true });
    }
  } catch (err) {
    console.error("DELETE /api/projects/[id] failed:", err);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
