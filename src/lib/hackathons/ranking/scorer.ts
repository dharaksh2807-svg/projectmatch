import {
  HackathonStatus,
  ParticipationMode,
  RegistrationStatus,
  VerificationStatus,
} from "@prisma/client";
import { RankingWeights, DEFAULT_WEIGHTS } from "./weights";

// ─────────────────────────────────────────────────────────────────────────────
// Input type
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimal hackathon shape needed for all scoring dimensions.
 * Compatible with Prisma select results and normalized adapter outputs.
 */
export interface HackathonForScoring {
  id?: string;

  // Lifecycle
  startDate?: Date | null;
  endDate?: Date | null;
  registrationDeadline?: Date | null;
  registrationStartDate?: Date | null;
  status?: HackathonStatus | null;
  registrationStatus?: RegistrationStatus | null;
  verificationStatus?: VerificationStatus | null;

  // National importance
  isNational?: boolean | null;
  organizerName?: string | null;
  organizerCredibility?: string | null;

  // Student relevance
  themes?: string[];
  tags?: string[];  // tech categories e.g. ["AI", "Web3", "FinTech"]
  eligibilityRequirements?: string | null;
  minTeamSize?: number | null;
  maxTeamSize?: number | null;

  // Prize & learning
  prizeAmount?: number | null;
  prizeCurrency?: string | null;

  // Accessibility
  registrationFee?: number | null;
  participationMode?: ParticipationMode | null;
  country?: string | null;
  countryCode?: string | null;

