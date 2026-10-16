/**
 * Phase 6 — Ranking Weights
 *
 * Each dimension produces a normalized score in [0, 1].
 * The final rank score is the weighted sum of all dimensions.
 *
 * Weights must sum to 1.0.
 * They are configurable via the HACKATHON_RANKING_WEIGHTS environment variable
 * (a JSON-encoded RankingWeights object). If the env var is absent or invalid,
 * the default weights are used. The frontend never needs to change for weight
 * tuning — only the environment variable needs to be updated.
 */

export interface RankingWeights {
  /**
   * National importance and organizer credibility.
   * Default: 0.30
   * Rewards verified national competitions with credible organizers.
   * Requires positive evidence (isNational=true + credibility text or VERIFIED status).
   */
  nationalImportance: number;

  /**
   * Registration urgency.
   * Default: 0.25
   * Rewards events whose registration deadline is approaching.
   * Never awards urgency to events with closed or unknown registration.
   */
  registrationUrgency: number;

  /**
   * Relevance to students and technology.
   * Default: 0.20
   * Rewards events with technology themes, student-friendly structure,
   * and beginner-accessible formats.
   */
  studentRelevance: number;

  /**
   * Verified prize value and learning opportunities.
   * Default: 0.15
   * Uses a logarithmic scale to avoid prize-amount dominance.
   * Non-prize (learning-focused) hackathons receive a base score so they
   * do not disappear simply because prize info is absent.
   */
  prizeAndLearning: number;

  /**
   * Eligibility and accessibility.
   * Default: 0.10
   * Rewards online/hybrid events, free registration, and broad eligibility.
   */
  eligibilityAccessibility: number;
}

/** The initial proposed weighting from the Phase 6 specification. */
export const DEFAULT_WEIGHTS: Readonly<RankingWeights> = {
  nationalImportance: 0.30,
  registrationUrgency: 0.25,
  studentRelevance: 0.20,
  prizeAndLearning: 0.15,
  eligibilityAccessibility: 0.10,
} as const;

/**
 * Validates that weights are a proper distribution (each in [0,1], sum ≈ 1.0).
 */
export function validateWeights(w: Partial<RankingWeights>): w is RankingWeights {
  const keys: (keyof RankingWeights)[] = [
    "nationalImportance",
    "registrationUrgency",
    "studentRelevance",
    "prizeAndLearning",
    "eligibilityAccessibility",
  ];

  for (const k of keys) {
    const v = w[k];
    if (typeof v !== "number" || v < 0 || v > 1) return false;
  }

  const sum = keys.reduce((acc, k) => acc + (w[k] as number), 0);
  // Allow ±0.01 tolerance for floating-point representation
  return Math.abs(sum - 1.0) <= 0.01;
}

/**
 * Load ranking weights from the environment, falling back to defaults.
 * Environment variable: HACKATHON_RANKING_WEIGHTS (JSON string)
 */
export function loadWeights(): RankingWeights {
  const raw = process.env.HACKATHON_RANKING_WEIGHTS;
  if (!raw) return DEFAULT_WEIGHTS;

  try {
    const parsed = JSON.parse(raw) as Partial<RankingWeights>;
    if (validateWeights(parsed)) {
      return parsed;
    }
    console.warn(
      "[ranking] HACKATHON_RANKING_WEIGHTS is invalid (weights must each be in [0,1] and sum to 1.0). Using defaults."
    );
  } catch {
    console.warn("[ranking] HACKATHON_RANKING_WEIGHTS could not be parsed as JSON. Using defaults.");
  }

  return DEFAULT_WEIGHTS;
}

/**
 * Parse and validate a base64-encoded weights override from a query string.
 * Used only in non-production environments for weight tuning / testing.
 * Returns null if the input is absent, invalid, or the environment is production.
 */
export function parseWeightsOverride(
  base64: string | null | undefined
): RankingWeights | null {
  if (!base64 || process.env.NODE_ENV === "production") return null;

  try {
    const json = Buffer.from(base64, "base64").toString("utf-8");
    const parsed = JSON.parse(json) as Partial<RankingWeights>;
    if (validateWeights(parsed)) return parsed;
  } catch {
    // Fall through
  }

  return null;
}
