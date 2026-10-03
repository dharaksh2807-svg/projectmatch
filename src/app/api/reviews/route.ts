import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ratingSchema } from "@/lib/validations";

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

    const { projectId, revieweeId, rating, content, skillsEndorsed } = parsed.data;

    // You cannot review yourself
    if (reviewerId === revieweeId) {
      return NextResponse.json({ error: "Cannot review yourself" }, { status: 400 });
    }

    // Verify the project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check if the user is a teammate of the reviewee in this project
    // Either they are the owner and the reviewee was an ACCEPTED applicant,
    // OR they are an ACCEPTED applicant and the reviewee is the owner,
    // OR they are both ACCEPTED applicants.
    const reviewerApp = await prisma.application.findFirst({
      where: { projectId, userId: reviewerId, status: "ACCEPTED" },
    });
    
    const revieweeApp = await prisma.application.findFirst({
      where: { projectId, userId: revieweeId, status: "ACCEPTED" },
    });

    const isReviewerParticipant = project.ownerId === reviewerId || reviewerApp;
    const isRevieweeParticipant = project.ownerId === revieweeId || revieweeApp;

    if (!isReviewerParticipant || !isRevieweeParticipant) {
      return NextResponse.json(
        { error: "Both users must have participated in the project" },
        { status: 403 }
      );
    }

    // Check if review already exists
    const existingReview = await prisma.review.findUnique({
      where: {
        reviewerId_revieweeId_projectId: {
          reviewerId,
          revieweeId,
          projectId,
        },
      },
    });

    if (existingReview) {
      return NextResponse.json(
        { error: "You have already reviewed this user for this project" },
        { status: 409 }
      );
    }

    // Create the review
    const review = await prisma.review.create({
      data: {
        reviewerId,
        revieweeId,
        projectId,
        rating,
        content: content || null,
        skillsEndorsed,
      },
    });

    // Update the reviewee's reputation score (simple average of all ratings * 20 to make it 0-100)
    // In a real app, this formula might be more complex.
    const allReviews = await prisma.review.findMany({
      where: { revieweeId },
      select: { rating: true },
    });

    if (allReviews.length > 0) {
      const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
      const newScore = Math.min(Math.round(avgRating * 20), 100);

      await prisma.user.update({
        where: { id: revieweeId },
        data: { reputationScore: newScore },
      });
    }

    return NextResponse.json({ success: true, review }, { status: 201 });
  } catch (error) {
    console.error("POST /api/reviews failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
