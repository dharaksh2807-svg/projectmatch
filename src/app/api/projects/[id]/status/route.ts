import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  status: z.enum(["ACTIVE", "COMPLETED"]),
});

/**
 * PATCH /api/projects/[id]/status
 * Allows the project owner to transition a project to ACTIVE or COMPLETED.
 *
 * Completing a project unlocks the ratings system for all team members.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id: projectId } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse body
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { status } = parsed.data;

  // Fetch project and verify ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { owner: { select: { email: true } } },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  if (project.owner.email !== session.user.email) {
    return NextResponse.json(
      { error: "Only the project owner can change its status." },
      { status: 403 }
    );
  }

  // Guard: can't re-complete an already completed project if going back to ACTIVE
  // (allowed for dev/testing purposes — no hard block)

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: { status },
    select: { id: true, title: true, status: true },
  });

  return NextResponse.json({ project: updated });
}
