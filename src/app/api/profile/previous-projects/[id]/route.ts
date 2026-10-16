import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { previousProjectSchema } from "@/lib/validations";

/**
 * PATCH /api/profile/previous-projects/[id]
 * Updates an existing previous project owned by the user.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.previousProject.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Project not found or forbidden" }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = previousProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const updated = await prisma.previousProject.update({
      where: { id },
      data: {
        title: parsed.data.title,
        description: parsed.data.description || null,
        techStack: parsed.data.techStack || [],
        projectUrl: parsed.data.projectUrl || null,
        githubUrl: parsed.data.githubUrl || null,
        driveUrl: parsed.data.driveUrl || null,
        fileType: parsed.data.fileType || null,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/profile/previous-projects/[id] failed:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * DELETE /api/profile/previous-projects/[id]
 * Deletes a previous project owned by the user.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.previousProject.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Project not found or forbidden" }, { status: 404 });
    }

    await prisma.previousProject.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.error("DELETE /api/profile/previous-projects/[id] failed:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
