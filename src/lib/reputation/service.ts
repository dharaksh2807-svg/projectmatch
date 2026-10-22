import { prisma } from "@/lib/prisma";
import {
  FeedbackDimension,
  ReputationSummary,
  FEEDBACK_DIMENSIONS,
} from "./types";

export const PRIOR_REPUTATION_MEAN = 70.0; // 3.5 out of 5 converted to 0-100 scale
export const PRIOR_CONFIDENCE_WEIGHT = 3.0; // 3 pseudo-reviews
export const MIN_REVIEWS_FOR_CONFIDENCE = 2; // Needs at least 2 reviews to display score without "low data" warning
export const EDIT_WINDOW_HOURS = 48;

export interface ReviewScoreData {
  id?: string;
  reviewerId: string;
  rating: number;
  ratingCommunication?: number | null;
  ratingCollaboration?: number | null;
  ratingReliability?: number | null;
  ratingTechnical?: number | null;
  createdAt?: Date;
}

/**
 * Computes an overall 1-5 star rating from dimensions if not explicitly provided.
 */
export function computeOverallRating(
  communication?: number | null,
  collaboration?: number | null,
  reliability?: number | null,
  technical?: number | null,
  explicitRating?: number
): number {
  if (explicitRating && explicitRating >= 1 && explicitRating <= 5) {
    return Math.round(explicitRating);
  }

  const observed = [communication, collaboration, reliability, technical].filter(
    (v): v is number => typeof v === "number" && v >= 1 && v <= 5
  );

  if (observed.length === 0) {
    return 5; // Default fallback if no dimensions observed
  }

  const sum = observed.reduce((acc, curr) => acc + curr, 0);
  return Math.max(1, Math.min(5, Math.round(sum / observed.length)));
}

/**
 * Calculates Bayesian smoothed reputation score, dimension averages,
 * sample-size confidence, and applies anti-farming decay for repeated collaborators.
 */
export function calculateReputationSummary(
  reviews: ReviewScoreData[],
  completedCollaborationsCount: number = 0
): ReputationSummary {
  const totalReviews = reviews.length;

  const dimensionAverages = {
    communication: { avg: 0, count: 0 },
    collaboration: { avg: 0, count: 0 },
    reliability: { avg: 0, count: 0 },
    technical: { avg: 0, count: 0 },
  };

  // If no reviews, return neutral baseline
  if (totalReviews === 0) {
    return {
      score: 50, // Neutral prior for zero reviews (maps to 0.5 in matchmaking)
      rawAverage: null,
      totalReviews: 0,
      completedCollaborationsCount,
      hasSufficientFeedback: false,
      statusMessage: "Not enough collaboration feedback yet",
      dimensionAverages,
      repeatCollaboratorDiscountApplied: false,
    };
  }

  // Dimension summaries (only include non-null / observed ratings)
  const dimSums: Record<FeedbackDimension, { sum: number; count: number }> = {
    communication: { sum: 0, count: 0 },
    collaboration: { sum: 0, count: 0 },
    reliability: { sum: 0, count: 0 },
    technical: { sum: 0, count: 0 },
  };

  // Sort reviews chronologically to apply repeated collaborator discount fairly
  const sortedReviews = [...reviews].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeA - timeB;
  });

  const reviewerCounts = new Map<string, number>();
  let totalWeightedRatingSum = 0;
  let totalWeights = 0;
  let rawRatingSum = 0;
  let repeatCollaboratorDiscountApplied = false;

  for (const r of sortedReviews) {
    rawRatingSum += r.rating;

    // Repeated collaborator discount:
    // 1st review from reviewer: weight 1.0
    // 2nd review from reviewer: weight 0.5
    // 3rd+ review from reviewer: weight 0.25
    const priorCount = reviewerCounts.get(r.reviewerId) || 0;
    reviewerCounts.set(r.reviewerId, priorCount + 1);

    let weight = 1.0;
    if (priorCount === 1) {
      weight = 0.5;
      repeatCollaboratorDiscountApplied = true;
    } else if (priorCount >= 2) {
      weight = 0.25;
      repeatCollaboratorDiscountApplied = true;
    }

    // Convert 1-5 rating to 0-100 scale: 1 -> 20, 5 -> 100
    const rating100 = r.rating * 20;
    totalWeightedRatingSum += weight * rating100;
    totalWeights += weight;

    // Tally dimensions
    if (typeof r.ratingCommunication === "number" && r.ratingCommunication >= 1) {
      dimSums.communication.sum += r.ratingCommunication;
      dimSums.communication.count += 1;
    }
    if (typeof r.ratingCollaboration === "number" && r.ratingCollaboration >= 1) {
      dimSums.collaboration.sum += r.ratingCollaboration;
      dimSums.collaboration.count += 1;
    }
    if (typeof r.ratingReliability === "number" && r.ratingReliability >= 1) {
      dimSums.reliability.sum += r.ratingReliability;
      dimSums.reliability.count += 1;
    }
    if (typeof r.ratingTechnical === "number" && r.ratingTechnical >= 1) {
      dimSums.technical.sum += r.ratingTechnical;
      dimSums.technical.count += 1;
    }
  }

  // Final dimension averages
  for (const { key } of FEEDBACK_DIMENSIONS) {
    const { sum, count } = dimSums[key];
    dimensionAverages[key] = {
      avg: count > 0 ? Math.round((sum / count) * 10) / 10 : 0,
      count,
    };
  }

  // Bayesian shrinkage formula:
  // Smoothed = (K * PriorMean + sum(w_i * rating_i)) / (K + sum(w_i))
  const smoothedScore =
    (PRIOR_CONFIDENCE_WEIGHT * PRIOR_REPUTATION_MEAN + totalWeightedRatingSum) /
    (PRIOR_CONFIDENCE_WEIGHT + totalWeights);

  const roundedScore = Math.max(0, Math.min(100, Math.round(smoothedScore)));
  const rawAverage = Math.round((rawRatingSum / totalReviews) * 10) / 10;
  const hasSufficientFeedback = totalReviews >= MIN_REVIEWS_FOR_CONFIDENCE;

  const statusMessage = hasSufficientFeedback
    ? `Based on ${totalReviews} verified collaboration ${totalReviews === 1 ? "review" : "reviews"}`
    : "Not enough collaboration feedback yet";

  return {
    score: roundedScore,
    rawAverage,
    totalReviews,
    completedCollaborationsCount,
    hasSufficientFeedback,
    statusMessage,
    dimensionAverages,
    repeatCollaboratorDiscountApplied,
  };
}

