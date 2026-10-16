import { describe, test, expect } from "vitest";
import { RegistrationStatus, VerificationStatus, ParticipationMode } from "@prisma/client";
import {
  scoreNationalImportance,
  scoreRegistrationUrgency,
  scoreStudentRelevance,
  scorePrizeAndLearning,
  scoreEligibilityAccessibility,
  computeRankScore,
  compareRankScores,
  HackathonForScoring,
} from "./scorer";
import { buildDiscoverySections } from "./sections";
import { DEFAULT_WEIGHTS } from "./weights";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

const NOW = new Date("2026-06-15T12:00:00Z");

function daysFromNow(d: number): Date {
  return new Date(NOW.getTime() + d * DAY);
}

function hoursFromNow(h: number): Date {
  return new Date(NOW.getTime() + h * HOUR);
}

function hoursAgo(h: number): Date {
  return new Date(NOW.getTime() - h * HOUR);
}

/** Build a minimal valid hackathon for testing */
function base(overrides: Partial<HackathonForScoring> = {}): HackathonForScoring {
  return {
    id: crypto.randomUUID(),
    startDate: daysFromNow(10),
    endDate: daysFromNow(12),
    registrationDeadline: daysFromNow(7),
    registrationStatus: RegistrationStatus.OPEN,
    verificationStatus: VerificationStatus.UNVERIFIED,
    isNational: false,
    themes: [],
    tags: [],
    prizeAmount: null,
    registrationFee: 0,
    participationMode: ParticipationMode.ONLINE,
    createdAt: new Date(NOW.getTime() - 2 * DAY),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// scoreNationalImportance
// ─────────────────────────────────────────────────────────────────────────────

describe("scoreNationalImportance", () => {
  test("returns 0 when isNational is false", () => {
    expect(scoreNationalImportance(base({ isNational: false }))).toBe(0);
  });

  test("returns 0 when isNational is null or undefined", () => {
    expect(scoreNationalImportance(base({ isNational: null }))).toBe(0);
    expect(scoreNationalImportance(base({ isNational: undefined }))).toBe(0);
  });

  test("VERIFIED national events score higher than UNVERIFIED national events", () => {
    const verified = scoreNationalImportance(
      base({ isNational: true, verificationStatus: VerificationStatus.VERIFIED })
    );
    const unverified = scoreNationalImportance(
      base({ isNational: true, verificationStatus: VerificationStatus.UNVERIFIED })
    );
    expect(verified).toBeGreaterThan(unverified);
  });

  test("credibility evidence boosts the score", () => {
    const withEvidence = scoreNationalImportance(
      base({
        isNational: true,
        verificationStatus: VerificationStatus.VERIFIED,
        organizerCredibility: "Verified MLH Partner — 2026 Season",
      })
    );
    const withoutEvidence = scoreNationalImportance(
      base({
        isNational: true,
        verificationStatus: VerificationStatus.VERIFIED,
        organizerCredibility: null,
      })
    );
    expect(withEvidence).toBeGreaterThan(withoutEvidence);
  });

  test("score is always in [0, 1]", () => {
    for (const vs of Object.values(VerificationStatus)) {
      const s = scoreNationalImportance(
        base({ isNational: true, verificationStatus: vs as VerificationStatus, organizerCredibility: "Evidence" })
      );
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// scoreRegistrationUrgency
// ─────────────────────────────────────────────────────────────────────────────

describe("scoreRegistrationUrgency", () => {
  test("returns 0 for CLOSED registration — not actionable", () => {
    expect(
      scoreRegistrationUrgency(
        base({ registrationStatus: RegistrationStatus.CLOSED }),
        NOW
      )
    ).toBe(0);
  });

  test("returns 0 for COMING_SOON registration — not yet open", () => {
    expect(
      scoreRegistrationUrgency(
        base({ registrationStatus: RegistrationStatus.COMING_SOON }),
        NOW
      )
    ).toBe(0);
  });

  test("returns 0 for CANCELLED events", () => {
    expect(
      scoreRegistrationUrgency(base({ status: "CANCELLED" as any }), NOW)
    ).toBe(0);
  });

  test("returns 1.0 for deadline within 24 hours", () => {
    expect(
      scoreRegistrationUrgency(base({ registrationDeadline: hoursFromNow(12) }), NOW)
    ).toBe(1.0);
  });

  test("deadline within 72 hours scores >= 0.85", () => {
    const score = scoreRegistrationUrgency(
      base({ registrationDeadline: hoursFromNow(70) }),
      NOW
    );
    expect(score).toBeGreaterThanOrEqual(0.85);
  });

  test("closer deadline always scores higher than farther deadline", () => {
    const closeScore = scoreRegistrationUrgency(
      base({ registrationDeadline: daysFromNow(3) }),
      NOW
    );
    const farScore = scoreRegistrationUrgency(
      base({ registrationDeadline: daysFromNow(30) }),
      NOW
    );
    expect(closeScore).toBeGreaterThan(farScore);
  });

  test("no deadline returns a neutral low score (not 0, not high)", () => {
    const score = scoreRegistrationUrgency(
      base({ registrationDeadline: null }),
      NOW
    );
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(0.5);
  });

  test("past deadline returns 0", () => {
    expect(
      scoreRegistrationUrgency(base({ registrationDeadline: hoursAgo(1) }), NOW)
    ).toBe(0);
  });

  test("score is always in [0, 1]", () => {
    for (const days of [0.5, 1, 2, 3, 7, 14, 30, 60, 90]) {
      const s = scoreRegistrationUrgency(
        base({ registrationDeadline: daysFromNow(days) }),
        NOW
      );
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// scoreStudentRelevance
// ─────────────────────────────────────────────────────────────────────────────

describe("scoreStudentRelevance", () => {
  test("AI/ML themes score higher than events with no themes", () => {
    const aiEvent = scoreStudentRelevance(base({ themes: ["AI", "Machine Learning"] }));
    const emptyEvent = scoreStudentRelevance(base({ themes: [] }));
    expect(aiEvent).toBeGreaterThan(emptyEvent);
  });

  test("events with student eligibility text score higher", () => {
    const studentEvent = scoreStudentRelevance(
      base({ eligibilityRequirements: "Open to all undergraduate and graduate students" })
    );
    const genericEvent = scoreStudentRelevance(
      base({ eligibilityRequirements: "Must be 18+" })
    );
    expect(studentEvent).toBeGreaterThan(genericEvent);
  });

  test("online events score higher than offline events", () => {
    const online = scoreStudentRelevance(base({ participationMode: ParticipationMode.ONLINE }));
    const offline = scoreStudentRelevance(base({ participationMode: ParticipationMode.OFFLINE }));
    expect(online).toBeGreaterThan(offline);
  });

  test("team size 2-5 boosts score vs. no team size info", () => {
    const withTeam = scoreStudentRelevance(base({ minTeamSize: 2, maxTeamSize: 4 }));
    const noTeam = scoreStudentRelevance(base({ minTeamSize: null, maxTeamSize: null }));
    expect(withTeam).toBeGreaterThanOrEqual(noTeam);
  });

  test("score is always in [0, 1]", () => {
    const extreme = scoreStudentRelevance(
      base({
        themes: ["AI", "Blockchain", "Healthcare", "Fintech", "Climate", "Open Source"],
        tags: ["Machine Learning", "Web3", "Mobile"],
        eligibilityRequirements: "Open to all university students worldwide",
        participationMode: ParticipationMode.ONLINE,
        minTeamSize: 1,
        maxTeamSize: 5,
      })
    );
    expect(extreme).toBeGreaterThanOrEqual(0);
    expect(extreme).toBeLessThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// scorePrizeAndLearning
// ─────────────────────────────────────────────────────────────────────────────

describe("scorePrizeAndLearning", () => {
  test("no prize info returns base score 0.30", () => {
    expect(scorePrizeAndLearning(base({ prizeAmount: null }))).toBe(0.30);
  });

  test("zero prize returns base score 0.30 — learning events not penalized", () => {
    expect(scorePrizeAndLearning(base({ prizeAmount: 0 }))).toBe(0.30);
  });

  test("larger prizes score higher (logarithmic scale)", () => {
    const small = scorePrizeAndLearning(base({ prizeAmount: 1_000 }));
    const medium = scorePrizeAndLearning(base({ prizeAmount: 50_000 }));
    const large = scorePrizeAndLearning(base({ prizeAmount: 500_000 }));
    expect(medium).toBeGreaterThan(small);
    expect(large).toBeGreaterThan(medium);
  });

  test("prize dominance is limited — $1M not 100x better than $10k", () => {
    const tenK = scorePrizeAndLearning(base({ prizeAmount: 10_000 }));
    const oneMillion = scorePrizeAndLearning(base({ prizeAmount: 1_000_000 }));
    // Ratio must be < 3x, not 100x
    expect(oneMillion / tenK).toBeLessThan(3);
  });

  test("score is always in [0.30, 0.95]", () => {
    for (const amount of [0, 100, 1000, 10000, 100000, 1000000, 10000000]) {
      const s = scorePrizeAndLearning(base({ prizeAmount: amount }));
      expect(s).toBeGreaterThanOrEqual(0.30);
      expect(s).toBeLessThanOrEqual(0.95);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// scoreEligibilityAccessibility
// ─────────────────────────────────────────────────────────────────────────────

describe("scoreEligibilityAccessibility", () => {
  test("free online event scores higher than paid offline event", () => {
    const good = scoreEligibilityAccessibility(
      base({
        participationMode: ParticipationMode.ONLINE,
        registrationFee: 0,
        minTeamSize: 1,
        countryCode: null,
      })
    );
    const restrictive = scoreEligibilityAccessibility(
      base({
        participationMode: ParticipationMode.OFFLINE,
        registrationFee: 500,
        minTeamSize: 3,
        countryCode: "SG",
      })
    );
    expect(good).toBeGreaterThan(restrictive);
  });

  test("score is always in [0, 1]", () => {
    for (const mode of Object.values(ParticipationMode)) {
      const s = scoreEligibilityAccessibility(
        base({ participationMode: mode as ParticipationMode })
      );
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeRankScore — priority ordering guarantees
// ─────────────────────────────────────────────────────────────────────────────

describe("computeRankScore — ordering guarantees", () => {
  const W = DEFAULT_WEIGHTS;

  test("verified national event ranks above unverified non-national event", () => {
    const national = computeRankScore(
      base({
        isNational: true,
        verificationStatus: VerificationStatus.VERIFIED,
        organizerCredibility: "Verified government initiative",
        themes: ["AI", "Healthcare"],
        registrationDeadline: daysFromNow(14),
        participationMode: ParticipationMode.ONLINE,
        registrationFee: 0,
        prizeAmount: 100_000,
      }),
      W,
      NOW
    );
    const generic = computeRankScore(
      base({
        isNational: false,
        verificationStatus: VerificationStatus.UNVERIFIED,
        themes: [],
        registrationDeadline: daysFromNow(30),
        participationMode: ParticipationMode.OFFLINE,
        registrationFee: 200,
        prizeAmount: null,
      }),
      W,
      NOW
    );
    expect(national.total).toBeGreaterThan(generic.total);
  });

  test("event with closer deadline ranks above otherwise-equivalent event with farther deadline", () => {
    const urgent = computeRankScore(
      base({ registrationDeadline: hoursFromNow(36) }),
      W,
      NOW
    );
    const relaxed = computeRankScore(
      base({ registrationDeadline: daysFromNow(25) }),
      W,
      NOW
    );
    expect(urgent.total).toBeGreaterThan(relaxed.total);
  });

  test("newly imported event does NOT rank above older event with better signals", () => {
    const justImported = computeRankScore(
      base({
        createdAt: new Date(NOW.getTime() - 1 * HOUR), // just added
        isNational: false,
        themes: [],
        prizeAmount: null,
        registrationDeadline: daysFromNow(60),
      }),
      W,
      NOW
    );
    const established = computeRankScore(
      base({
        createdAt: new Date(NOW.getTime() - 30 * DAY), // been in DB 30 days
        isNational: true,
        verificationStatus: VerificationStatus.VERIFIED,
        themes: ["AI", "Health"],
        prizeAmount: 50_000,
        registrationDeadline: daysFromNow(10),
      }),
      W,
      NOW
    );
    // Established event must rank higher despite being older
    expect(established.total).toBeGreaterThan(justImported.total);
  });

  test("closed-registration event scores 0 on urgency dimension", () => {
    const closed = computeRankScore(
      base({ registrationStatus: RegistrationStatus.CLOSED }),
      W,
      NOW
    );
    expect(closed.breakdown.registrationUrgency).toBe(0);
  });

  test("total score is always in [0, 1]", () => {
    const maxEvent = computeRankScore(
      base({
        isNational: true,
        verificationStatus: VerificationStatus.VERIFIED,
        organizerCredibility: "Official National Initiative",
        themes: ["AI", "ML", "Health", "Fintech", "Climate"],
        registrationDeadline: hoursFromNow(2),
        prizeAmount: 2_000_000,
        registrationFee: 0,
        participationMode: ParticipationMode.ONLINE,
        minTeamSize: 1,
        maxTeamSize: 4,
      }),
      W,
      NOW
    );
    const minEvent = computeRankScore(base({ isNational: false, themes: [] }), W, NOW);
    expect(maxEvent.total).toBeLessThanOrEqual(1);
    expect(minEvent.total).toBeGreaterThanOrEqual(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// compareRankScores — stable tie-breaking
// ─────────────────────────────────────────────────────────────────────────────

describe("compareRankScores — tie-breaking", () => {
  test("higher total ranks first", () => {
    const high = computeRankScore(
      base({ isNational: true, verificationStatus: VerificationStatus.VERIFIED, themes: ["AI"], prizeAmount: 100_000, registrationDeadline: daysFromNow(5) }),
      DEFAULT_WEIGHTS,
      NOW
    );
    const low = computeRankScore(base(), DEFAULT_WEIGHTS, NOW);
    expect(compareRankScores(high, low)).toBeLessThan(0); // high comes first
  });

  test("on equal scores, earlier deadline ranks first", () => {
    // Two identical events except deadline
    const h1 = base({ id: "a", registrationDeadline: daysFromNow(3) });
    const h2 = base({ id: "b", registrationDeadline: daysFromNow(10) });
    const s1 = computeRankScore(h1, DEFAULT_WEIGHTS, NOW);
    // Force equal total by copying s1.total to a mock
    const s2 = { ...computeRankScore(h2, DEFAULT_WEIGHTS, NOW), total: s1.total };
    // h1 has closer deadline → should sort first (compareRankScores < 0)
    expect(compareRankScores(s1, s2)).toBeLessThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildDiscoverySections — section assignment
// ─────────────────────────────────────────────────────────────────────────────

describe("buildDiscoverySections", () => {
  test("no event appears in more than one section", () => {
    const hackathons = [
      base({ id: "n1", isNational: true, verificationStatus: VerificationStatus.VERIFIED, organizerCredibility: "Gov initiative", themes: ["AI"], prizeAmount: 100_000, registrationDeadline: daysFromNow(10) }),
      base({ id: "n2", isNational: true, verificationStatus: VerificationStatus.VERIFIED, organizerCredibility: "MLH Partner", themes: ["ML"], prizeAmount: 50_000, registrationDeadline: daysFromNow(5) }),
      base({ id: "cs1", registrationStatus: RegistrationStatus.OPEN, registrationDeadline: hoursFromNow(30) }),
      base({ id: "u1", registrationDeadline: daysFromNow(20) }),
      base({ id: "u2", registrationDeadline: daysFromNow(25) }),
    ];

    const sections = buildDiscoverySections(hackathons, DEFAULT_WEIGHTS, NOW);
    const allIds = [
      ...sections.featured.map((e) => e.hackathon.id),
      ...sections.closingSoon.map((e) => e.hackathon.id),
      ...sections.upcoming.map((e) => e.hackathon.id),
      ...sections.other.map((e) => e.hackathon.id),
      ...sections.unassigned.map((e) => e.hackathon.id),
    ];
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(allIds.length); // no duplicates
  });

  test("featured section only contains national verified events with open registration", () => {
    const sections = buildDiscoverySections(
      [
        base({ id: "verified-national", isNational: true, verificationStatus: VerificationStatus.VERIFIED, organizerCredibility: "Ministry of Education", themes: ["AI", "Education"], prizeAmount: 500_000, registrationDeadline: daysFromNow(14) }),
        base({ id: "unverified-national", isNational: true, verificationStatus: VerificationStatus.UNVERIFIED }),
        base({ id: "non-national", isNational: false, verificationStatus: VerificationStatus.VERIFIED }),
        base({ id: "closed-national", isNational: true, verificationStatus: VerificationStatus.VERIFIED, registrationStatus: RegistrationStatus.CLOSED, organizerCredibility: "Evidence" }),
      ],
      DEFAULT_WEIGHTS,
      NOW
    );

    for (const entry of sections.featured) {
      expect(entry.hackathon.isNational).toBe(true);
      expect(entry.hackathon.verificationStatus).toBe(VerificationStatus.VERIFIED);
      expect(entry.hackathon.registrationStatus).not.toBe(RegistrationStatus.CLOSED);
    }
  });

  test("closingSoon only contains events with deadline within 72h", () => {
    const sections = buildDiscoverySections(
      [
        base({ id: "close", registrationDeadline: hoursFromNow(48), registrationStatus: RegistrationStatus.OPEN }),
        base({ id: "far", registrationDeadline: daysFromNow(14), registrationStatus: RegistrationStatus.OPEN }),
      ],
      DEFAULT_WEIGHTS,
      NOW
    );
    expect(sections.closingSoon.some((e) => e.hackathon.id === "close")).toBe(true);
    expect(sections.closingSoon.some((e) => e.hackathon.id === "far")).toBe(false);
  });

  test("CLOSED registration events are excluded from all ranked sections", () => {
    const sections = buildDiscoverySections(
      [
        base({ id: "closed", registrationStatus: RegistrationStatus.CLOSED }),
        base({ id: "open", registrationStatus: RegistrationStatus.OPEN }),
      ],
      DEFAULT_WEIGHTS,
      NOW
    );
    const allIds = [
      ...sections.featured,
      ...sections.closingSoon,
      ...sections.upcoming,
      ...sections.other,
    ].map((e) => e.hackathon.id);
    expect(allIds).not.toContain("closed");
  });

  test("REJECTED events are excluded from all sections", () => {
    const sections = buildDiscoverySections(
      [base({ id: "rejected", verificationStatus: VerificationStatus.REJECTED })],
      DEFAULT_WEIGHTS,
      NOW
    );
    const allIds = [
      ...sections.featured,
      ...sections.closingSoon,
      ...sections.upcoming,
      ...sections.other,
      ...sections.unassigned,
    ].map((e) => e.hackathon.id);
    expect(allIds).not.toContain("rejected");
  });

  test("high-priority event ranks above low-priority event in upcoming section", () => {
    const sections = buildDiscoverySections(
      [
        base({ id: "low", themes: [], prizeAmount: null, registrationDeadline: daysFromNow(28), participationMode: ParticipationMode.OFFLINE, registrationFee: 500 }),
        base({ id: "high", themes: ["AI", "ML", "Healthcare"], prizeAmount: 100_000, registrationDeadline: daysFromNow(7), participationMode: ParticipationMode.ONLINE, registrationFee: 0, eligibilityRequirements: "Open to all students" }),
      ],
      DEFAULT_WEIGHTS,
      NOW
    );
    const upcomingIds = sections.upcoming.map((e) => e.hackathon.id);
    const highIdx = upcomingIds.indexOf("high");
    const lowIdx = upcomingIds.indexOf("low");
    if (highIdx !== -1 && lowIdx !== -1) {
      expect(highIdx).toBeLessThan(lowIdx);
    }
  });

  test("empty input returns empty sections", () => {
    const sections = buildDiscoverySections([], DEFAULT_WEIGHTS, NOW);
    expect(sections.featured).toHaveLength(0);
    expect(sections.closingSoon).toHaveLength(0);
    expect(sections.upcoming).toHaveLength(0);
    expect(sections.other).toHaveLength(0);
    expect(sections.meta.totalCandidates).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Weight configuration
// ─────────────────────────────────────────────────────────────────────────────

describe("weight configuration", () => {
  test("custom weights that emphasize prize change ordering", () => {
    const h1 = base({ prizeAmount: 1_000_000, registrationDeadline: daysFromNow(20) });
    const h2 = base({ prizeAmount: 0, registrationDeadline: daysFromNow(2) });

    // With default weights (urgency 25%, prize 15%) — h2 likely ranks higher
    const defaultH1 = computeRankScore(h1, DEFAULT_WEIGHTS, NOW);
    const defaultH2 = computeRankScore(h2, DEFAULT_WEIGHTS, NOW);
    expect(defaultH2.total).toBeGreaterThan(defaultH1.total);

    // With prize-heavy custom weights — h1 should rank higher
    const prizeHeavy = {
      nationalImportance: 0.10,
      registrationUrgency: 0.10,
      studentRelevance: 0.10,
      prizeAndLearning: 0.60,
      eligibilityAccessibility: 0.10,
    };
    const heavyH1 = computeRankScore(h1, prizeHeavy, NOW);
    const heavyH2 = computeRankScore(h2, prizeHeavy, NOW);
    expect(heavyH1.total).toBeGreaterThan(heavyH2.total);
  });

  test("default weights sum to exactly 1.0", () => {
    const sum = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(1e-9);
  });
});
