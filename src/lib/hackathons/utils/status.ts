import {
  HackathonStatus,
  RegistrationStatus,
  VerificationStatus,
} from "@prisma/client";

/**
 * Minimal shape of a hackathon record required for status computation.
 * Works with both raw DB rows and normalized inputs.
 */
export interface HackathonForStatus {
  id?: string;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  registrationDeadline?: Date | string | null;
  registrationStartDate?: Date | string | null;
  timezone?: string | null;
  status?: HackathonStatus | null;
  registrationStatus?: RegistrationStatus | null;
  verificationStatus?: VerificationStatus | null;
  lastSyncAt?: Date | string | null;
  lastVerifiedAt?: Date | string | null;
}

/**
 * Result of evaluating a hackathon's effective state at query time.
 */
export interface EffectiveStatusResult {
  eventStatus: HackathonStatus;
  registrationStatus: RegistrationStatus;
  isStale: boolean;
  hasContradiction: boolean;
  contradictionReason?: string;
  effectiveTimestamp: Date;
}

/**
 * Classification of an event for the discovery API.
 * Determines which view section the event belongs to.
 */
export type DiscoveryView =
  | "MAIN"              // Current opportunities — UPCOMING/ONGOING with open/unknown registration
  | "UPCOMING_REG"      // Upcoming event but registration not yet open (COMING_SOON)
  | "REG_CLOSED"        // Upcoming event but registration is already closed
  | "PAST"              // Ended events — historical record
  | "CANCELLED"         // Cancelled events
  | "EXCLUDED";         // Rejected, irreparably contradictory, or dangerous stale data

