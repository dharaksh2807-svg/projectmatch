import { RegistrationStatus, VerificationStatus } from "@prisma/client";
import { RankingWeights, DEFAULT_WEIGHTS } from "./weights";
import {
  HackathonForScoring,
  RankScore,
  computeRankScore,
  compareRankScores,
} from "./scorer";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RankedHackathon<T extends HackathonForScoring = HackathonForScoring> {
  hackathon: T;
  rankScore: RankScore;
}

/**
 * Four discovery sections.
 * Phase 6 guarantee: the same event NEVER appears in more than one section.
 */
export interface DiscoverySections<T extends HackathonForScoring = HackathonForScoring> {
  /**
   * Featured National Hackathons.
   * Criteria:
   * - isNational === true with verifiable evidence
   * - verificationStatus is VERIFIED
   * - Registration is OPEN or UNKNOWN (never CLOSED/COMING_SOON)
   * - rankScore.total >= FEATURED_THRESHOLD
   * Max: 6 items.
   */
  featured: RankedHackathon<T>[];

  /**
   * Registration Closing Soon.
   * Criteria:
   * - registrationDeadline within CLOSING_SOON_HOURS hours
   * - registrationStatus is OPEN
   * - Not already in featured
   * Max: 5 items.
   */
  closingSoon: RankedHackathon<T>[];

  /**
   * Upcoming Hackathons.
   * Criteria:
   * - registrationStatus is OPEN or UNKNOWN
   * - Not already assigned to featured or closingSoon
   * Max: 12 items, sorted by rank score.
   */
  upcoming: RankedHackathon<T>[];

  /**
   * Other Verified Opportunities.
   * Criteria:
   * - verificationStatus is VERIFIED
   * - Not already assigned
   * - Includes events with closed registration (REG_CLOSED) or COMING_SOON
   *   that are still future events worth surfacing
   * Max: 8 items.
   */
  other: RankedHackathon<T>[];

  /** Events that were scored but not assigned to any section. */
  unassigned: RankedHackathon<T>[];

  /** Metadata about the ranking run. */
  meta: {
    totalCandidates: number;
    rankedAt: Date;
    weights: RankingWeights;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const FEATURED_THRESHOLD = 0.42;
const CLOSING_SOON_HOURS = 72;
const SECTION_CAPS = {
  featured: 6,
  closingSoon: 5,
  upcoming: 12,
  other: 8,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Eligibility pre-filter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Phase 6 rule: Only eligible, publishable events enter the ranking pipeline.
 *
 * An event is ineligible if:
 * - registrationStatus is CLOSED (not an actionable opportunity)
 * - verificationStatus is REJECTED (excluded from all feeds per Phase 5)
 * - The event is CANCELLED
 *
 * Note: COMING_SOON events are eligible for the "other" section so users can
 * discover events where registration will open soon — they are just excluded
 * from featured/closing-soon/upcoming which require open or unknown registration.
 */
function isEligibleForRanking(h: HackathonForScoring): boolean {
  if (h.verificationStatus === VerificationStatus.REJECTED) return false;
  if (h.registrationStatus === RegistrationStatus.CLOSED) return false;
  if ((h.status as string) === "CANCELLED") return false;
  return true;
}

/**
 * Returns true when an event is eligible for the main action-oriented sections
 * (featured, closingSoon, upcoming). Requires registration to be OPEN or UNKNOWN.
 */
function isActionableRegistration(h: HackathonForScoring): boolean {
  return (
    h.registrationStatus === RegistrationStatus.OPEN ||
    h.registrationStatus === RegistrationStatus.UNKNOWN ||
    h.registrationStatus === null ||
    h.registrationStatus === undefined
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the four discovery sections from a flat list of hackathon records.
 *
 * Algorithm:
 * 1. Filter to eligible events only.
 * 2. Score every eligible event.
 * 3. Sort by rank score (desc) with stable tie-breaking.
 * 4. Assign each event to exactly one section in priority order.
 *
 * Phase 6 guarantee: an event never appears in more than one section.
 */
export function buildDiscoverySections<T extends HackathonForScoring>(
  hackathons: T[],
  weights: RankingWeights = DEFAULT_WEIGHTS,
  now: Date = new Date()
): DiscoverySections<T> {
  // ── 1. Filter eligible candidates ─────────────────────────────────────────
  const eligible = hackathons.filter(isEligibleForRanking);

  // ── 2. Score all candidates ───────────────────────────────────────────────
  const scored: RankedHackathon<T>[] = eligible.map((h) => ({
    hackathon: h,
    rankScore: computeRankScore(h, weights, now),
  }));

  // ── 3. Sort descending by rank score (stable tie-breaking) ────────────────
  scored.sort((a, b) => compareRankScores(a.rankScore, b.rankScore));

  // ── 4. Assign to sections — track assigned IDs to guarantee no duplicates ─
  const assigned = new Set<string | undefined>();

  const isFresh = (entry: RankedHackathon<T>): boolean =>
    !assigned.has(entry.hackathon.id);

  const markAssigned = (entries: RankedHackathon<T>[]): void => {
    entries.forEach((e) => assigned.add(e.hackathon.id));
  };

  const closingSoonCutoff = now.getTime() + CLOSING_SOON_HOURS * 60 * 60 * 1000;

  // Section 1: Featured National Hackathons
  const featured = scored
    .filter(
      (e) =>
        isFresh(e) &&
        e.hackathon.isNational === true &&
        e.hackathon.verificationStatus === VerificationStatus.VERIFIED &&
        isActionableRegistration(e.hackathon) &&
        e.rankScore.total >= FEATURED_THRESHOLD
    )
    .slice(0, SECTION_CAPS.featured);
  markAssigned(featured);

  // Section 2: Registration Closing Soon
  const closingSoon = scored
    .filter((e) => {
      if (!isFresh(e)) return false;
      if (!isActionableRegistration(e.hackathon)) return false;
      if (e.hackathon.registrationStatus !== RegistrationStatus.OPEN) return false;
      if (!e.hackathon.registrationDeadline) return false;
      const deadlineMs = new Date(e.hackathon.registrationDeadline).getTime();
      return deadlineMs > now.getTime() && deadlineMs <= closingSoonCutoff;
    })
    .slice(0, SECTION_CAPS.closingSoon);
  markAssigned(closingSoon);

  // Section 3: Upcoming Hackathons
  const upcoming = scored
    .filter((e) => isFresh(e) && isActionableRegistration(e.hackathon))
    .slice(0, SECTION_CAPS.upcoming);
  markAssigned(upcoming);

  // Section 4: Other Verified Opportunities
  const other = scored
    .filter(
      (e) =>
        isFresh(e) &&
        e.hackathon.verificationStatus === VerificationStatus.VERIFIED
    )
    .slice(0, SECTION_CAPS.other);
  markAssigned(other);

  // Remaining unassigned (not surfaced on the page — discoverable via full listing)
  const unassigned = scored.filter((e) => isFresh(e));

  return {
    featured,
    closingSoon,
    upcoming,
    other,
    unassigned,
    meta: {
      totalCandidates: eligible.length,
      rankedAt: now,
      weights,
    },
  };
}
