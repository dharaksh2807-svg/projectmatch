import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

type Params = Promise<{ id: string }>;

const statusSchema = z.object({
  status: z.enum(["PLANNING", "IN_PROGRESS", "COMPLETED", "ARCHIVED"]),
});

/**
 * PATCH /api/projects/[id]/status
 * Allows project owner to change project status (e.g. marking it as COMPLETED).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Params }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, ownerId: true, status: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.ownerId !== session.user.id) {
      return NextResponse.json(
        { error: "Only the project owner can change the project status" },
        { status: 403 }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid status", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const newStatus = parsed.data.status;
    const completedAt = newStatus === "COMPLETED" ? new Date() : null;

    const updated = await prisma.project.update({
      where: { id },
      data: {
        status: newStatus,
        completedAt: newStatus === "COMPLETED" ? completedAt : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      project: updated,
    });
  } catch (error) {
    console.error("PATCH /api/projects/[id]/status failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
