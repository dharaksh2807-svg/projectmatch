import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  sendMail,
  applicationAcceptedEmail,
  applicationDeclinedEmail,
  inviteAcceptedEmail,
} from "@/lib/mail";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  status: z.enum(["ACCEPTED", "DECLINED"]),
});

/**
 * PATCH /api/applications/[id]
 * body: { status: "ACCEPTED" | "DECLINED" }
 *
 * Authorization rules:
 *  - The project OWNER can ACCEPT or DECLINE a PENDING application.
 *  - The CANDIDATE can ACCEPT or DECLINE an INVITED application.
 *
 * On ACCEPTED:
 *  - Uses prisma.$transaction to atomically:
 *      1. Re-check headcount guard
 *      2. Update Application.status → ACCEPTED
 *      3. Increment Role.filledCount
 *      4. Upsert Team & connect the User as a member
 *  - Fires an email to the counterpart.
 *
 * On DECLINED:
 *  - Updates Application.status → DECLINED
 *  - Fires an email to the counterpart.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id: applicationId } = await params;

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

  const { status: newStatus } = parsed.data;

  // Current user
  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, name: true, email: true },
  });
  if (!currentUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Fetch application with full context
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      role: {
        include: {
          project: {
            include: {
              owner: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
    },
  });

  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const isOwner = application.role.project.ownerId === currentUser.id;
  const isCandidate = application.userId === currentUser.id;

  // ── Authorization Guard ──────────────────────────────────────────────────────
  if (application.status === "PENDING") {
    // Only the owner can act on a self-application
    if (!isOwner) {
      return NextResponse.json(
        { error: "Only the project owner can accept or decline applications." },
        { status: 403 }
      );
    }
  } else if (application.status === "INVITED") {
    // Only the invited candidate can act on an invite
    if (!isCandidate) {
      return NextResponse.json(
        { error: "Only the invited candidate can accept or decline this invite." },
        { status: 403 }
      );
    }
  } else {
    // Already decided
    return NextResponse.json(
      { error: `Application is already in ${application.status} state.` },
      { status: 409 }
    );
  }

  const projectUrl = `${process.env.NEXTAUTH_URL}/projects/${application.role.project.id}`;

  if (newStatus === "DECLINED") {
    // Simple decline — no transaction needed
    const updated = await prisma.application.update({
      where: { id: applicationId },
      data: { status: "DECLINED" },
    });

    // Email the candidate
    const emailPayload = applicationDeclinedEmail({
      candidateName: application.user.name || "there",
      roleName: application.role.title,
      projectTitle: application.role.project.title,
    });
    sendMail({ to: application.user.email!, ...emailPayload }).catch((e) =>
      console.error("[mail] Decline notification failed:", e)
    );

    return NextResponse.json({ application: updated });
  }

  // ── ACCEPT — Transactional ───────────────────────────────────────────────────
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Re-fetch role inside transaction for current headcount
      const freshRole = await tx.role.findUnique({
        where: { id: application.roleId },
        select: { filledCount: true, headcount: true, projectId: true },
      });

      if (!freshRole) throw new Error("ROLE_NOT_FOUND");

      if (freshRole.filledCount >= freshRole.headcount) {
        throw new Error("ROLE_FULL");
      }

      // 2. Update application status
      const updatedApp = await tx.application.update({
        where: { id: applicationId },
        data: { status: "ACCEPTED" },
      });

      // 3. Increment Role.filledCount
      await tx.role.update({
        where: { id: application.roleId },
        data: { filledCount: { increment: 1 } },
      });

      // 4. Upsert Team and connect the candidate as a member
      await tx.team.upsert({
        where: { projectId: freshRole.projectId },
        create: {
          projectId: freshRole.projectId,
          members: { connect: { id: application.userId } },
        },
        update: {
          members: { connect: { id: application.userId } },
        },
      });

      return updatedApp;
    });

    // Fire emails (outside transaction — non-blocking)
    const ownerData = application.role.project.owner;

    if (application.status === "PENDING") {
      // Owner accepted candidate's self-application → email the candidate
      const emailPayload = applicationAcceptedEmail({
        candidateName: application.user.name || "there",
        roleName: application.role.title,
        projectTitle: application.role.project.title,
        projectUrl,
      });
      sendMail({ to: application.user.email!, ...emailPayload }).catch((e) =>
        console.error("[mail] Accept notification failed:", e)
      );
    } else {
      // Candidate accepted owner's invite → email the owner
      const emailPayload = inviteAcceptedEmail({
        ownerName: ownerData.name || "Project Lead",
        candidateName: application.user.name || "The candidate",
        roleName: application.role.title,
        projectTitle: application.role.project.title,
        projectUrl,
      });
      sendMail({ to: ownerData.email!, ...emailPayload }).catch((e) =>
        console.error("[mail] Invite-accepted notification failed:", e)
      );
    }

    return NextResponse.json({ application: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";

    if (message === "ROLE_FULL") {
      return NextResponse.json(
        { error: "This role is already fully filled. No more spots available." },
        { status: 409 }
      );
    }

    if (message === "ROLE_NOT_FOUND") {
      return NextResponse.json({ error: "Role not found." }, { status: 404 });
    }

    console.error("[applications/[id] PATCH] Transaction error:", err);
    return NextResponse.json(
      { error: "An internal error occurred." },
      { status: 500 }
    );
  }
}
