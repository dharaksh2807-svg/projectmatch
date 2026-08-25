import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { projectSchema } from "@/lib/validations";
import { z } from "zod";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/projects/[id] — get a single project with full details
export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          image: true,
          reputationScore: true,
          portfolioLinks: true,
        },
      },
      roles: {
        include: {
          applications: {
            select: { id: true, status: true, userId: true },
          },
        },
      },
      team: {
        include: {
          members: {
            select: { id: true, name: true, image: true, skills: true },
          },
        },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json(project);
}

// PATCH /api/projects/[id] — update project (owner only)
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = await prisma.project.findUnique({
    where: { id },
    include: { owner: { select: { email: true } } },
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (project.owner.email !== session.user.email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updateSchema = projectSchema.omit({ roles: true }).partial();
  const result = updateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation error", details: result.error.flatten() },
      { status: 422 }
    );
  }

  const updated = await prisma.project.update({
    where: { id },
    data: result.data,
    include: { roles: true },
  });

  return NextResponse.json(updated);
}

// DELETE /api/projects/[id] — delete project (owner only)
export async function DELETE(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = await prisma.project.findUnique({
    where: { id },
    include: { owner: { select: { email: true } } },
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (project.owner.email !== session.user.email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.project.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
