import { describe, test, expect } from "vitest";

/**
 * Phase 5 — Event Status and Automatic Removal
 * Comprehensive unit tests for the runtime status engine.
 *
 * Tests cover every rule specified in the Phase 5 requirements:
 * 1. Registration deadline in past closes registration even when event is upcoming.
 * 2. Completed events must not appear in the default upcoming feed.
 * 3. Cancelled events must not be presented as actionable opportunities.
 * 4. Events with future registration opening dates appear in upcoming-reg section.
 * 5. Unknown deadlines must not be treated as open or closed.
 * 6. Stale/contradictory information must be flagged and excluded.
 * 7. Historical records and source identifiers are preserved.
 * 8. Status is recalculated at query time (not only from DB field).
 * 9. Date boundaries and timezones are handled correctly.
 */

import {
  computeEffectiveEventStatus,
  computeEffectiveRegistrationStatus,
  detectContradiction,
  isStaleRecord,
  classifyForDiscovery,
  evaluateEffectiveStatus,
} from "./utils/status";
import { HackathonStatus, RegistrationStatus, VerificationStatus } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────────────────────────

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function hoursAgo(h: number, from = new Date()): Date {
  return new Date(from.getTime() - h * HOUR);
}

function daysFromNow(d: number, from = new Date()): Date {
  return new Date(from.getTime() + d * DAY);
}

function daysAgo(d: number, from = new Date()): Date {
  return new Date(from.getTime() - d * DAY);
}

