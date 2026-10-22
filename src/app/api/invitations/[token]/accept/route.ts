import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { acceptTeamInvitation, checkMemoryRateLimit } from "@/lib/invitations";
import { checkInviteRedeemRateLimit } from "@/lib/redis";

const acceptSchema = z.object({
  roleId: z.string().optional().nullable(),
  message: z.string().max(1000).optional().nullable(),
});

type Params = Promise<{ token: string }>;

/**
 * POST /api/invitations/[token]/accept
 * Accepts a team invitation.
 * Mandatory checks & transaction-safe row updates ensure capacity limits are strictly enforced.
 */
export async function POST(req: NextRequest, { params }: { params: Params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "You must be logged in to accept a team invitation",
          code: "UNAUTHENTICATED",
        },
        { status: 401 }
      );
    }

    const { token } = await params;
    if (!token || typeof token !== "string" || token.length < 16) {
      return NextResponse.json(
        { error: "Invalid invitation token format", code: "INVALID_TOKEN" },
        { status: 400 }
      );
    }

    // Rate limiting for redemptions
    const rateLimitIdentifier = `user:${session.user.id}`;
    const redisRl = await checkInviteRedeemRateLimit(rateLimitIdentifier);
    const memRl = checkMemoryRateLimit(`invite-redeem:${session.user.id}`, 10, 10 * 60 * 1000);

    if (!redisRl.success || !memRl.success) {
      return NextResponse.json(
        {
          error: "Too Many Requests",
          message: "You are attempting to redeem invitations too quickly. Please wait a moment.",
        },
        { status: 429 }
      );
    }

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional
    }

    const parsed = acceptSchema.safeParse(body);
    const roleId = parsed.success ? parsed.data.roleId : null;
    const message = parsed.success ? parsed.data.message ?? undefined : undefined;

    try {
      const result = await acceptTeamInvitation({
        rawToken: token,
        userId: session.user.id,
        roleId,
        message,
      });

      return NextResponse.json(
        {
          success: true,
          message: `Successfully joined ${result.projectTitle} as ${result.roleTitle}!`,
          projectId: result.projectId,
          roleId: result.roleId,
        },
        {
          status: 200,
          headers: {
            "Referrer-Policy": "no-referrer",
            "Cache-Control": "no-store, private",
          },
        }
      );
    } catch (err: any) {
      const code = err.message || "UNKNOWN_ERROR";

      switch (code) {
        case "INVALID_TOKEN":
          return NextResponse.json(
            { error: "Invitation not found or invalid token", code },
            { status: 404 }
          );

        case "INVITATION_REVOKED":
          return NextResponse.json(
            { error: "This invitation link was revoked by the project owner", code },
            { status: 410 }
          );

        case "INVITATION_EXPIRED":
          return NextResponse.json(
            { error: "This invitation link has expired", code },
            { status: 410 }
          );

        case "INVITATION_EXHAUSTED":
          return NextResponse.json(
            { error: "This invitation link has reached its maximum number of uses", code },
            { status: 410 }
          );

        case "PROJECT_NOT_ACTIVE":
          return NextResponse.json(
            { error: "This project is no longer actively accepting teammates", code },
            { status: 404 }
          );

        case "OWNER_LOST_AUTHORIZATION":
          return NextResponse.json(
            { error: "The inviter is no longer authorized to manage this project", code },
            { status: 403 }
          );

        case "OWNER_CANNOT_JOIN":
          return NextResponse.json(
            { error: "You are already the owner of this project and cannot join as a teammate", code },
            { status: 400 }
          );

        case "ALREADY_A_MEMBER":
          return NextResponse.json(
            { error: "You are already an accepted member of this team", code },
            { status: 409 }
          );

        case "ROLE_REQUIRED":
          return NextResponse.json(
            { error: "Please select an available role to join this project", code },
            { status: 400 }
          );

        case "ROLE_NOT_FOUND":
          return NextResponse.json(
            { error: "Selected role does not exist on this project", code },
            { status: 404 }
          );

        case "ROLE_FULL":
          return NextResponse.json(
            { error: "This role has already been filled and is no longer accepting new members", code },
            { status: 409 }
          );

        case "TEAM_CAPACITY_EXCEEDED":
          return NextResponse.json(
            { error: "The team has reached the maximum permitted team size for this event", code },
            { status: 409 }
          );

        case "USER_BANNED":
          return NextResponse.json(
            { error: "Your account is not permitted to join teams", code },
            { status: 403 }
          );

        default:
          console.error("acceptTeamInvitation unexpected error:", err);
          return NextResponse.json(
            { error: "Failed to accept invitation. Please try again.", code },
            { status: 500 }
          );
      }
    }
  } catch (outerErr) {
    console.error("POST /api/invitations/[token]/accept unhandled outer error:", outerErr);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
