import {
  HackathonStatus,
  RegistrationStatus,
  ParticipationMode,
} from "@prisma/client";

/**
 * Deterministically parse a date string or timestamp into a valid Date object.
 * Returns null if the value is missing or unparseable.
 */
export function normalizeDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/**
 * Clean and validate a web URL.
 * Only permits valid http:// and https:// URLs.
 */
export function normalizeUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    // If it's missing protocol, try with https://
    try {
      const withHttps = new URL(`https://${trimmed}`);
      return withHttps.toString();
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Deterministically compute HackathonStatus from event dates.
 */
export function computeEventStatus(
  startDate: Date | null,
  endDate: Date | null,
  now: Date = new Date()
): HackathonStatus {
  if (!startDate && !endDate) {
    return HackathonStatus.UNKNOWN;
  }

  const nowMs = now.getTime();

  if (endDate && nowMs > endDate.getTime()) {
    return HackathonStatus.ENDED;
  }

  if (startDate && nowMs >= startDate.getTime()) {
    // Started but not yet ended
    if (!endDate || nowMs <= endDate.getTime()) {
      return HackathonStatus.ONGOING;
    }
    return HackathonStatus.ENDED;
  }

  if (startDate && nowMs < startDate.getTime()) {
    return HackathonStatus.UPCOMING;
  }

  return HackathonStatus.UNKNOWN;
}

/**
 * Deterministically compute RegistrationStatus from registration dates and event dates.
 */
export function computeRegistrationStatus(
  registrationDeadline: Date | null,
  registrationStartDate: Date | null,
  eventStartDate: Date | null,
  now: Date = new Date()
): RegistrationStatus {
  const nowMs = now.getTime();

  // If explicit registration deadline is known
  if (registrationDeadline) {
    if (nowMs > registrationDeadline.getTime()) {
      return RegistrationStatus.CLOSED;
    }
    if (registrationStartDate && nowMs < registrationStartDate.getTime()) {
      return RegistrationStatus.COMING_SOON;
    }
    return RegistrationStatus.OPEN;
  }

  // Fallback: If registration deadline is not explicitly given,
  // registration generally closes once the event starts.
  if (eventStartDate) {
    if (nowMs >= eventStartDate.getTime()) {
      return RegistrationStatus.CLOSED;
    }
    return RegistrationStatus.OPEN;
  }

  return RegistrationStatus.UNKNOWN;
}

/**
 * Determine participation mode based on source flags and location strings.
 */
export function computeParticipationMode(options: {
  isVirtual?: boolean;
  isHybrid?: boolean;
  location?: string | null;
}): ParticipationMode {
  const { isVirtual, isHybrid, location } = options;

  if (isHybrid) {
    return ParticipationMode.HYBRID;
  }

  if (isVirtual) {
    return ParticipationMode.ONLINE;
  }

  if (location) {
    const locLower = location.toLowerCase();
    if (locLower.includes("hybrid")) return ParticipationMode.HYBRID;
    if (locLower.includes("virtual") || locLower.includes("online") || locLower.includes("discord")) {
      return ParticipationMode.ONLINE;
    }
  }

  return ParticipationMode.OFFLINE;
}

/**
 * Deterministically extracts numeric prize amount and ISO currency from string or numeric values.
 * e.g. "$100,000" -> { amount: 100000, currency: "USD" }
 * e.g. "₹5,00,000" -> { amount: 500000, currency: "INR" }
 * e.g. "10,000 EUR" -> { amount: 10000, currency: "EUR" }
 */
export function parsePrizePool(raw: unknown): {
  amount: number | null;
  currency: string | null;
} {
  if (typeof raw === "number") {
    return { amount: raw > 0 ? raw : null, currency: null };
  }

  if (typeof raw !== "string" || !raw.trim()) {
    return { amount: null, currency: null };
  }

  const str = raw.trim();

  // Detect currency symbol or code
  let currency: string | null = null;
  if (str.includes("$") || /usd/i.test(str)) {
    currency = "USD";
  } else if (str.includes("₹") || /inr/i.test(str) || /rs\.?/i.test(str)) {
    currency = "INR";
  } else if (str.includes("€") || /eur/i.test(str)) {
    currency = "EUR";
  } else if (str.includes("£") || /gbp/i.test(str)) {
    currency = "GBP";
  }

  // Extract digits (handling commas)
  const numbersOnly = str.replace(/[^\d.]/g, "");
  const amount = parseFloat(numbersOnly);

  if (isNaN(amount) || amount <= 0) {
    return { amount: null, currency: null };
  }

  return { amount, currency: currency ?? "USD" };
}
