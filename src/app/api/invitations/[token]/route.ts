import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { inspectInvitationByToken, checkMemoryRateLimit } from "@/lib/invitations";
import { checkInviteRedeemRateLimit } from "@/lib/redis";

type Params = Promise<{ token: string }>;

/**
 * GET /api/invitations/[token]
 * Inspects an invitation link.
 * Publicly viewable (unauthenticated visitors can see project & role details).
 * Prevents enumeration via rate limiting.
 * Protects against token leaking via Referrer-Policy and Cache-Control headers.
 */
export async function GET(req: NextRequest, { params }: { params: Params }) {
  try {
    const { token } = await params;

    if (!token || typeof token !== "string" || token.length < 16) {
      return NextResponse.json(
        { valid: false, error: "Invalid invitation token format" },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    // Rate limiting to prevent token enumeration & brute-force attacks
    const clientIp = req.headers.get("x-forwarded-for") || "anonymous";
    const rateLimitIdentifier = userId ? `user:${userId}` : `ip:${clientIp}`;

    const redisRl = await checkInviteRedeemRateLimit(rateLimitIdentifier);
    const memRl = checkMemoryRateLimit(`invite-lookup:${rateLimitIdentifier}`, 20, 10 * 60 * 1000);

    if (!redisRl.success || !memRl.success) {
      return NextResponse.json(
        {
          error: "Too Many Requests",
          message: "Too many requests. Please slow down.",
        },
        { status: 429 }
      );
    }

    const result = await inspectInvitationByToken(token, userId);

    if (!result.found) {
      return NextResponse.json(
        {
          valid: false,
          error: "Invitation not found or link has expired",
          code: "NOT_FOUND",
        },
        {
          status: 404,
          headers: {
            "Referrer-Policy": "no-referrer",
            "Cache-Control": "no-store, private",
          },
        }
      );
    }

    return NextResponse.json(result, {
      status: 200,
      headers: {
        "Referrer-Policy": "no-referrer",
        "Cache-Control": "no-store, private",
      },
    });
  } catch (err) {
    console.error("GET /api/invitations/[token] failed:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
