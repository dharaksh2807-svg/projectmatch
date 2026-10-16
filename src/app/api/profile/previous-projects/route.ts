import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { previousProjectSchema } from "@/lib/validations";

/**
 * GET /api/profile/previous-projects
 * Returns all previous projects for the authenticated user.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projects = await prisma.previousProject.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(projects);
  } catch (err) {
    console.error("GET /api/profile/previous-projects failed:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/profile/previous-projects
 * Adds a new previous project for the authenticated user.
 */
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

    const parsed = previousProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const project = await prisma.previousProject.create({
      data: {
        userId: session.user.id,
        title: parsed.data.title,
        description: parsed.data.description || null,
        techStack: parsed.data.techStack || [],
        projectUrl: parsed.data.projectUrl || null,
        githubUrl: parsed.data.githubUrl || null,
        driveUrl: parsed.data.driveUrl || null,
        fileType: parsed.data.fileType || null,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (err) {
    console.error("POST /api/profile/previous-projects failed:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
