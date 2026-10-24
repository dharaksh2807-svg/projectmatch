import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reviewEditSchema } from "@/lib/validations";
import {
  canEditReview,
  computeOverallRating,
  calculateReputationSummary,
} from "@/lib/reputation/service";

type Params = Promise<{ id: string }>;

/**
 * GET /api/reviews/[id]
 * Fetch a single review by ID.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { id } = await params;
    const review = await prisma.review.findUnique({
      where: { id },
      include: {
        reviewer: {
          select: { id: true, name: true, image: true, experienceLevel: true },
        },
        project: {
          select: { id: true, title: true, status: true },
        },
      },
    });

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    return NextResponse.json({ review });
  } catch (error) {
    console.error("GET /api/reviews/[id] failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * PUT /api/reviews/[id]
 * Edit an existing review within the 48-hour window.
 */
export async function PUT(
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
    });

    if (!existingReview) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    // Check if editing is permitted
    const editCheck = canEditReview(existingReview, userId);
    if (!editCheck.allowed) {
      return NextResponse.json({ error: editCheck.reason }, { status: 403 });
    }

    // Block self-reviews and self-endorsements
    if (userId === existingReview.revieweeId || existingReview.reviewerId === existingReview.revieweeId) {
      return NextResponse.json(
        { error: "Self-endorsements and self-reviews are not permitted." },
        { status: 403 }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = reviewEditSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const {
      rating,
      ratingCommunication,
      ratingCollaboration,
      ratingReliability,
      ratingTechnical,
      content,
      skillsEndorsed,
    } = parsed.data;

    const newRating = computeOverallRating(
      ratingCommunication !== undefined ? ratingCommunication : existingReview.ratingCommunication,
      ratingCollaboration !== undefined ? ratingCollaboration : existingReview.ratingCollaboration,
      ratingReliability !== undefined ? ratingReliability : existingReview.ratingReliability,
      ratingTechnical !== undefined ? ratingTechnical : existingReview.ratingTechnical,
      rating !== undefined ? rating : existingReview.rating
    );

    const updatedReview = await prisma.review.update({
      where: { id },
      data: {
        rating: newRating,
        ratingCommunication:
          ratingCommunication !== undefined ? ratingCommunication : existingReview.ratingCommunication,
        ratingCollaboration:
          ratingCollaboration !== undefined ? ratingCollaboration : existingReview.ratingCollaboration,
        ratingReliability:
          ratingReliability !== undefined ? ratingReliability : existingReview.ratingReliability,
        ratingTechnical:
          ratingTechnical !== undefined ? ratingTechnical : existingReview.ratingTechnical,
        content: content !== undefined ? content.trim() : existingReview.content,
        skillsEndorsed: skillsEndorsed !== undefined ? skillsEndorsed : existingReview.skillsEndorsed,
        isEdited: true,
        editedAt: new Date(),
      },
      include: {
        reviewer: { select: { id: true, name: true, image: true } },
        project: { select: { id: true, title: true } },
      },
    });

    // Recalculate reviewee's reputation score
    const allReviews = await prisma.review.findMany({
      where: { revieweeId: existingReview.revieweeId },
      select: {
        id: true,
        reviewerId: true,
        rating: true,
        ratingCommunication: true,
        ratingCollaboration: true,
        ratingReliability: true,
        ratingTechnical: true,
        createdAt: true,
      },
    });

    const completedProjectsCount = await prisma.project.count({
      where: {
        OR: [
          { ownerId: existingReview.revieweeId },
          { applications: { some: { userId: existingReview.revieweeId, status: "ACCEPTED" } } },
        ],
        AND: [
          {
            OR: [{ status: "COMPLETED" }, { completedAt: { not: null } }],
          },
        ],
      },
    });

    const summary = calculateReputationSummary(allReviews, completedProjectsCount);

    await prisma.user.update({
      where: { id: existingReview.revieweeId },
      data: { reputationScore: summary.score },
    });

    return NextResponse.json({
      success: true,
      review: updatedReview,
      reputationSummary: summary,
    });
  } catch (error) {
    console.error("PUT /api/reviews/[id] failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
