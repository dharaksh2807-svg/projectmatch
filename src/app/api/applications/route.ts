import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { checkAgentMutationRateLimit } from "@/lib/redis";

/**
 * POST /api/applications
 *
 * Accepts a project role application from an authenticated user.
 * Validates the request body using Zod before processing.
 * Returns 401 for guests (the frontend redirects to /login instead).
 */
const applicationSchema = z.object({
  roleId: z.string().min(1, "roleId is required"),
  actionType: z.enum(["APPLY"], { errorMap: () => ({ message: "actionType must be 'APPLY'" }) }),
  message: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 10 application submissions per minute per authenticated user.
  // Shared with agent mutations — combined write-endpoint budget of 10 req/min.
  const rl = await checkAgentMutationRateLimit(session.user.id);
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

  try {
    const body = await req.json();

    const parsed = applicationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // TODO: Replace with real Prisma create once Application model is added
    // await prisma.application.create({ data: { ... } });

    return NextResponse.json(
      {
        success: true,
        message: `Application for role ${parsed.data.roleId} submitted successfully.`,
        applicationId: `app-${Date.now()}`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error processing application:", error);
    return NextResponse.json(
      { error: "Failed to process application" },
      { status: 500 }
    );
  }
}
