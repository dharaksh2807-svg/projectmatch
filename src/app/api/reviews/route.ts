import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ratingSchema } from "@/lib/validations";
import {
  checkReviewEligibility,
  computeOverallRating,
  calculateReputationSummary,
} from "@/lib/reputation/service";

/**
 * POST /api/reviews
 * Submits structured collaboration feedback with behavioral dimensions.
 * Strictly verifies eligibility: shared team membership, completed project, non-self, no duplicates.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reviewerId = session.user.id;

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = ratingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const {
      projectId,
      revieweeId,
      rating,
      ratingCommunication,
      ratingCollaboration,
      ratingReliability,
      ratingTechnical,
      content,
      skillsEndorsed,
    } = parsed.data;

    if (!revieweeId) {
      return NextResponse.json({ error: "Reviewee ID is required" }, { status: 400 });
    }

    // Eligibility check (teammate verification, project completion, non-self, no duplicate)
    const eligibility = await checkReviewEligibility(reviewerId, revieweeId, projectId);
    if (!eligibility.eligible) {
      return NextResponse.json({ error: eligibility.reason }, { status: eligibility.status });
    }

    // Compute overall rating if not explicitly supplied or average from dimensions
    const computedRating = computeOverallRating(
      ratingCommunication,
      ratingCollaboration,
      ratingReliability,
      ratingTechnical,
      rating
    );

    // Create review in database
    const review = await prisma.review.create({
      data: {
        reviewerId,
        revieweeId,
        projectId,
        rating: computedRating,
        ratingCommunication,
        ratingCollaboration,
        ratingReliability,
        ratingTechnical,
        content: content ? content.trim() : null,
        skillsEndorsed,
      },
      include: {
        reviewer: {
          select: { id: true, name: true, image: true },
        },
        project: {
          select: { id: true, title: true },
        },
      },
    });

    // Recompute reviewee's reputation score with Bayesian shrinkage & repeated collaborator decay
    const allReviews = await prisma.review.findMany({
      where: { revieweeId },
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
          { ownerId: revieweeId },
          { applications: { some: { userId: revieweeId, status: "ACCEPTED" } } },
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
      where: { id: revieweeId },
      data: { reputationScore: summary.score },
    });

    return NextResponse.json(
      {
        success: true,
        review,
        reputationSummary: summary,
        newReputationScore: summary.score,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/reviews failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * GET /api/reviews
 * Returns reviews and reputation summary for a user (?userId=...) or eligible reviewees.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId parameter is required" }, { status: 400 });
    }

    const reviews = await prisma.review.findMany({
      where: { revieweeId: userId },
      include: {
        reviewer: {
          select: { id: true, name: true, image: true, experienceLevel: true },
        },
        project: {
          select: { id: true, title: true, status: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const completedProjectsCount = await prisma.project.count({
      where: {
        OR: [
          { ownerId: userId },
          { applications: { some: { userId, status: "ACCEPTED" } } },
        ],
        AND: [
          {
            OR: [{ status: "COMPLETED" }, { completedAt: { not: null } }],
          },
        ],
      },
    });

    const summary = calculateReputationSummary(reviews, completedProjectsCount);

    return NextResponse.json({
      reviews,
      summary,
    });
  } catch (error) {
    console.error("GET /api/reviews failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
