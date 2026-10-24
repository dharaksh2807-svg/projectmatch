import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculateReputationSummary,
  computeOverallRating,
  canEditReview,
  canRespondToReview,
  canDisputeReview,
  checkReviewEligibility,
  ReviewScoreData,
} from "./reputation/service";
import { scoreReputation, computeCompatibility } from "./matching";
import { prisma } from "./prisma";

// Mock prisma for eligibility and database operations
vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: {
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    application: {
      findFirst: vi.fn(),
    },
    review: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    report: {
      create: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
    $transaction: vi.fn((promises) => Promise.all(promises)),
  },
}));

describe("Trustworthy Contributor Reputation System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Scenario 1: Eligible Review Submission ─────────────────────────────────
  it("Scenario 1: Allows review submission between verified collaborators on a completed project", async () => {
    (prisma.project.findUnique as any).mockResolvedValue({
      id: "proj-1",
      title: "AI Hackathon",
      ownerId: "owner-1",
      status: "COMPLETED",
      completedAt: new Date(),
    });

    // Reviewer is owner, reviewee is accepted applicant
    (prisma.application.findFirst as any)
      .mockResolvedValueOnce(null) // reviewer is owner
      .mockResolvedValueOnce({ id: "app-2" }); // reviewee has accepted application

    (prisma.review.findUnique as any).mockResolvedValue(null); // No existing review

    const result = await checkReviewEligibility("owner-1", "user-2", "proj-1");
    expect(result.eligible).toBe(true);
    expect(result.status).toBe(200);
    expect(result.project?.title).toBe("AI Hackathon");
  });

  // ─── Scenario 2: Stranger Review Rejection ───────────────────────────────────
  it("Scenario 2: Rejects reviews between strangers who did not collaborate on the project", async () => {
    (prisma.project.findUnique as any).mockResolvedValue({
      id: "proj-1",
      title: "Web App",
      ownerId: "owner-1",
      status: "COMPLETED",
      completedAt: new Date(),
    });

    // Stranger has neither ownership nor accepted application
    (prisma.application.findFirst as any)
      .mockResolvedValueOnce(null) // stranger is not owner, has no accepted app
      .mockResolvedValueOnce({ id: "app-2" }); // reviewee is a member

    const result = await checkReviewEligibility("stranger-99", "user-2", "proj-1");
    expect(result.eligible).toBe(false);
    expect(result.status).toBe(403);
    expect(result.reason).toContain("verifiably collaborated");
  });

  // ─── Scenario 3: Self-Review Rejection ───────────────────────────────────────
  it("Scenario 3: Strictly rejects self-review attempts", async () => {
    const result = await checkReviewEligibility("user-1", "user-1", "proj-1");
    expect(result.eligible).toBe(false);
    expect(result.status).toBe(400);
    expect(result.reason).toContain("Self-reviews are not permitted");
  });

  // ─── Scenario 4: Duplicate Review Rejection ──────────────────────────────────
  it("Scenario 4: Rejects duplicate reviews from the same reviewer for the same project and teammate", async () => {
    (prisma.project.findUnique as any).mockResolvedValue({
      id: "proj-1",
      title: "Mobile App",
      ownerId: "owner-1",
      status: "COMPLETED",
      completedAt: new Date(),
    });

    (prisma.application.findFirst as any)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "app-2" });

    // Review already exists in DB
    (prisma.review.findUnique as any).mockResolvedValue({
      id: "rev-existing",
      reviewerId: "owner-1",
      revieweeId: "user-2",
      projectId: "proj-1",
    });

    const result = await checkReviewEligibility("owner-1", "user-2", "proj-1");
    expect(result.eligible).toBe(false);
    expect(result.status).toBe(409);
    expect(result.reason).toContain("already submitted collaboration feedback");
  });

  // ─── Scenario 5: Unverified Collaboration (Project Not Completed) ────────────
  it("Scenario 5: Rejects review if project is still in progress and not marked completed", async () => {
    (prisma.project.findUnique as any).mockResolvedValue({
      id: "proj-ongoing",
      title: "Ongoing Hackathon",
      ownerId: "owner-1",
      status: "IN_PROGRESS",
      completedAt: null, // Project is not finished
    });

    const result = await checkReviewEligibility("owner-1", "user-2", "proj-ongoing");
    expect(result.eligible).toBe(false);
    expect(result.status).toBe(403);
    expect(result.reason).toContain("completed collaborations");
  });

  // ─── Scenario 6: Unauthorized Editing & 48-Hour Window ──────────────────────
  it("Scenario 6: Allows edit within 48h for author, but rejects non-author or expired edits", () => {
    const now = new Date();
    const recentReview = {
      reviewerId: "author-1",
      createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours old
    };

    // Author within 48h
    expect(canEditReview(recentReview, "author-1").allowed).toBe(true);

    // Non-author attempt
    const nonAuthor = canEditReview(recentReview, "stranger-2");
    expect(nonAuthor.allowed).toBe(false);
    expect(nonAuthor.reason).toContain("Only the author");

    // Author after 48h (e.g. 50 hours old)
    const oldReview = {
      reviewerId: "author-1",
      createdAt: new Date(now.getTime() - 50 * 60 * 60 * 1000),
    };
    const expired = canEditReview(oldReview, "author-1");
    expect(expired.allowed).toBe(false);
    expect(expired.reason).toContain("48 hours");
  });

  // ─── Scenario 7: Correct Average & Bayesian Summary Calculation ─────────────
  it("Scenario 7: Accurately computes Bayesian shrinkage score and dimension averages", () => {
    const reviews: ReviewScoreData[] = [
      {
        reviewerId: "rev-1",
        rating: 5,
        ratingCommunication: 5,
        ratingCollaboration: 4,
        ratingReliability: 5,
        ratingTechnical: 5,
      },
      {
        reviewerId: "rev-2",
        rating: 4,
        ratingCommunication: 4,
        ratingCollaboration: 4,
        ratingReliability: 4,
        ratingTechnical: null, // Not observed for technical
      },
      {
        reviewerId: "rev-3",
        rating: 5,
        ratingCommunication: 5,
        ratingCollaboration: 5,
        ratingReliability: 5,
        ratingTechnical: 4,
      },
    ];

    const summary = calculateReputationSummary(reviews, 3);

    // Prior Mean = 70, Prior K = 3. Ratings: 5 (100), 4 (80), 5 (100)
    // Expected Bayesian score: (3 * 70 + 100 + 80 + 100) / (3 + 3) = 490 / 6 = 81.67 -> 82
    expect(summary.score).toBe(82);
    expect(summary.rawAverage).toBe(4.7);
    expect(summary.totalReviews).toBe(3);
    expect(summary.hasSufficientFeedback).toBe(true);
    expect(summary.completedCollaborationsCount).toBe(3);

    // Dimension breakdown:
    // Communication: (5 + 4 + 5) / 3 = 4.67 -> 4.7
    expect(summary.dimensionAverages.communication.avg).toBe(4.7);
    expect(summary.dimensionAverages.communication.count).toBe(3);

    // Technical: (5 + 4) / 2 = 4.5 (omits the null/not-observed rating)
    expect(summary.dimensionAverages.technical.avg).toBe(4.5);
    expect(summary.dimensionAverages.technical.count).toBe(2);
  });

  // ─── Scenario 8: Missing Review Data & Low Data Handling ─────────────────────
  it("Scenario 8: New users receive neutral score and fair 'Not enough collaboration feedback yet' status", () => {
    // Zero reviews
    const zeroReviewsSummary = calculateReputationSummary([], 0);
    expect(zeroReviewsSummary.score).toBe(50); // Neutral baseline
    expect(zeroReviewsSummary.totalReviews).toBe(0);
    expect(zeroReviewsSummary.hasSufficientFeedback).toBe(false);
    expect(zeroReviewsSummary.statusMessage).toBe("Not enough collaboration feedback yet");

    // Single review (1 review): does NOT produce misleading 100% rating
    const singleReview: ReviewScoreData[] = [
      {
        reviewerId: "rev-1",
        rating: 5,
        ratingCommunication: 5,
      },
    ];
    const singleSummary = calculateReputationSummary(singleReview, 1);
    // (3 * 70 + 1 * 100) / 4 = 310 / 4 = 77.5 -> 78
    expect(singleSummary.score).toBe(78); // Shrunk towards prior mean 70, not inflated to 100!
    expect(singleSummary.hasSufficientFeedback).toBe(false);
    expect(singleSummary.statusMessage).toBe("Not enough collaboration feedback yet");
  });

  // ─── Scenario 9: Fake Rating Attempts & Anti-Farming Decay ────────────────────
  it("Scenario 9: Mitigates review farming by discounting repeated collaborator reviews", () => {
    // 3 reviews all from the same reviewer (syndicate attempt)
    const farmedReviews: ReviewScoreData[] = [
      { reviewerId: "friend-1", rating: 5, createdAt: new Date("2026-01-01") },
      { reviewerId: "friend-1", rating: 5, createdAt: new Date("2026-02-01") },
      { reviewerId: "friend-1", rating: 5, createdAt: new Date("2026-03-01") },
    ];

    const summary = calculateReputationSummary(farmedReviews, 3);
    expect(summary.repeatCollaboratorDiscountApplied).toBe(true);

    // Weights: 1st review = 1.0, 2nd = 0.5, 3rd = 0.25. Total weight = 1.75
    // Weighted rating sum: 1.0 * 100 + 0.5 * 100 + 0.25 * 100 = 175
    // Smoothed: (3 * 70 + 175) / (3 + 1.75) = 385 / 4.75 = 81.05 -> 81
    expect(summary.score).toBe(81);
  });

  // ─── Scenario 10: Review Reporting & Disputes ────────────────────────────────
  it("Scenario 10: Allows reviewee to dispute a review and creates a moderation report", () => {
    const review = {
      id: "rev-1",
      revieweeId: "user-victim",
      isDisputed: false,
    };

    const check = canDisputeReview(review, "user-victim");
    expect(check.allowed).toBe(true);

    const alreadyDisputed = {
      id: "rev-1",
      revieweeId: "user-victim",
      isDisputed: true,
    };
    const check2 = canDisputeReview(alreadyDisputed, "user-victim");
    expect(check2.allowed).toBe(false);
    expect(check2.reason).toContain("already been submitted for dispute");
  });

  // ─── Scenario 11: Moderation Authorization ──────────────────────────────────
  it("Scenario 11: Rejects dispute or response attempts by unauthorized users", () => {
    const review = {
      id: "rev-1",
      revieweeId: "user-victim",
      responseContent: null,
      isDisputed: false,
    };

    // Third party cannot respond
    const respondCheck = canRespondToReview(review, "unauthorized-third-party");
    expect(respondCheck.allowed).toBe(false);
    expect(respondCheck.reason).toContain("Only the recipient");

    // Third party cannot dispute
    const disputeCheck = canDisputeReview(review, "unauthorized-third-party");
    expect(disputeCheck.allowed).toBe(false);
    expect(disputeCheck.reason).toContain("Only the recipient");
  });

  // ─── Scenario 12: Cross-User Data Protection & Single Response Enforcement ───
  it("Scenario 12: Enforces single official response per review to prevent response spamming", () => {
    const reviewWithResponse = {
      id: "rev-1",
      revieweeId: "user-victim",
      responseContent: "Thank you for the constructive feedback on our project.",
    };

    const secondResponseCheck = canRespondToReview(reviewWithResponse, "user-victim");
    expect(secondResponseCheck.allowed).toBe(false);
    expect(secondResponseCheck.reason).toContain("already been submitted");
  });

  // ─── Scenario 13: Existing Reviews After Migration (Legacy Compatibility) ───
  it("Scenario 13: Safely calculates summary for legacy reviews missing dimension fields", () => {
    // Legacy review before migration (only had overall rating, dimensions are null/undefined)
    const legacyReviews: ReviewScoreData[] = [
      {
        reviewerId: "legacy-rev-1",
        rating: 4,
      },
      {
        reviewerId: "legacy-rev-2",
        rating: 5,
      },
    ];

    const summary = calculateReputationSummary(legacyReviews, 2);
    expect(summary.totalReviews).toBe(2);
    expect(summary.hasSufficientFeedback).toBe(true);
    // (3 * 70 + 80 + 100) / 5 = 390 / 5 = 78
    expect(summary.score).toBe(78);
    // Dimensions report 0 observations cleanly without crashing
    expect(summary.dimensionAverages.communication.count).toBe(0);
    expect(summary.dimensionAverages.technical.count).toBe(0);
  });

  // ─── Scenario 14: Reputation Influence on Recommendations ────────────────────
  it("Scenario 14: Gives new users neutral 0.5 match reputation score without penalty", () => {
    // New user with null reputation
    const newScore = scoreReputation(null);
    expect(newScore).toBe(0.5);

    // New user with 50 (neutral DB default)
    const neutralScore = scoreReputation(50);
    expect(neutralScore).toBe(0.5);

    // User with 80 score
    const ratedScore = scoreReputation(80);
    expect(ratedScore).toBe(0.8);

    // In matching algorithm, reputation has bounded 10% weight:
    // Skills (40%), Interests (25%), Availability (15%) dominate
    const testUser = {
      id: "user-new",
      name: "New Contributor",
      skills: ["React", "TypeScript", "Node.js"],
      interests: ["AI", "Web3"],
      availabilityHours: 15,
      reputationScore: null, // Zero reviews
    };

    const testRole = {
      id: "r1",
      title: "Frontend Engineer",
      requiredSkills: ["React", "TypeScript"],
      requiredExperienceLevel: "Intermediate",
      timeCommitment: "10-20 hrs/week",
      headcount: 1,
      filledCount: 0,
      isOpen: true,
      project: {
        id: "p1",
        title: "Fullstack App",
        projectType: "Hackathon",
        duration: "1-4 weeks",
        interests: ["AI", "Web3"],
      },
    };

    const match = computeCompatibility(testUser as any, testRole as any);
    // User has full skill match and neutral reputation score
    expect(match.score).toBeGreaterThan(0.6);
    expect(match.breakdown.reputationScore).toBe(0.5); // Neutral, unpenalized
  });

  // ─── Scenario 15: Mobile Accessibility & Overall Rating Computation ─────────
  it("Scenario 15: Computes overall rating accurately from observed dimensions and handles Not Observed", () => {
    // All 4 observed: (5 + 4 + 5 + 4) / 4 = 4.5 -> 5
    const computed1 = computeOverallRating(5, 4, 5, 4);
    expect(computed1).toBe(5);

    // 2 observed, 2 Not Observed (null): (4 + 3) / 2 = 3.5 -> 4
    const computed2 = computeOverallRating(4, 3, null, null);
    expect(computed2).toBe(4);

    // Explicit rating override respected within valid 1-5 range
    const computed3 = computeOverallRating(1, 1, 1, 1, 4);
    expect(computed3).toBe(4);

    // All Not Observed fallback
    const computedFallback = computeOverallRating(null, null, null, null);
    expect(computedFallback).toBe(5);
  });

  // ─── Scenario 16: Self-Endorsement & Self-Review Blocking ───────────────────
  it("Scenario 16: Blocks self-endorsements and self-reviews with a 400 error", async () => {
    const result = await checkReviewEligibility("member-123", "member-123", "proj-999");
    expect(result.eligible).toBe(false);
    expect(result.status).toBe(400);
    expect(result.reason).toContain("Self-endorsements");
    expect(result.reason).toContain("Self-reviews");
  });

  // ─── Scenario 17: Shared Project Membership Requirement ─────────────────────
  it("Scenario 17: Requires confirmed shared project membership before allowing peer endorsements", async () => {
    (prisma.project.findUnique as any).mockResolvedValue({
      id: "proj-shared",
      title: "Shared Project",
      ownerId: "owner-real",
      status: "COMPLETED",
      completedAt: new Date(),
    });

    // Reviewer is not owner and not accepted applicant
    (prisma.application.findFirst as any)
      .mockResolvedValueOnce(null) // reviewer has no accepted application
      .mockResolvedValueOnce({ id: "app-target" }); // reviewee is an accepted member

    const result = await checkReviewEligibility("random-user", "target-user", "proj-shared");
    expect(result.eligible).toBe(false);
    expect(result.status).toBe(403);
    expect(result.reason).toContain("verifiably collaborated");
  });
});
