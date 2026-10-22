import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

type Params = Promise<{ id: string }>;

const createRequirementSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(80).trim(),
  category: z.string().max(50).optional().nullable(),
  importance: z.enum(["REQUIRED", "PREFERRED"]).default("REQUIRED"),
  requiredSkills: z
    .array(z.string().min(1).trim())
    .min(1, "At least one required skill is required"),
  minExperienceLevel: z.string().optional().nullable(),
  targetRoleTitle: z.string().max(80).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
});

/**
 * GET /api/projects/[id]/requirements
 * Lists custom capability requirements for a project.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Params }
) {
  const { id: projectId } = await params;

  try {
    const requirements = await prisma.capabilityRequirement.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ requirements });
  } catch (err: any) {
    console.error("GET /api/projects/[id]/requirements failed:", err);
    return NextResponse.json({ error: "Failed to fetch requirements" }, { status: 500 });
  }
}

/**
 * POST /api/projects/[id]/requirements
 * Adds a new capability requirement to a project.
 * Authorization: Strictly the project owner.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { id: projectId } = await params;
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
      return NextResponse.json(
        { error: "Forbidden", message: "Only the project owner can define project capability requirements." },
        { status: 403 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = createRequirementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const {
      name,
      category,
      importance,
      requiredSkills,
      minExperienceLevel,
      targetRoleTitle,
      description,
    } = parsed.data;

    const created = await prisma.capabilityRequirement.create({
      data: {
        projectId,
        name,
        category: category || null,
        importance,
        requiredSkills,
        minExperienceLevel: minExperienceLevel || null,
        targetRoleTitle: targetRoleTitle || null,
        description: description || null,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/projects/[id]/requirements failed:", err);
    return NextResponse.json({ error: "Failed to create requirement" }, { status: 500 });
  }
}
