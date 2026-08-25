import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/redis";
import {
  sendMail,
  newApplicationEmail,
  newInviteEmail,
} from "@/lib/mail";

export const runtime = "nodejs";

const bodySchema = z.object({
  roleId: z.string().min(1),
  actionType: z.enum(["APPLY", "INVITE"]),
  // candidateId is required when the owner is sending an INVITE
  candidateId: z.string().optional(),
});

/**
 * POST /api/applications
 * body: { roleId, actionType: "APPLY" | "INVITE", candidateId? }
 *
 * APPLY  — Authenticated user applies to a role.
 * INVITE — Project owner invites a specific candidate.
 */
export async function GET(request: Request) {
  // List applications for the current user or owner
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

  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") || "mine"; // "mine" | "received"

  if (view === "received") {
    // Owner: applications received on their projects
    const applications = await prisma.application.findMany({
      where: {
        role: { project: { ownerId: user.id } },
        status: "PENDING",
      },
      include: {
        role: { include: { project: { select: { id: true, title: true } } } },
        user: {
          select: { id: true, name: true, image: true, skills: true, experienceLevel: true, reputationScore: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ applications });
  }

  // Candidate: my own applications & invites
  const applications = await prisma.application.findMany({
    where: { userId: user.id },
    include: {
      role: {
        include: {
          project: {
            include: {
              owner: { select: { id: true, name: true, image: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ applications });
}

export async function POST(request: Request) {
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

  const { roleId, actionType, candidateId } = parsed.data;

  // Get current user
  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, name: true, email: true },
  });
  if (!currentUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // ── Rate Limit (keyed by userId) ────────────────────────────────────────────
  const rl = await checkRateLimit(currentUser.id);
  if (!rl.success) {
    return NextResponse.json(
      {
        error: "Too many requests. Please wait before submitting again.",
        reset: rl.reset,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(((rl.reset ?? Date.now()) - Date.now()) / 1000)),
        },
      }
    );
  }

  // ── Fetch Role ───────────────────────────────────────────────────────────────
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    include: {
      project: {
        include: {
          owner: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  if (!role) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }

  if (role.filledCount >= role.headcount) {
    return NextResponse.json(
      { error: "This role is already fully filled." },
      { status: 409 }
    );
  }

  if (actionType === "APPLY") {
    // Self-apply: must NOT be the project owner
    if (role.project.ownerId === currentUser.id) {
      return NextResponse.json(
        { error: "You cannot apply to your own project." },
        { status: 403 }
      );
    }

    // Duplicate check
    const existing = await prisma.application.findUnique({
      where: { roleId_userId: { roleId, userId: currentUser.id } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "You have already applied to this role.", applicationId: existing.id },
        { status: 409 }
      );
    }

    // Create application
    const application = await prisma.application.create({
      data: {
        roleId,
        userId: currentUser.id,
        status: "PENDING",
      },
    });

    // Fire email to owner (non-blocking)
    const appUrl = `${process.env.NEXTAUTH_URL}/projects/${role.project.id}`;
    const emailPayload = newApplicationEmail({
      ownerName: role.project.owner.name || "Project Owner",
      candidateName: currentUser.name || "Someone",
      roleName: role.title,
      projectTitle: role.project.title,
      projectUrl: appUrl,
    });
    sendMail({ to: role.project.owner.email!, ...emailPayload }).catch((e) =>
      console.error("[mail] Application notification failed:", e)
    );

    return NextResponse.json({ application }, { status: 201 });
  }

  if (actionType === "INVITE") {
    // Only the project owner can invite
    if (role.project.ownerId !== currentUser.id) {
      return NextResponse.json(
        { error: "Only the project owner can invite candidates." },
        { status: 403 }
      );
    }

    if (!candidateId) {
      return NextResponse.json(
        { error: "candidateId is required for INVITE." },
        { status: 400 }
      );
    }

    const candidate = await prisma.user.findUnique({
      where: { id: candidateId },
      select: { id: true, name: true, email: true },
    });
    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    // Duplicate check
    const existing = await prisma.application.findUnique({
      where: { roleId_userId: { roleId, userId: candidateId } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "This candidate already has an application for this role.", applicationId: existing.id },
        { status: 409 }
      );
    }

    // Create invite as an Application with INVITED status
    const application = await prisma.application.create({
      data: {
        roleId,
        userId: candidateId,
        status: "INVITED",
      },
    });

    // Email the candidate
    const projectUrl = `${process.env.NEXTAUTH_URL}/projects/${role.project.id}`;
    const emailPayload = newInviteEmail({
      candidateName: candidate.name || "there",
      ownerName: currentUser.name || "Project Lead",
      roleName: role.title,
      projectTitle: role.project.title,
      projectUrl,
    });
    sendMail({ to: candidate.email!, ...emailPayload }).catch((e) =>
      console.error("[mail] Invite notification failed:", e)
    );

    return NextResponse.json({ application }, { status: 201 });
  }

  return NextResponse.json({ error: "Invalid actionType" }, { status: 400 });
}
