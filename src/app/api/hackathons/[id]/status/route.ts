import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { HackathonStatus, VerificationStatus } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

const overrideSchema = z.object({
  /**
   * New lifecycle status to apply.
   * Only CANCELLED is permitted via this endpoint — other statuses are
   * computed automatically by the status engine and the ingestion sync.
   * To re-activate a cancelled event, use "REACTIVATE" which clears the
   * CANCELLED flag and lets the engine recompute from dates.
   */
  action: z.enum(["CANCEL", "REACTIVATE", "FLAG", "VERIFY", "REJECT"]),

  /**
   * Mandatory reason when cancelling, flagging, or rejecting.
   * Stored for audit purposes in verificationStatus.
   */
  reason: z.string().min(5, "Reason must be at least 5 characters").optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/hackathons/[id]/status
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Admin-only endpoint for manual status overrides.
 *
 * Phase 5 rules:
 * - CANCEL:      Sets status → CANCELLED (preserved by runtime engine, never auto-overridden).
 * - REACTIVATE:  Clears CANCELLED → UNKNOWN so runtime engine recomputes from dates.
 * - FLAG:        Sets verificationStatus → FLAGGED (excludes from main feed until reviewed).
 * - VERIFY:      Sets verificationStatus → VERIFIED (clears FLAGGED, data trusted).
 * - REJECT:      Sets verificationStatus → REJECTED (permanently excluded from all feeds).
 *
 * Organizer date changes: When a source updates dates (e.g., reopens registration),
 * the ingestion sync (Phase 4) re-fetches the source record and upserts the new
 * dates. The status engine then recomputes status on the next maintenance run or
 * query. No manual override is needed for organizer date changes.
 */
type Params = Promise<{ id: string }>;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { id } = await params;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Missing hackathon ID" }, { status: 400 });
    }

    // Auth
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Authorization — require ADMIN role
    // @ts-ignore — role may not be typed in default session
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: admin access required" },
        { status: 403 }
      );
    }

    // Parse body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = overrideSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { action, reason } = parsed.data;

    // Require reason for destructive actions
    if (["CANCEL", "FLAG", "REJECT"].includes(action) && !reason) {
      return NextResponse.json(
        { error: `Reason is required for action: ${action}` },
        { status: 400 }
      );
    }

    // Verify hackathon exists
    const existing = await prisma.hackathon.findUnique({
      where: { id },
      select: { id: true, name: true, status: true, verificationStatus: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Hackathon not found" }, { status: 404 });
    }

    // Determine new state
    const updateData: {
      status?: HackathonStatus;
      verificationStatus?: VerificationStatus;
      updatedAt: Date;
    } = { updatedAt: new Date() };

    switch (action) {
      case "CANCEL":
        updateData.status = HackathonStatus.CANCELLED;
        break;

      case "REACTIVATE":
        // Only CANCELLED events can be reactivated
        if (existing.status !== HackathonStatus.CANCELLED) {
          return NextResponse.json(
            { error: "Only CANCELLED events can be reactivated" },
            { status: 400 }
          );
        }
        // Clear CANCELLED; engine will recompute from dates on next query or maintenance run
        updateData.status = HackathonStatus.UNKNOWN;
        break;

      case "FLAG":
        updateData.verificationStatus = VerificationStatus.FLAGGED;
        break;

      case "VERIFY":
        // VERIFIED clears any FLAG; REJECTED cannot be verified without a source re-check
        if (existing.verificationStatus === VerificationStatus.REJECTED) {
          return NextResponse.json(
            { error: "REJECTED events must be re-ingested from source before verification" },
            { status: 400 }
          );
        }
        updateData.verificationStatus = VerificationStatus.VERIFIED;
        break;

      case "REJECT":
        updateData.verificationStatus = VerificationStatus.REJECTED;
        break;
    }

    const updated = await prisma.hackathon.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        status: true,
        verificationStatus: true,
        updatedAt: true,
      },
    });

    console.log(
      `[status-override] Admin ${session.user.email ?? session.user.id} applied action "${action}" to hackathon ${id}` +
        (reason ? ` — reason: ${reason}` : "")
    );

    return NextResponse.json({
      success: true,
      action,
      reason: reason ?? null,
      hackathon: updated,
    });
  } catch (err) {
    console.error(`PATCH /api/hackathons/status failed:`, err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
