import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publishEvent, userNotificationsChannel } from "@/lib/redis";
import { sendApplicationStatusEmail } from "@/lib/email";

type Params = Promise<{ id: string }>;

/**
 * PATCH /api/applications/[id]
 * Owner of the project can accept or reject an application.
 * Applicant can withdraw their own application.
 * Fires a notification to the applicant on accept/reject.
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

  const application = await prisma.application.findUnique({
    where: { id },
    include: {
      role: { select: { title: true } },
      project: { select: { id: true, title: true, ownerId: true, owner: { select: { name: true } } } },
      user: { select: { id: true, name: true, email: true } },
    },
  });

  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const isOwner = application.project.ownerId === session.user.id;
  const isApplicant = application.user.id === session.user.id;

  if (!isOwner && !isApplicant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { status } = body;

  // Applicant can only withdraw; owner can accept or reject
  const allowedByOwner = ["ACCEPTED", "REJECTED"];
  const allowedByApplicant = ["WITHDRAWN"];

  if (isApplicant && !allowedByApplicant.includes(status ?? "")) {
    return NextResponse.json({ error: "Applicants can only withdraw their application" }, { status: 403 });
  }
  if (isOwner && !allowedByOwner.includes(status ?? "")) {
    return NextResponse.json({ error: "Owners can accept or reject applications" }, { status: 400 });
  }

  const notificationType = status === "ACCEPTED" ? "APPLICATION_ACCEPTED" : "APPLICATION_REJECTED";

  const ops = [
    prisma.application.update({
      where: { id },
      data: { status: status as "ACCEPTED" | "REJECTED" | "WITHDRAWN" },
    }),
  ];

  // Notify the applicant on accept/reject
  if (isOwner && (status === "ACCEPTED" || status === "REJECTED")) {
    const accepted = status === "ACCEPTED";
    ops.push(
      prisma.notification.create({
        data: {
          userId: application.user.id,
          type: notificationType,
          title: accepted ? "Application Accepted! 🎉" : "Application Update",
          body: accepted
            ? `Your application for "${application.role.title}" on "${application.project.title}" was accepted.`
            : `Your application for "${application.role.title}" on "${application.project.title}" was not selected.`,
          link: `/projects/${application.project.id}`,
          metadata: { applicationId: id, projectId: application.project.id },
        },
      }) as never
    );

    // Increment filledCount if accepted
    if (accepted) {
      ops.push(
        prisma.role.update({
          where: { id: application.roleId },
          data: { filledCount: { increment: 1 } },
        }) as never
      );

      // Auto-create a direct conversation between owner and applicant.
      // Normalize user order so the unique constraint works both ways.
      const [userOneId, userTwoId] =
        session.user.id < application.user.id
          ? [session.user.id, application.user.id]
          : [application.user.id, session.user.id];

      // Use a separate upsert outside the transaction to avoid conflicts
      // if a conversation already exists from a previous acceptance.
      try {
        await prisma.directConversation.upsert({
          where: {
            userOneId_userTwoId: { userOneId, userTwoId },
          },
          update: {},
          create: {
            userOneId,
            userTwoId,
            projectId: application.project.id,
          },
        });
      } catch (convErr) {
        // Non-critical: log but don't fail the accept operation
        console.error("Auto-create conversation failed:", convErr);
      }
    }
  }

  try {
    const results = await prisma.$transaction(ops);

    // The application update is at index 0. 
    // If we added a notification (isOwner && accepted/rejected), it will be at index 1.
    const notificationIndex = isOwner && (status === "ACCEPTED" || status === "REJECTED") ? 1 : -1;

    // Publish to the applicant's global notification channel (SSE)
    if (notificationIndex > 0) {
      const notification = results[notificationIndex];
      await publishEvent(userNotificationsChannel(application.user.id), notification);
      
      if (application.user.email) {
        // Automatically use VERCEL_PROJECT_PRODUCTION_URL if deployed to Vercel, else fallback to NEXT_PUBLIC_APP_URL or localhost
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 
          (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
        await sendApplicationStatusEmail({
          to: application.user.email,
          applicantName: application.user.name || "Builder",
          projectTitle: application.project.title,
          roleTitle: application.role.title,
          status: status as "ACCEPTED" | "REJECTED",
          projectOwnerName: application.project.owner.name || "The Project Team",
          projectUrl: `${appUrl}/projects/${application.project.id}`,
        }).catch(console.error); // Fire and forget so we don't block the request
      }
    }

    return NextResponse.json({ success: true, status });
  } catch (err) {
    console.error("PATCH /api/applications/[id] failed:", err);
    return NextResponse.json({ error: "Failed to update application" }, { status: 500 });
  }
  } catch (outerErr) {
    console.error("PATCH /api/applications/[id] unhandled error:", outerErr);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
