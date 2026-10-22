export type FeedbackDimension =
  | "communication"
  | "collaboration"
  | "reliability"
  | "technical";

export interface DimensionConfig {
  key: FeedbackDimension;
  label: string;
  description: string;
}

export const FEEDBACK_DIMENSIONS: DimensionConfig[] = [
  {
    key: "communication",
    label: "Communication",
    description: "Was communication clear, responsive, and constructive?",
  },
  {
    key: "collaboration",
    label: "Collaboration",
    description: "Did they work cooperatively with teammates and share responsibilities?",
  },
  {
    key: "reliability",
    label: "Reliability",
    description: "Did they follow through on commitments, tasks, and deadlines?",
  },
  {
    key: "technical",
    label: "Technical Contribution",
    description: "Did they contribute effectively to their assigned technical work?",
  },
];

export interface DimensionRating {
  rating: number | null; // 1-5 or null if "Not Observed"
}

export interface ReviewSubmissionInput {
  projectId: string;
  revieweeId: string;
  ratingCommunication?: number | null;
  ratingCollaboration?: number | null;
  ratingReliability?: number | null;
  ratingTechnical?: number | null;
  rating?: number; // Overall rating 1-5 (computed if omitted)
  content?: string;
  skillsEndorsed?: string[];
}

export interface ReviewEditInput {
  ratingCommunication?: number | null;
  ratingCollaboration?: number | null;
  ratingReliability?: number | null;
  ratingTechnical?: number | null;
  rating?: number;
  content?: string;
  skillsEndorsed?: string[];
}

export interface ReviewResponseInput {
  responseContent: string;
}

export interface ReviewDisputeInput {
  reason: string;
}

export interface DimensionSummary {
  avg: number;
  count: number;
}

export interface ReputationSummary {
  score: number; // 0-100 scale (Bayesian smoothed)
  rawAverage: number | null; // 1-5 scale unweighted average if any reviews
  totalReviews: number;
  completedCollaborationsCount: number;
  hasSufficientFeedback: boolean; // >= 2 verified reviews
  statusMessage: string;
  dimensionAverages: Record<FeedbackDimension, DimensionSummary>;
  repeatCollaboratorDiscountApplied: boolean;
}
