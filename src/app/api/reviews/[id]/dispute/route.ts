import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reviewDisputeSchema } from "@/lib/validations";
import { canDisputeReview } from "@/lib/reputation/service";

type Params = Promise<{ id: string }>;

/**
 * POST /api/reviews/[id]/dispute
 * Allows reviewee to dispute a review and route it to the moderation/report queue.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Params }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { id } = await params;

    const existingReview = await prisma.review.findUnique({
      where: { id },
      select: {
        id: true,
        revieweeId: true,
        reviewerId: true,
        isDisputed: true,
      },
    });

    if (!existingReview) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    const check = canDisputeReview(existingReview, userId);
    if (!check.allowed) {
      return NextResponse.json({ error: check.reason }, { status: 403 });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = reviewDisputeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const reason = parsed.data.reason.trim();

    // Mark review as disputed and create moderation Report in a transaction
    const [updatedReview, report] = await prisma.$transaction([
      prisma.review.update({
        where: { id },
        data: {
          isDisputed: true,
          disputeReason: reason,
          disputeStatus: "PENDING",
          disputedAt: new Date(),
        },
      }),
      prisma.report.create({
        data: {
          reporterId: userId,
          reportedUserId: existingReview.reviewerId,
          reviewId: id,
          reason: `Review Dispute: ${reason}`,
          status: "PENDING",
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Dispute submitted to moderation successfully.",
      review: updatedReview,
      reportId: report.id,
    });
  } catch (error) {
    console.error("POST /api/reviews/[id]/dispute failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
