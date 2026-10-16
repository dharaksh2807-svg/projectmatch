import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hackathonIngestionEngine } from "@/lib/hackathons";

/**
 * Validates whether the incoming request is authorized to trigger hackathon synchronization.
 * Accepts:
 * 1. Vercel Cron (Authorization: Bearer <CRON_SECRET>)
 * 2. Authenticated user with role === "ADMIN"
 * 3. Local development without auth (if explicitly enabled in non-prod)
 */
async function isAuthorized(req: NextRequest): Promise<{ authorized: boolean; triggeredBy: string }> {
  // 1. Check for Vercel Cron Secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { authorized: true, triggeredBy: "vercel-cron" };
  }

  // 2. Check for logged-in Admin user
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      // If user has admin role or in development
      const role = (session.user as { role?: string }).role;
      if (role === "ADMIN") {
        return { authorized: true, triggeredBy: `admin:${session.user.id}` };
      }
      // If development environment, allow logged-in users to trigger sync for testing
      if (process.env.NODE_ENV === "development") {
        return { authorized: true, triggeredBy: `dev-user:${session.user.id}` };
      }
    }
  } catch {
    // Session check failed
  }

  // 3. Fallback for local manual testing if no CRON_SECRET is set
  if (process.env.NODE_ENV === "development" && !cronSecret) {
    return { authorized: true, triggeredBy: "dev-local" };
  }

  return { authorized: false, triggeredBy: "unauthorized" };
}

/**
 * POST /api/hackathons/sync
 * Triggers hackathon discovery and synchronization.
 * Supports:
 * - fullSync: boolean (fetches all historical events if supported by source)
 * - source: string (sync only a specific source, e.g. "hackclub", "kaggle")
 */
export async function POST(req: NextRequest) {
  try {
    const { authorized, triggeredBy } = await isAuthorized(req);
    if (!authorized) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid CRON_SECRET or administrative privileges required" },
        { status: 401 }
      );
    }

    // Parse options from query parameters or JSON body
    const searchParams = req.nextUrl.searchParams;
    let fullSync = searchParams.get("fullSync") === "true";
    let sourceId = searchParams.get("source") || undefined;

    try {
      const body = await req.json();
      if (body) {
        if (typeof body.fullSync === "boolean") fullSync = body.fullSync;
        if (typeof body.source === "string") sourceId = body.source;
      }
    } catch {
      // Body is empty or not JSON, fallback to query params
    }

    if (sourceId) {
      const outcome = await hackathonIngestionEngine.syncSource(sourceId, {
        fullSync,
        triggeredBy,
      });
      return NextResponse.json({
        success: outcome.status !== "FAILED",
        mode: "single-source",
        outcome,
      });
    }

    const summary = await hackathonIngestionEngine.syncAll({
      fullSync,
      triggeredBy,
    });

    return NextResponse.json({
      success: summary.success,
      mode: "all-sources",
      summary,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("POST /api/hackathons/sync error:", err);
    return NextResponse.json(
      { error: "Synchronization failed", details: message },
      { status: 500 }
    );
  }
}
