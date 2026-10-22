import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import {
  createTeamInvitation,
  getProjectInvitations,
  checkMemoryRateLimit,
} from "@/lib/invitations";
import { checkInviteCreateRateLimit } from "@/lib/redis";

const createInviteSchema = z.object({
  roleId: z.string().optional().nullable(),
  expiresInDays: z.number().min(0.04).max(90).optional().default(7),
  maxUses: z.number().int().min(1).max(100).optional().default(1),
});

type Params = Promise<{ id: string }>;

/**
 * POST /api/projects/[id]/invitations
 * Generates a team invitation link for a specific role or general project invite.
 * Authorized to project owner only.
 * Returns raw token ONCE; stores only the SHA-256 hash.
 */
export async function POST(req: NextRequest, { params }: { params: Params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;

    // Rate limiting (Redis + in-memory fallback for local dev / tests)
    const redisRl = await checkInviteCreateRateLimit(session.user.id);
    const memRl = checkMemoryRateLimit(`invite-create:${session.user.id}`, 10, 10 * 60 * 1000);
    if (!redisRl.success || !memRl.success) {
      return NextResponse.json(
        {
          error: "Too Many Requests",
          message: "You are creating invitations too fast. Please wait before creating another.",
        },
        { status: 429 }
      );
    }

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is allowed, defaults will apply
    }

    const parsed = createInviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { roleId, expiresInDays, maxUses } = parsed.data;

    try {
      const { invitation, token } = await createTeamInvitation({
        projectId,
        inviterId: session.user.id,
        roleId: roleId || null,
        expiresInDays,
        maxUses,
      });

      // Construct absolute URL
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_PROJECT_PRODUCTION_URL
          ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
          : "http://localhost:3000");
      const url = `${appUrl}/invite/${token}`;

      return NextResponse.json(
        {
          success: true,
          invitation,
          token,
          url,
        },
        { status: 201 }
      );
    } catch (err: any) {
      if (err.message === "PROJECT_NOT_FOUND") {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      if (err.message === "UNAUTHORIZED_NOT_OWNER") {
        return NextResponse.json(
          { error: "Forbidden: Only the project owner can generate invitations" },
          { status: 403 }
        );
      }
      if (err.message === "ROLE_NOT_FOUND") {
        return NextResponse.json({ error: "Specified role was not found" }, { status: 404 });
      }
      if (err.message === "ROLE_FULL") {
        return NextResponse.json(
          { error: "The specified role is already full or closed" },
          { status: 409 }
        );
      }
      if (err.message === "TEAM_CAPACITY_EXCEEDED") {
        return NextResponse.json(
          { error: "Team has already reached its maximum capacity for this event" },
          { status: 409 }
        );
      }

      console.error("POST /api/projects/[id]/invitations failed:", err);
      return NextResponse.json({ error: "Failed to create invitation" }, { status: 500 });
    }
  } catch (outerErr) {
    console.error("POST /api/projects/[id]/invitations outer error:", outerErr);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * GET /api/projects/[id]/invitations
 * Lists all active and historical invitations for the project.
 * Authorized to project owner only.
 * Safe listing: never exposes tokens or token hashes.
 */
export async function GET(_req: NextRequest, { params }: { params: Params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;

    try {
      const invitations = await getProjectInvitations(projectId, session.user.id);
      return NextResponse.json({ success: true, invitations });
    } catch (err: any) {
      if (err.message === "PROJECT_NOT_FOUND") {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      if (err.message === "UNAUTHORIZED_NOT_OWNER") {
        return NextResponse.json(
          { error: "Forbidden: Only the project owner can view invitations" },
          { status: 403 }
        );
      }
      console.error("GET /api/projects/[id]/invitations failed:", err);
      return NextResponse.json({ error: "Failed to fetch invitations" }, { status: 500 });
    }
  } catch (outerErr) {
    console.error("GET /api/projects/[id]/invitations outer error:", outerErr);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
