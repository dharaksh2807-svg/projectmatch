import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roleSchema } from "@/lib/validations";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

// PATCH /api/roles/[id] — update a role
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await prisma.role.findUnique({
    where: { id },
    include: {
      project: { include: { owner: { select: { email: true } } } },
    },
  });

  if (!role) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (role.project.owner.email !== session.user.email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = roleSchema.partial().safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation error", details: result.error.flatten() },
      { status: 422 }
    );
  }

  const updated = await prisma.role.update({
    where: { id },
    data: result.data,
  });

  return NextResponse.json(updated);
}

// DELETE /api/roles/[id] — delete a role (owner only)
export async function DELETE(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await prisma.role.findUnique({
    where: { id },
    include: {
      project: { include: { owner: { select: { email: true } } } },
    },
  });

  if (!role) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (role.project.owner.email !== session.user.email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.role.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