  // Anti-recency-bias guard
  createdAt?: Date | null;
  lastSyncAt?: Date | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scoring output
// ─────────────────────────────────────────────────────────────────────────────

export interface ScoreBreakdown {
  nationalImportance: number;   // [0, 1]
  registrationUrgency: number;  // [0, 1]
  studentRelevance: number;     // [0, 1]
  prizeAndLearning: number;     // [0, 1]
  eligibilityAccessibility: number; // [0, 1]
}

export interface RankScore {
  /** Weighted sum of all dimensions: [0, 1] */
  total: number;
  /** Per-dimension breakdown for debugging / admin UI */
  breakdown: ScoreBreakdown;
  /** Tie-breaker values (lower = higher priority = sorts first) */
  tieBreaker: {
    deadlineMs: number;   // registrationDeadline time (Infinity if absent)
    startDateMs: number;  // startDate time (Infinity if absent)
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared keywords
// ─────────────────────────────────────────────────────────────────────────────

/** Technology domains popular among students — case-insensitive matching */
const STUDENT_TECH_KEYWORDS = [
  "ai", "machine learning", "ml", "deep learning", "llm",
  "web", "web3", "blockchain", "defi", "nft",
  "mobile", "app", "android", "ios",
  "open source", "hardware", "iot", "robotics",
  "health", "medtech", "biotech", "fintech", "edtech",
  "climate", "sustainability", "social impact",
  "cloud", "devops", "security", "cybersecurity",
  "data", "analytics", "visualization",
  "ar", "vr", "xr", "gaming",
];

/** Signals that an event explicitly targets students */
const STUDENT_ELIGIBILITY_KEYWORDS = [
  "student", "undergraduate", "graduate", "college", "university",
  "school", "beginner", "open to all", "everyone", "any team",
];

// ─────────────────────────────────────────────────────────────────────────────
// Dimension scorers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dimension 1 — National Importance & Organizer Credibility (weight: 30%)
 *
 * Score is based on:
 * - isNational flag (must be true with evidence — never assumed)
 * - verificationStatus (VERIFIED = full credit, UNVERIFIED = partial)
 * - organizerCredibility (non-empty evidence text boosts score)
 *
 * Phase 6 rule: national-level evidence is required; events without it score 0
 * on this dimension but still appear in general sections.
 */
export function scoreNationalImportance(h: HackathonForScoring): number {
  // No national evidence → 0. Never assume national level.
  if (!h.isNational) return 0;

  // Base score from verification quality
  let base: number;
  if (h.verificationStatus === VerificationStatus.VERIFIED) {
    base = 0.85;
  } else if (h.verificationStatus === VerificationStatus.UNVERIFIED) {
    base = 0.45;
  } else {
    // FLAGGED — was national but currently under review; reduced weight
    base = 0.20;
  }

  // Credibility evidence bonus (up to +0.15)
  const hasCredibilityEvidence =
    typeof h.organizerCredibility === "string" && h.organizerCredibility.trim().length > 5;
  const credibilityBonus = hasCredibilityEvidence ? 0.15 : 0;

  return Math.min(1, base + credibilityBonus);
}

/**
 * Dimension 2 — Registration Urgency (weight: 25%)
 *
 * Rewards events with approaching open registration deadlines.
 * Phase 6 rules:
 * - Events with closed registration score 0 (never treated as actionable).
 * - Events with unknown registration deadline receive a low neutral score
 *   (not 0 — they may be open — but not rewarded for urgency they can't prove).
 * - Urgency decays linearly over 30 days from deadline.
 * - Events more than 30 days away receive a minimal non-zero score (still upcoming).
 */
export function scoreRegistrationUrgency(
  h: HackathonForScoring,
  now: Date = new Date()
): number {
  // Closed registration is never actionable
  if (h.registrationStatus === RegistrationStatus.CLOSED) return 0;
  if (h.registrationStatus === RegistrationStatus.COMING_SOON) return 0;
  if (h.status === HackathonStatus.CANCELLED) return 0;

  const deadline = h.registrationDeadline ? new Date(h.registrationDeadline) : null;
  const nowMs = now.getTime();

  // Deadline in the past (shouldn't reach scoring, but defend against it)
  if (deadline && deadline.getTime() <= nowMs) return 0;

  if (!deadline) {
    // Unknown deadline: small neutral score — not rewarded for urgency
    return 0.10;
  }

  const daysUntilDeadline = (deadline.getTime() - nowMs) / (24 * 60 * 60 * 1000);

  if (daysUntilDeadline <= 1) return 1.00;   // Closing within 24h
  if (daysUntilDeadline <= 2) return 0.92;   // Closing within 48h
  if (daysUntilDeadline <= 3) return 0.85;   // Closing within 72h (→ "Closing Soon" section)
  if (daysUntilDeadline <= 7) return 0.65;   // Within a week
  if (daysUntilDeadline <= 14) return 0.45;  // Within two weeks
  if (daysUntilDeadline <= 30) return 0.25;  // Within a month

  // More than 30 days away: minimal urgency signal
  return Math.max(0.05, 0.25 - (daysUntilDeadline - 30) / 120);
}

/**
 * Dimension 3 — Student & Technology Relevance (weight: 20%)
 *
 * Rewards:
 * - Events with popular technology themes
 * - Events explicitly targeting students or beginners
 * - Events with reasonable team sizes (2-5 people typical for hackathons)
 * - Online/hybrid format (accessible to students globally)
 */
export function scoreStudentRelevance(h: HackathonForScoring): number {
  let score = 0;

  const allText = [
    ...(h.themes ?? []),
    ...(h.tags ?? []),
    h.eligibilityRequirements ?? "",
    h.organizerName ?? "",
  ]
    .join(" ")
    .toLowerCase();

  // Technology keyword matching (up to 0.45)
  const techMatches = STUDENT_TECH_KEYWORDS.filter((kw) => allText.includes(kw)).length;
  // Diminishing returns: first match worth 0.20, each additional +0.05, cap at 0.45
  score += Math.min(0.45, techMatches > 0 ? 0.20 + (techMatches - 1) * 0.05 : 0);

  // Student-explicit targeting (up to 0.30)
  const studentMatches = STUDENT_ELIGIBILITY_KEYWORDS.filter((kw) =>
    allText.includes(kw)
  ).length;
  score += studentMatches > 0 ? Math.min(0.30, 0.15 + (studentMatches - 1) * 0.05) : 0;

  // Team size bonus (up to 0.15): 2-6 person teams typical for collaborative hackathons
  const maxTeam = h.maxTeamSize;
  const minTeam = h.minTeamSize;
  if (maxTeam !== null && maxTeam !== undefined && maxTeam >= 2 && maxTeam <= 6) {
    score += 0.10;
  } else if (minTeam !== null && minTeam !== undefined && minTeam <= 1) {
    score += 0.05; // Solo participation allowed
  }

  // Online/hybrid bonus (0.10): globally accessible for students
  if (
    h.participationMode === ParticipationMode.ONLINE ||
    h.participationMode === ParticipationMode.HYBRID
  ) {
    score += 0.10;
  }

  return Math.min(1, score);
}

/**
 * Dimension 4 — Verified Prize Value & Learning Opportunities (weight: 15%)
 *
 * Phase 6 rules:
 * - Uses logarithmic scale so $1M ≠ infinitely better than $100k.
 * - Events with no prize info receive a base score of 0.30 — not zero.
 *   (learning hackathons, mentorship-first events must not be buried.)
 * - Very high prizes get a diminishing-returns cap at 0.95.
 */
export function scorePrizeAndLearning(h: HackathonForScoring): number {
  const prize = h.prizeAmount;

  // No prize information disclosed → base score that reflects learning value
  if (prize === null || prize === undefined) {
    return 0.30;
  }

  // Explicit zero prize (workshops, learning sprints) → same base
  if (prize <= 0) {
    return 0.30;
  }

  // Logarithmic scale: log10(prize+1) / log10(1_000_000)
  // Anchors: $1k → ~0.37, $10k → ~0.55, $100k → ~0.76, $1M → 1.0 (capped at 0.95)
  const logScale = Math.log10(prize + 1) / Math.log10(1_000_000);

  // Minimum 0.30 (even small prizes indicate the event has substance), cap 0.95
  return Math.max(0.30, Math.min(0.95, logScale));
}

/**
 * Dimension 5 — Eligibility & Accessibility (weight: 10%)
 *
 * Rewards:
 * - Online or hybrid participation (globally accessible)
 * - Free registration (no financial barrier)
 * - Known team size flexibility (solo or small teams allowed)
 * - India or international eligibility (for student audience)
 */
export function scoreEligibilityAccessibility(h: HackathonForScoring): number {
  let score = 0;

  // Participation mode (up to 0.50)
  if (h.participationMode === ParticipationMode.ONLINE) {
    score += 0.50;
  } else if (h.participationMode === ParticipationMode.HYBRID) {
    score += 0.35;
  } else if (h.participationMode === ParticipationMode.OFFLINE) {
    score += 0.10;
  } else {
    // Unknown mode — neither penalized nor rewarded
    score += 0.20;
  }

  // Registration fee (up to 0.25)
  if (h.registrationFee === 0) {
    score += 0.25; // Free
  } else if (h.registrationFee === null || h.registrationFee === undefined) {
    score += 0.10; // Unknown — slightly better than paid
  }
  // Paid registration → 0 bonus (implicit)

  // Team size flexibility (up to 0.15)
  const minTeam = h.minTeamSize ?? 1;
  if (minTeam <= 1) {
    score += 0.15; // Solo participants allowed
  } else if (minTeam <= 2) {
    score += 0.05; // Pairs minimum
  }

  // International/India eligibility (up to 0.10)
  const isInternational =
    !h.countryCode || h.countryCode.toUpperCase() === "GLOBAL";
  const isIndia = h.countryCode?.toUpperCase() === "IN";
  if (isInternational) {
    score += 0.10;
  } else if (isIndia) {
    score += 0.10; // Indian events also relevant to this platform's audience
  }

  return Math.min(1, score);
}

// ─────────────────────────────────────────────────────────────────────────────
// Combined rank scorer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the complete ranking score for a hackathon.
 *
 * Phase 6 rules enforced:
 * - Closed-registration events cannot be scored as actionable (registrationUrgency = 0).
 * - New imports do not get priority solely for recency — createdAt is never a factor.
 * - Missing prize info does not bury events (base score 0.30).
 * - National evidence is required (isNational flag must be explicitly true).
 * - Tie-breaking is stable: earlier deadline first, then earlier start date.
 */
export function computeRankScore(
  h: HackathonForScoring,
  weights: RankingWeights = DEFAULT_WEIGHTS,
  now: Date = new Date()
): RankScore {
  const breakdown: ScoreBreakdown = {
    nationalImportance: scoreNationalImportance(h),
    registrationUrgency: scoreRegistrationUrgency(h, now),
    studentRelevance: scoreStudentRelevance(h),
    prizeAndLearning: scorePrizeAndLearning(h),
    eligibilityAccessibility: scoreEligibilityAccessibility(h),
  };

  const total =
    breakdown.nationalImportance * weights.nationalImportance +
    breakdown.registrationUrgency * weights.registrationUrgency +
    breakdown.studentRelevance * weights.studentRelevance +
    breakdown.prizeAndLearning * weights.prizeAndLearning +
    breakdown.eligibilityAccessibility * weights.eligibilityAccessibility;

  // Tie-breaker: lower = higher priority (closer deadline sorts first)
  const deadlineMs = h.registrationDeadline
    ? new Date(h.registrationDeadline).getTime()
    : Infinity;

  const startDateMs = h.startDate ? new Date(h.startDate).getTime() : Infinity;

  return {
    total: Math.max(0, Math.min(1, total)),
    breakdown,
    tieBreaker: { deadlineMs, startDateMs },
  };
}

/**
 * Sort comparator: highest rank first, tie-broken by deadline then start date.
 * Deterministic across identical inputs.
 */
export function compareRankScores(a: RankScore, b: RankScore): number {
  // Primary: total score descending
  const scoreDiff = b.total - a.total;
  if (Math.abs(scoreDiff) > 1e-9) return scoreDiff;

  // Secondary: earlier deadline ascending (more urgent = higher priority)
  const deadlineDiff = a.tieBreaker.deadlineMs - b.tieBreaker.deadlineMs;
  if (deadlineDiff !== 0) return deadlineDiff;

  // Tertiary: earlier start date ascending
  return a.tieBreaker.startDateMs - b.tieBreaker.startDateMs;
}