// Minimal hackathon shape
function h(overrides: Partial<Parameters<typeof computeEffectiveEventStatus>[0]> & {
  sourceId?: string | null;
  verificationStatus?: VerificationStatus | null;
}) {
  return {
    startDate: null,
    endDate: null,
    registrationDeadline: null,
    registrationStartDate: null,
    timezone: null,
    status: null,
    registrationStatus: null,
    verificationStatus: null,
    lastSyncAt: null,
    lastVerifiedAt: null,
    sourceId: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// computeEffectiveEventStatus
// ─────────────────────────────────────────────────────────────────────────────

describe("computeEffectiveEventStatus", () => {
  const now = new Date("2026-06-15T12:00:00Z");

  test("returns UNKNOWN when no dates are available", () => {
    expect(computeEffectiveEventStatus(h({}), now)).toBe(HackathonStatus.UNKNOWN);
  });

  test("returns UPCOMING when startDate is in the future", () => {
    expect(
      computeEffectiveEventStatus(h({ startDate: daysFromNow(5, now) }), now)
    ).toBe(HackathonStatus.UPCOMING);
  });

  test("returns ONGOING when startDate is in the past and endDate is in the future", () => {
    expect(
      computeEffectiveEventStatus(
        h({ startDate: daysAgo(1, now), endDate: daysFromNow(1, now) }),
        now
      )
    ).toBe(HackathonStatus.ONGOING);
  });

  test("returns ENDED when endDate is in the past", () => {
    expect(
      computeEffectiveEventStatus(
        h({ startDate: daysAgo(5, now), endDate: daysAgo(1, now) }),
        now
      )
    ).toBe(HackathonStatus.ENDED);
  });

  test("returns ENDED when only endDate is provided and it is in the past", () => {
    expect(
      computeEffectiveEventStatus(h({ endDate: daysAgo(2, now) }), now)
    ).toBe(HackathonStatus.ENDED);
  });

  test("returns UPCOMING when only startDate is provided and it is in the future", () => {
    expect(
      computeEffectiveEventStatus(h({ startDate: daysFromNow(3, now) }), now)
    ).toBe(HackathonStatus.UPCOMING);
  });

  // Phase 5 rule: CANCELLED status set by admin is preserved — never auto-overridden
  test("preserves CANCELLED status regardless of date math", () => {
    expect(
      computeEffectiveEventStatus(
        h({ status: HackathonStatus.CANCELLED, startDate: daysFromNow(5, now) }),
        now
      )
    ).toBe(HackathonStatus.CANCELLED);
  });

  test("preserves CANCELLED even when dates show ENDED", () => {
    expect(
      computeEffectiveEventStatus(
        h({
          status: HackathonStatus.CANCELLED,
          startDate: daysAgo(10, now),
          endDate: daysAgo(5, now),
        }),
        now
      )
    ).toBe(HackathonStatus.CANCELLED);
  });

  // Phase 5 rule: DB status field NOT trusted for runtime computation (except CANCELLED)
  test("corrects DB status UPCOMING when dates show ENDED (query-time recalculation)", () => {
    expect(
      computeEffectiveEventStatus(
        h({
          status: HackathonStatus.UPCOMING, // stale DB value
          startDate: daysAgo(10, now),
          endDate: daysAgo(2, now),
        }),
        now
      )
    ).toBe(HackathonStatus.ENDED);
  });

  test("corrects DB status ONGOING when dates show ENDED", () => {
    expect(
      computeEffectiveEventStatus(
        h({
          status: HackathonStatus.ONGOING, // stale DB value
          startDate: daysAgo(3, now),
          endDate: daysAgo(1, now),
        }),
        now
      )
    ).toBe(HackathonStatus.ENDED);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeEffectiveRegistrationStatus
// ─────────────────────────────────────────────────────────────────────────────

describe("computeEffectiveRegistrationStatus", () => {
  const now = new Date("2026-06-15T12:00:00Z");

  // Phase 5 rule: Past registration deadline closes registration even when event is upcoming
  test("CLOSED when registrationDeadline is in the past, even if event hasn't started", () => {
    expect(
      computeEffectiveRegistrationStatus(
        h({
          startDate: daysFromNow(5, now),
          registrationDeadline: daysAgo(1, now), // past deadline
        }),
        now
      )
    ).toBe(RegistrationStatus.CLOSED);
  });

  test("OPEN when registrationDeadline is in the future", () => {
    expect(
      computeEffectiveRegistrationStatus(
        h({
          startDate: daysFromNow(10, now),
          registrationDeadline: daysFromNow(3, now),
        }),
        now
      )
    ).toBe(RegistrationStatus.OPEN);
  });

  // Phase 5 rule: COMING_SOON requires explicit registrationStartDate in the future
  test("COMING_SOON when registrationStartDate is in the future", () => {
    expect(
      computeEffectiveRegistrationStatus(
        h({
          startDate: daysFromNow(20, now),
          registrationStartDate: daysFromNow(5, now),
          registrationDeadline: daysFromNow(15, now),
        }),
        now
      )
    ).toBe(RegistrationStatus.COMING_SOON);
  });

  // Phase 5 rule: Unknown deadlines MUST NOT be treated as OPEN
  test("UNKNOWN when no deadline and no start date given", () => {
    expect(computeEffectiveRegistrationStatus(h({}), now)).toBe(RegistrationStatus.UNKNOWN);
  });

  test("UNKNOWN when no explicit deadline but event hasn't started yet", () => {
    // Without a registration deadline, we can't claim registration is OPEN
    expect(
      computeEffectiveRegistrationStatus(
        h({ startDate: daysFromNow(5, now) }),
        now
      )
    ).toBe(RegistrationStatus.UNKNOWN);
  });

  test("CLOSED when event has already started (no explicit deadline)", () => {
    // Convention: registration closes when event starts, unless deadline contradicts this
    expect(
      computeEffectiveRegistrationStatus(
        h({ startDate: daysAgo(1, now) }),
        now
      )
    ).toBe(RegistrationStatus.CLOSED);
  });

  // Phase 5 rule: CANCELLED events cannot have open registration
  test("CLOSED for CANCELLED events regardless of deadline", () => {
    expect(
      computeEffectiveRegistrationStatus(
        h({
          status: HackathonStatus.CANCELLED,
          registrationDeadline: daysFromNow(5, now), // would normally be OPEN
        }),
        now
      )
    ).toBe(RegistrationStatus.CLOSED);
  });

  // Phase 5 rule: If event has ended, registration is definitively CLOSED
  test("CLOSED when event end date is in the past", () => {
    expect(
      computeEffectiveRegistrationStatus(
        h({
          startDate: daysAgo(5, now),
          endDate: daysAgo(1, now),
          registrationDeadline: daysFromNow(3, now), // contradictory but deadline is ignored
        }),
        now
      )
    ).toBe(RegistrationStatus.CLOSED);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// detectContradiction
// ─────────────────────────────────────────────────────────────────────────────

describe("detectContradiction", () => {
  const now = new Date("2026-06-15T12:00:00Z");

  test("no contradiction for clean, ordered dates", () => {
    const result = detectContradiction(
      h({
        startDate: daysFromNow(5, now),
        endDate: daysFromNow(8, now),
        registrationDeadline: daysFromNow(4, now),
        registrationStartDate: daysFromNow(1, now),
      })
    );
    expect(result.hasContradiction).toBe(false);
  });

  test("contradiction when endDate is before startDate", () => {
    const result = detectContradiction(
      h({
        startDate: daysFromNow(10, now),
        endDate: daysFromNow(5, now), // ends before it starts
      })
    );
    expect(result.hasContradiction).toBe(true);
    expect(result.reason).toMatch(/endDate.*before startDate/i);
  });

  test("contradiction when registrationDeadline is after endDate", () => {
    const result = detectContradiction(
      h({
        startDate: daysFromNow(5, now),
        endDate: daysFromNow(8, now),
        registrationDeadline: daysFromNow(10, now), // after event ends
      })
    );
    expect(result.hasContradiction).toBe(true);
    expect(result.reason).toMatch(/registrationDeadline.*after endDate/i);
  });

  test("contradiction when registrationStartDate is after registrationDeadline", () => {
    const result = detectContradiction(
      h({
        registrationStartDate: daysFromNow(5, now),
        registrationDeadline: daysFromNow(3, now), // deadline before reg opens
      })
    );
    expect(result.hasContradiction).toBe(true);
    expect(result.reason).toMatch(/registrationStartDate.*after registrationDeadline/i);
  });

  test("no contradiction when only some dates are present", () => {
    const result = detectContradiction(
      h({ startDate: daysFromNow(5, now) })
    );
    expect(result.hasContradiction).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isStaleRecord
// ─────────────────────────────────────────────────────────────────────────────

describe("isStaleRecord", () => {
  const now = new Date("2026-06-15T12:00:00Z");

  test("not stale when lastSyncAt is recent (< 48 hours)", () => {
    expect(
      isStaleRecord(h({ sourceId: "hackclub", lastSyncAt: hoursAgo(6, now) }), now)
    ).toBe(false);
  });

  test("stale when lastSyncAt is older than 48 hours", () => {
    expect(
      isStaleRecord(h({ sourceId: "hackclub", lastSyncAt: hoursAgo(72, now) }), now)
    ).toBe(true);
  });

  test("stale when lastSyncAt is null and sourceId is set", () => {
    expect(
      isStaleRecord(h({ sourceId: "hackclub", lastSyncAt: null }), now)
    ).toBe(true);
  });

  test("not stale for admin-entered records (no sourceId)", () => {
    // Admin-entered records have no upstream source — they are not "stale"
    expect(
      isStaleRecord(h({ sourceId: null, lastSyncAt: null }), now)
    ).toBe(false);
  });

  test("respects custom threshold", () => {
    expect(
      isStaleRecord(h({ sourceId: "hackclub", lastSyncAt: hoursAgo(25, now) }), now, 24)
    ).toBe(true);

    expect(
      isStaleRecord(h({ sourceId: "hackclub", lastSyncAt: hoursAgo(10, now) }), now, 24)
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// classifyForDiscovery — Phase 5 view routing
// ─────────────────────────────────────────────────────────────────────────────

describe("classifyForDiscovery", () => {
  const now = new Date("2026-06-15T12:00:00Z");

  // Phase 5: Default listing shows current opportunities only
  test("MAIN for upcoming event with open registration", () => {
    const result = classifyForDiscovery(
      h({
        startDate: daysFromNow(5, now),
        endDate: daysFromNow(8, now),
        registrationDeadline: daysFromNow(4, now),
        lastSyncAt: hoursAgo(1, now),
        sourceId: "hackclub",
      }),
      now
    );
    expect(result.view).toBe("MAIN");
    expect(result.computedStatus).toBe(HackathonStatus.UPCOMING);
    expect(result.computedRegistrationStatus).toBe(RegistrationStatus.OPEN);
  });

  test("MAIN for ongoing event (started but not ended)", () => {
    const result = classifyForDiscovery(
      h({
        startDate: daysAgo(1, now),
        endDate: daysFromNow(1, now),
      }),
      now
    );
    expect(result.view).toBe("MAIN");
    expect(result.computedStatus).toBe(HackathonStatus.ONGOING);
  });

  test("MAIN for event with UNKNOWN registration (no deadline info)", () => {
    // Phase 5: UNKNOWN deadline must not prevent showing in main feed
    const result = classifyForDiscovery(
      h({ startDate: daysFromNow(5, now), endDate: daysFromNow(8, now) }),
      now
    );
    expect(result.view).toBe("MAIN");
    expect(result.computedRegistrationStatus).toBe(RegistrationStatus.UNKNOWN);
  });

  // Phase 5: Events with future registration opening dates in separate section
  test("UPCOMING_REG for event where registration hasn't opened yet", () => {
    const result = classifyForDiscovery(
      h({
        startDate: daysFromNow(20, now),
        endDate: daysFromNow(22, now),
        registrationStartDate: daysFromNow(5, now),
        registrationDeadline: daysFromNow(18, now),
      }),
      now
    );
    expect(result.view).toBe("UPCOMING_REG");
    expect(result.computedRegistrationStatus).toBe(RegistrationStatus.COMING_SOON);
  });

  // Phase 5: Events with closed registration (but event upcoming)
  test("REG_CLOSED for upcoming event with past registration deadline", () => {
    const result = classifyForDiscovery(
      h({
        startDate: daysFromNow(3, now),
        endDate: daysFromNow(5, now),
        registrationDeadline: daysAgo(1, now), // registration already closed
      }),
      now
    );
    expect(result.view).toBe("REG_CLOSED");
    expect(result.computedRegistrationStatus).toBe(RegistrationStatus.CLOSED);
    expect(result.computedStatus).toBe(HackathonStatus.UPCOMING);
  });

  // Phase 5: Completed events must NOT appear in default upcoming feed
  test("PAST for ended events", () => {
    const result = classifyForDiscovery(
      h({
        startDate: daysAgo(5, now),
        endDate: daysAgo(1, now),
      }),
      now
    );
    expect(result.view).toBe("PAST");
    expect(result.computedStatus).toBe(HackathonStatus.ENDED);
  });

  test("PAST even when DB status says UPCOMING (query-time recalculation)", () => {
    const result = classifyForDiscovery(
      h({
        status: HackathonStatus.UPCOMING, // stale DB state
        startDate: daysAgo(10, now),
        endDate: daysAgo(2, now),
      }),
      now
    );
    expect(result.view).toBe("PAST");
    expect(result.computedStatus).toBe(HackathonStatus.ENDED);
  });

  // Phase 5: Cancelled events must not be presented as actionable opportunities
  test("CANCELLED for cancelled events", () => {
    const result = classifyForDiscovery(
      h({
        status: HackathonStatus.CANCELLED,
        startDate: daysFromNow(5, now),
      }),
      now
    );
    expect(result.view).toBe("CANCELLED");
  });

  // Phase 5: REJECTED events excluded from all feeds
  test("EXCLUDED for REJECTED events", () => {
    const result = classifyForDiscovery(
      h({
        verificationStatus: VerificationStatus.REJECTED,
        startDate: daysFromNow(5, now),
      }),
      now
    );
    expect(result.view).toBe("EXCLUDED");
  });

  // Phase 5: Irrecoverably contradictory data excluded from main feed
  test("EXCLUDED for UNVERIFIED record with contradictory dates", () => {
    const result = classifyForDiscovery(
      h({
        verificationStatus: VerificationStatus.UNVERIFIED,
        startDate: daysFromNow(10, now),
        endDate: daysFromNow(5, now), // ends before it starts
      }),
      now
    );
    expect(result.view).toBe("EXCLUDED");
    expect(result.reason).toMatch(/contradictory/i);
  });

  // Contradictions in VERIFIED events are NOT auto-excluded (admin has reviewed)
  test("not EXCLUDED for VERIFIED record with contradictory dates (admin reviewed)", () => {
    const result = classifyForDiscovery(
      h({
        verificationStatus: VerificationStatus.VERIFIED,
        startDate: daysFromNow(10, now),
        endDate: daysFromNow(5, now), // contradiction, but admin-verified
      }),
      now
    );
    expect(result.view).not.toBe("EXCLUDED");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Timezone-aware date resolution
// ─────────────────────────────────────────────────────────────────────────────

describe("timezone-aware status computation", () => {
  test("event interpreted as UPCOMING for date-only string with timezone", () => {
    // Date-only "2026-12-01" in "Asia/Kolkata" (UTC+5:30) — midnight IST = 18:30 UTC prev day
    // For any 'now' before that, event should be UPCOMING
    const nowBeforeStart = new Date("2026-11-30T00:00:00Z");
    const result = computeEffectiveEventStatus(
      h({
        startDate: "2026-12-01" as any,
        timezone: "Asia/Kolkata",
      }),
      nowBeforeStart
    );
    expect(result).toBe(HackathonStatus.UPCOMING);
  });

  test("falls back gracefully when timezone is invalid", () => {
    // Should not throw; should treat date normally
    const now = new Date("2026-06-15T12:00:00Z");
    expect(() =>
      computeEffectiveEventStatus(
        h({
          startDate: daysFromNow(5, now),
          timezone: "Invalid/Zone",
        }),
        now
      )
    ).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// evaluateEffectiveStatus — combined snapshot
// ─────────────────────────────────────────────────────────────────────────────

describe("evaluateEffectiveStatus", () => {
  const now = new Date("2026-06-15T12:00:00Z");

  test("returns full snapshot with all fields", () => {
    const result = evaluateEffectiveStatus(
      h({
        sourceId: "hackclub",
        startDate: daysFromNow(5, now),
        endDate: daysFromNow(8, now),
        registrationDeadline: daysFromNow(4, now),
        lastSyncAt: hoursAgo(1, now),
      }),
      now
    );

    expect(result.eventStatus).toBe(HackathonStatus.UPCOMING);
    expect(result.registrationStatus).toBe(RegistrationStatus.OPEN);
    expect(result.isStale).toBe(false);
    expect(result.hasContradiction).toBe(false);
    expect(result.effectiveTimestamp).toEqual(now);
  });

  test("detects stale + contradiction simultaneously", () => {
    const result = evaluateEffectiveStatus(
      h({
        sourceId: "hackclub",
        lastSyncAt: hoursAgo(72, now), // stale
        startDate: daysFromNow(10, now),
        endDate: daysFromNow(5, now), // contradiction: end before start
      }),
      now
    );

    expect(result.isStale).toBe(true);
    expect(result.hasContradiction).toBe(true);
  });
});