/**
 * Validates eligibility for submitting feedback.
 * Strictly verifies shared project participation, milestone/project completion,
 * non-self-review, and duplicate protection.
 */
export async function checkReviewEligibility(
  reviewerId: string,
  revieweeId: string,
  projectId: string
): Promise<{
  eligible: boolean;
  status: number;
  reason?: string;
  project?: { id: string; title: string; status: string };
}> {
  // 1. Self-review check
  if (reviewerId === revieweeId) {
    return {
      eligible: false,
      status: 400,
      reason: "Self-reviews are not permitted. You cannot review your own profile.",
    };
  }

  // 2. Fetch project
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      title: true,
      ownerId: true,
      status: true,
      completedAt: true,
    },
  });

  if (!project) {
    return {
      eligible: false,
      status: 404,
      reason: "Project not found.",
    };
  }

  // 3. Project completion verification
  // Requires explicit project completion or milestone completion to prevent premature or fake ratings
  const isCompleted = project.status === "COMPLETED" || project.completedAt !== null;
  if (!isCompleted) {
    return {
      eligible: false,
      status: 403,
      reason:
        "Feedback can only be submitted for completed collaborations. The project owner must mark the project as completed first.",
    };
  }

  // 4. Team membership verification
  // Both parties must have confirmed membership:
  // Either they are the owner, or an ACCEPTED applicant.
  const reviewerApp = await prisma.application.findFirst({
    where: { projectId, userId: reviewerId, status: "ACCEPTED" },
    select: { id: true },
  });

  const revieweeApp = await prisma.application.findFirst({
    where: { projectId, userId: revieweeId, status: "ACCEPTED" },
    select: { id: true },
  });

  const isReviewerMember = project.ownerId === reviewerId || !!reviewerApp;
  const isRevieweeMember = project.ownerId === revieweeId || !!revieweeApp;

  if (!isReviewerMember || !isRevieweeMember) {
    return {
      eligible: false,
      status: 403,
      reason:
        "Both users must have verifiably collaborated on this project as confirmed team members.",
    };
  }

  // 5. Duplicate review check
  const existingReview = await prisma.review.findUnique({
    where: {
      reviewerId_revieweeId_projectId: {
        reviewerId,
        revieweeId,
        projectId,
      },
    },
    select: { id: true },
  });

  if (existingReview) {
    return {
      eligible: false,
      status: 409,
      reason: "You have already submitted collaboration feedback for this teammate on this project.",
    };
  }

  return {
    eligible: true,
    status: 200,
    project: {
      id: project.id,
      title: project.title,
      status: project.status,
    },
  };
}

/**
 * Checks if a review can be edited (must be original author and within 48h).
 */
export function canEditReview(
  review: { reviewerId: string; createdAt: Date },
  userId: string
): { allowed: boolean; reason?: string } {
  if (review.reviewerId !== userId) {
    return { allowed: false, reason: "Only the author of the review can edit it." };
  }

  const elapsedHours = (Date.now() - new Date(review.createdAt).getTime()) / (1000 * 60 * 60);
  if (elapsedHours > EDIT_WINDOW_HOURS) {
    return {
      allowed: false,
      reason: `Review editing is only permitted within ${EDIT_WINDOW_HOURS} hours of submission.`,
    };
  }

  return { allowed: true };
}

/**
 * Checks if the reviewee can submit an official factual response.
 */
export function canRespondToReview(
  review: { revieweeId: string; responseContent?: string | null },
  userId: string
): { allowed: boolean; reason?: string } {
  if (review.revieweeId !== userId) {
    return { allowed: false, reason: "Only the recipient of the review can submit a response." };
  }

  if (review.responseContent) {
    return {
      allowed: false,
      reason: "A response has already been submitted for this review.",
    };
  }

  return { allowed: true };
}

/**
 * Checks if the reviewee can dispute a review to the moderation queue.
 */
export function canDisputeReview(
  review: { revieweeId: string; isDisputed?: boolean },
  userId: string
): { allowed: boolean; reason?: string } {
  if (review.revieweeId !== userId) {
    return { allowed: false, reason: "Only the recipient of the review can file a dispute." };
  }

  if (review.isDisputed) {
    return {
      allowed: false,
      reason: "This review has already been submitted for dispute and moderation review.",
    };
  }

  return { allowed: true };
}
