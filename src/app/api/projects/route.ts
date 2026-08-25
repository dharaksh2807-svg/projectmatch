import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { projectSchema } from "@/lib/validations";

export const runtime = "nodejs";

// GET /api/projects — list all projects (with optional filters)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const skill = searchParams.get("skill");
  const type = searchParams.get("type");
  const duration = searchParams.get("duration");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
  const skip = (page - 1) * limit;

  const projects = await prisma.project.findMany({
    where: {
      ...(type && { projectType: type }),
      ...(duration && { duration }),
      ...(skill && {
        roles: {
          some: {
            requiredSkills: { has: skill },
            filledCount: { lt: prisma.role.fields.headcount },
          },
        },
      }),
    },
    include: {
      owner: {
        select: { id: true, name: true, image: true, reputationScore: true },
      },
      roles: true,
      _count: { select: { roles: true } },
    },
    orderBy: { createdAt: "desc" },
    skip,
    take: limit,
  });

  const total = await prisma.project.count({
    where: {
      ...(type && { projectType: type }),
      ...(duration && { duration }),
    },
  });

  return NextResponse.json({ projects, total, page, limit });
}

// POST /api/projects — create a new project with roles
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = projectSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation error", details: result.error.flatten() },
      { status: 422 }
    );
  }

  const { roles, ...projectData } = result.data;

  const project = await prisma.project.create({
    data: {
      ...projectData,
      ownerId: user.id,
      roles: {
        create: roles.map((role) => ({
          title: role.title,
          requiredSkills: role.requiredSkills,
          requiredExperienceLevel: role.requiredExperienceLevel,
          timeCommitment: role.timeCommitment,
          headcount: role.headcount,
        })),
      },
    },
    include: {
      roles: true,
      owner: { select: { id: true, name: true, image: true } },
    },
  });

  return NextResponse.json(project, { status: 201 });
}