export interface DiscoveryClassification {
  view: DiscoveryView;
  reason: string;
  computedStatus: HackathonStatus;
  computedRegistrationStatus: RegistrationStatus;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Number of hours after which a record with an active source is considered stale.
 * Events from known sources (hackclub, kaggle) should be refreshed on the
 * configured 8-hour cron. 48 hours gives 6× tolerance before flagging.
 */
const STALE_THRESHOLD_HOURS = 48;

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Resolve a UTC date from a stored timestamp, optionally applying a source
 * IANA timezone when the stored value is "date-only" (no time component).
 *
 * All API sources so far (Hack Club, Kaggle) provide full ISO-8601 UTC
 * timestamps. Timezone correction is applied only when the stored value looks
 * like a date-only string (e.g. "2026-11-01") and a timezone hint is present.
 */
function resolveUtcDate(
  value: Date | string | null | undefined,
  timezone?: string | null
): Date | null {
  const raw = toDate(value);
  if (!raw) return null;

  // If the value was a date-only ISO string AND a timezone is available,
  // interpret midnight in that timezone rather than UTC midnight.
  if (
    timezone &&
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
  ) {
    try {
      // Use Intl.DateTimeFormat to find the UTC offset for this timezone on this date
      const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      // Build a reference datetime string and parse back
      const parts = fmt.formatToParts(raw);
      const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
      const localIso = `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
      const localDate = new Date(localIso);
      if (!isNaN(localDate.getTime())) return localDate;
    } catch {
      // Timezone parsing failed; fall back to raw date
    }
  }

  return raw;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core status computation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the authoritative event lifecycle status from timestamps at the
 * given point in time. Never trusts the stored DB `status` field alone —
 * always re-derives from the actual date boundaries.
 *
 * Phase 5 rules applied:
 * - An ended event (endDate < now) is ENDED regardless of DB status.
 * - A started but not yet ended event is ONGOING.
 * - Events with no date information remain UNKNOWN, never UPCOMING.
 * - CANCELLED status set by admins is preserved (passed through as-is).
 */
export function computeEffectiveEventStatus(
  h: HackathonForStatus,
  now: Date = new Date()
): HackathonStatus {
  // Admin CANCELLED is authoritative — never override it via date math.
  if (h.status === HackathonStatus.CANCELLED) {
    return HackathonStatus.CANCELLED;
  }

  const startDate = resolveUtcDate(h.startDate, h.timezone);
  const endDate = resolveUtcDate(h.endDate, h.timezone);
  const nowMs = now.getTime();

  if (!startDate && !endDate) return HackathonStatus.UNKNOWN;

  if (endDate && nowMs > endDate.getTime()) return HackathonStatus.ENDED;

  if (startDate && nowMs >= startDate.getTime()) {
    if (!endDate || nowMs <= endDate.getTime()) return HackathonStatus.ONGOING;
    return HackathonStatus.ENDED;
  }

  if (startDate && nowMs < startDate.getTime()) return HackathonStatus.UPCOMING;

  return HackathonStatus.UNKNOWN;
}

/**
 * Compute the authoritative registration window status at the given point in
 * time. Always derived deterministically from deadline and start dates.
 *
 * Phase 5 rules applied:
 * - A past registrationDeadline closes registration even if the event is still UPCOMING.
 * - COMING_SOON requires an explicit registrationStartDate in the future.
 * - When NO deadline and NO start date is known → UNKNOWN (never assume OPEN).
 * - When the event itself has ended → CLOSED regardless of deadline.
 */
export function computeEffectiveRegistrationStatus(
  h: HackathonForStatus,
  now: Date = new Date()
): RegistrationStatus {
  const nowMs = now.getTime();

  // CANCELLED events can't have open registration
  if (h.status === HackathonStatus.CANCELLED) return RegistrationStatus.CLOSED;

  const regDeadline = resolveUtcDate(h.registrationDeadline, h.timezone);
  const regStart = resolveUtcDate(h.registrationStartDate, h.timezone);
  const eventStart = resolveUtcDate(h.startDate, h.timezone);
  const eventEnd = resolveUtcDate(h.endDate, h.timezone);

  // If the event has ended, registration is definitively CLOSED
  if (eventEnd && nowMs > eventEnd.getTime()) return RegistrationStatus.CLOSED;

  // Explicit registration deadline is the most authoritative signal
  if (regDeadline) {
    if (nowMs > regDeadline.getTime()) return RegistrationStatus.CLOSED;
    if (regStart && nowMs < regStart.getTime()) return RegistrationStatus.COMING_SOON;
    return RegistrationStatus.OPEN;
  }

  // No explicit deadline: use event start as the registration close proxy
  if (eventStart) {
    if (nowMs >= eventStart.getTime()) return RegistrationStatus.CLOSED;
    // Without a deadline we CANNOT assume the deadline is the event start.
    // Return UNKNOWN so the UI does not display "Open" with false confidence.
    return RegistrationStatus.UNKNOWN;
  }

  // Phase 5 rule: unknown deadlines MUST NOT be treated as OPEN or CLOSED.
  return RegistrationStatus.UNKNOWN;
}

// ─────────────────────────────────────────────────────────────────────────────
// Staleness & contradiction detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true when a record has not been refreshed from its source within
 * the staleness threshold. Records with no sourceId (admin-entered) are exempt.
 */
export function isStaleRecord(
  h: HackathonForStatus & { sourceId?: string | null },
  now: Date = new Date(),
  thresholdHours: number = STALE_THRESHOLD_HOURS
): boolean {
  // Admin-entered records have no upstream source to poll
  if (!h.sourceId) return false;

  const lastSync = toDate(h.lastSyncAt);
  if (!lastSync) return true; // Never synced is stale

  const ageMs = now.getTime() - lastSync.getTime();
  return ageMs > thresholdHours * 60 * 60 * 1000;
}

/**
 * Detects self-contradictory date configurations that indicate corrupt or
 * severely inconsistent source data. Returns a reason string when found.
 *
 * Checked contradictions:
 * - registrationDeadline is after endDate (impossible for most hackathons)
 * - endDate is before startDate
 * - registrationStartDate is after registrationDeadline
 */
export function detectContradiction(
  h: HackathonForStatus
): { hasContradiction: boolean; reason?: string } {
  const startDate = toDate(h.startDate);
  const endDate = toDate(h.endDate);
  const regDeadline = toDate(h.registrationDeadline);
  const regStart = toDate(h.registrationStartDate);

  if (startDate && endDate && endDate < startDate) {
    return {
      hasContradiction: true,
      reason: `endDate (${endDate.toISOString()}) is before startDate (${startDate.toISOString()})`,
    };
  }

  if (regDeadline && endDate && regDeadline > endDate) {
    return {
      hasContradiction: true,
      reason: `registrationDeadline (${regDeadline.toISOString()}) is after endDate (${endDate.toISOString()})`,
    };
  }

  if (regStart && regDeadline && regStart > regDeadline) {
    return {
      hasContradiction: true,
      reason: `registrationStartDate (${regStart.toISOString()}) is after registrationDeadline (${regDeadline.toISOString()})`,
    };
  }

  return { hasContradiction: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// Full status evaluation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the complete effective status snapshot for a hackathon record.
 */
export function evaluateEffectiveStatus(
  h: HackathonForStatus & { sourceId?: string | null },
  now: Date = new Date()
): EffectiveStatusResult {
  const eventStatus = computeEffectiveEventStatus(h, now);
  const registrationStatus = computeEffectiveRegistrationStatus(h, now);
  const isStale = isStaleRecord(h, now);
  const { hasContradiction, reason: contradictionReason } = detectContradiction(h);

  return {
    eventStatus,
    registrationStatus,
    isStale,
    hasContradiction,
    contradictionReason,
    effectiveTimestamp: now,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Discovery classifier
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classifies a hackathon into a discovery view bucket.
 *
 * Phase 5 rules applied:
 * - REJECTED events are always EXCLUDED.
 * - Irrecoverably contradictory data is EXCLUDED.
 * - CANCELLED events are classified as CANCELLED.
 * - ENDED events are classified as PAST.
 * - Events with COMING_SOON registration are in UPCOMING_REG, not the MAIN feed.
 * - Events with registration CLOSED (but event upcoming) are in REG_CLOSED.
 * - Events with UNKNOWN or OPEN registration and UPCOMING/ONGOING status → MAIN.
 * - Stale records with unknown status stay in MAIN but the caller should annotate them.
 */
export function classifyForDiscovery(
  h: HackathonForStatus & { sourceId?: string | null },
  now: Date = new Date()
): DiscoveryClassification {
  const { eventStatus, registrationStatus, isStale, hasContradiction, contradictionReason } =
    evaluateEffectiveStatus(h, now);

  // Always exclude REJECTED events
  if (h.verificationStatus === VerificationStatus.REJECTED) {
    return {
      view: "EXCLUDED",
      reason: "Event has been rejected by moderators",
      computedStatus: eventStatus,
      computedRegistrationStatus: registrationStatus,
    };
  }

  // Irrecoverable data contradictions — hide from all feeds
  if (hasContradiction && h.verificationStatus === VerificationStatus.UNVERIFIED) {
    return {
      view: "EXCLUDED",
      reason: `Contradictory date data detected: ${contradictionReason}`,
      computedStatus: eventStatus,
      computedRegistrationStatus: registrationStatus,
    };
  }

  if (eventStatus === HackathonStatus.CANCELLED) {
    return {
      view: "CANCELLED",
      reason: "Event has been cancelled",
      computedStatus: eventStatus,
      computedRegistrationStatus: registrationStatus,
    };
  }

  if (eventStatus === HackathonStatus.ENDED) {
    return {
      view: "PAST",
      reason: "Event has ended",
      computedStatus: eventStatus,
      computedRegistrationStatus: registrationStatus,
    };
  }

  // Active event (UPCOMING / ONGOING / UNKNOWN status)
  if (registrationStatus === RegistrationStatus.COMING_SOON) {
    return {
      view: "UPCOMING_REG",
      reason: "Registration opens soon — not yet accepting applications",
      computedStatus: eventStatus,
      computedRegistrationStatus: registrationStatus,
    };
  }

  if (registrationStatus === RegistrationStatus.CLOSED && eventStatus === HackathonStatus.UPCOMING) {
    return {
      view: "REG_CLOSED",
      reason: "Registration closed for this upcoming event",
      computedStatus: eventStatus,
      computedRegistrationStatus: registrationStatus,
    };
  }

  // Default: main discovery feed
  const staleSuffix = isStale ? " (data may be stale — awaiting sync refresh)" : "";
  return {
    view: "MAIN",
    reason: `Active opportunity${staleSuffix}`,
    computedStatus: eventStatus,
    computedRegistrationStatus: registrationStatus,
  };
}
