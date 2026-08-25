import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roleSchema } from "@/lib/validations";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/projects/[id]/roles — add a role to a project (owner only)
export async function POST(request: Request, { params }: RouteParams) {
  const { id: projectId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
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

  const result = roleSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation error", details: result.error.flatten() },
      { status: 422 }
    );
  }

  const role = await prisma.role.create({
    data: {
      ...result.data,
      projectId,
    },
  });

  return NextResponse.json(role, { status: 201 });
}
