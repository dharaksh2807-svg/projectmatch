import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { checkRateLimit } from "@/lib/redis";

const applicationSchema = z.object({
  roleId: z.string().cuid("roleId must be a valid CUID"),
  message: z.string().max(2000, "Cover message must be ≤ 2000 characters").optional(),
});

/**
 * POST /api/applications
 * Submit an application to a specific role.
 * Creates a Notification for the project owner.
 * Rate-limited to 10/min per user.
 */
export async function POST(req: NextRequest) {
  try {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limiting
  const rl = await checkRateLimit(session.user.id);
  if (!rl.success) {
    const retryAfterSec = rl.reset ? Math.ceil((rl.reset - Date.now()) / 1000) : 60;
    return NextResponse.json(
      {
        error: "Too Many Requests",
        message: "You're applying too fast. Please wait before submitting another application.",
        retryAfter: retryAfterSec,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSec),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = applicationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { roleId, message } = parsed.data;

  try {
    // Validate the role exists and is still open
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        project: {
          select: { id: true, title: true, ownerId: true, isPublished: true },
        },
      },
    });

    if (!role || !role.project.isPublished) {
      return NextResponse.json({ error: "Role not found or project is not active" }, { status: 404 });
    }

    if (!role.isOpen || role.filledCount >= role.headcount) {
      return NextResponse.json({ error: "This role is no longer accepting applications" }, { status: 409 });
    }

    // Prevent self-application
    if (role.project.ownerId === session.user.id) {
      return NextResponse.json({ error: "You cannot apply to your own project" }, { status: 422 });
    }

    // Create application + owner notification in a transaction
    const [application] = await prisma.$transaction([
      prisma.application.create({
        data: {
          userId: session.user.id,
          roleId,
          projectId: role.project.id,
          message: message ?? null,
          status: "PENDING",
        },
      }),
      prisma.notification.create({
        data: {
          userId: role.project.ownerId,
          type: "APPLICATION_RECEIVED",
          title: "New Application Received",
          body: `Someone applied for "${role.title}" on your project "${role.project.title}".`,
          link: `/projects/${role.project.id}`,
          metadata: { roleId, projectId: role.project.id },
        },
      }),
    ]);

    return NextResponse.json(
      {
        success: true,
        applicationId: application.id,
        message: `Application for "${role.title}" submitted successfully.`,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    // Unique constraint: already applied
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "You have already applied for this role." },
        { status: 409 }
      );
    }
    console.error("POST /api/applications failed:", err);
    return NextResponse.json({ error: "Failed to submit application" }, { status: 500 });
  }
  } catch (outerErr) {
    console.error("POST /api/applications unhandled error:", outerErr);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * GET /api/applications
 * Returns applications.
 * - type=received: applications to projects owned by the user (for applicant review)
 * - type=sent (default): applications submitted by the current user
 */
export async function GET(req: NextRequest) {
  try {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  try {
    if (type === "received") {
      const applications = await prisma.application.findMany({
        where: {
          project: {
            ownerId: session.user.id,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              skills: true,
              experienceLevel: true,
              bio: true,
              portfolioUrl: true,
              linkedinUrl: true,
              twitterHandle: true,
              reputationScore: true,
            },
          },
          role: {
            select: {
              id: true,
              title: true,
              requiredSkills: true,
              timeCommitment: true,
              requiredExperienceLevel: true,
              headcount: true,
              filledCount: true,
              isOpen: true,
            },
          },
          project: {
            select: {
              id: true,
              title: true,
              projectType: true,
              ownerId: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json(applications);
    }

    const applications = await prisma.application.findMany({
      where: { userId: session.user.id },
      include: {
        role: {
          select: {
            id: true,
            title: true,
            requiredSkills: true,
            timeCommitment: true,
            requiredExperienceLevel: true,
          },
        },
        project: {
          select: {
            id: true,
            title: true,
            projectType: true,
            owner: { select: { id: true, name: true, image: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(applications);
  } catch (err) {
    console.error("GET /api/applications failed:", err);
    return NextResponse.json({ error: "Failed to fetch applications" }, { status: 500 });
  }
  } catch (outerErr) {
    console.error("GET /api/applications unhandled error:", outerErr);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
