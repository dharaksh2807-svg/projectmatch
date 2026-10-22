import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

type Params = Promise<{ id: string; reqId: string }>;

const updateRequirementSchema = z.object({
  name: z.string().min(2).max(80).trim().optional(),
  category: z.string().max(50).optional().nullable(),
  importance: z.enum(["REQUIRED", "PREFERRED"]).optional(),
  requiredSkills: z.array(z.string().min(1).trim()).min(1).optional(),
  minExperienceLevel: z.string().optional().nullable(),
  targetRoleTitle: z.string().max(80).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
});

/**
 * PUT /api/projects/[id]/requirements/[reqId]
 * Updates an existing capability requirement.
 * Authorization: Strictly the project owner.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { id: projectId, reqId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existingReq = await prisma.capabilityRequirement.findUnique({
      where: { id: reqId },
    });

    if (!existingReq || existingReq.projectId !== projectId) {
      return NextResponse.json({ error: "Requirement not found" }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = updateRequirementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const updated = await prisma.capabilityRequirement.update({
      where: { id: reqId },
      data: parsed.data,
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("PUT /api/projects/[id]/requirements/[reqId] failed:", err);
    return NextResponse.json({ error: "Failed to update requirement" }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[id]/requirements/[reqId]
 * Deletes a capability requirement.
 * Authorization: Strictly the project owner.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { id: projectId, reqId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existingReq = await prisma.capabilityRequirement.findUnique({
      where: { id: reqId },
    });

    if (!existingReq || existingReq.projectId !== projectId) {
      return NextResponse.json({ error: "Requirement not found" }, { status: 404 });
    }

    await prisma.capabilityRequirement.delete({
      where: { id: reqId },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/projects/[id]/requirements/[reqId] failed:", err);
    return NextResponse.json({ error: "Failed to delete requirement" }, { status: 500 });
  }
}
