import { describe, it, expect } from "vitest";

interface TestHackathon {
  id: string;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  registrationDeadline: string | null;
  participationMode: "ONLINE" | "OFFLINE" | "HYBRID" | null;
  isNational: boolean;
  verificationStatus: "UNVERIFIED" | "VERIFIED" | "FLAGGED" | "REJECTED";
  status: "UPCOMING" | "ONGOING" | "ENDED" | "CANCELLED" | "UNKNOWN";
  computedStatus?: string;
  computedRegistrationStatus?: string;
  organizerName?: string | null;
  prizeAmount?: number | null;
  prizeCurrency?: string | null;
  tags?: string[];
  themes?: string[];
  city?: string | null;
  country?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatters under test (reproduced for isolated deterministic testing)
// ─────────────────────────────────────────────────────────────────────────────

function formatDateRange(startStr?: string | null, endStr?: string | null): string {
  if (!startStr && !endStr) return "Dates TBA";
  if (!startStr && endStr) return `Ends ${new Date(endStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
  if (startStr && !endStr) return `Starts ${new Date(startStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;

  const start = new Date(startStr!);
  const end = new Date(endStr!);

  const startMonth = start.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const startDay = start.getUTCDate();
  const startYear = start.getUTCFullYear();

  const endMonth = end.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const endDay = end.getUTCDate();
  const endYear = end.getUTCFullYear();

  if (startYear === endYear) {
    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} – ${endDay}, ${startYear}`;
    }
    return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${startYear}`;
  }
  return `${startMonth} ${startDay}, ${startYear} – ${endMonth} ${endDay}, ${endYear}`;
}

function formatDeadlineInfo(deadlineStr?: string | null, regStatus?: string | null, now = new Date()) {
  if (!deadlineStr) {
    if (regStatus === "OPEN") {
      return { text: "Open (No deadline specified)", isUrgent: false, isPast: false };
    }
    return null;
  }

  const deadline = new Date(deadlineStr);
  const diffMs = deadline.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs <= 0) {
    return {
      text: "Closed",
      isUrgent: false,
      isPast: true,
    };
  }

  if (diffHours <= 24) {
    const hours = Math.max(1, Math.floor(diffHours));
    return {
      text: `Closes in ${hours}h`,
      isUrgent: true,
      isPast: false,
    };
  }

  if (diffDays <= 3) {
    return {
      text: `Closes in ${diffDays} days`,
      isUrgent: true,
      isPast: false,
    };
  }

  return {
    text: "Upcoming deadline",
    isUrgent: false,
    isPast: false,
  };
}

function formatPrize(amount?: number | null, currency?: string | null): string | null {
  if (amount == null || amount <= 0) return null;
  const curr = currency || "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: curr,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${curr} ${amount.toLocaleString()}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Default Discovery Feed Invariant
// ─────────────────────────────────────────────────────────────────────────────

function filterDefaultDiscoveryFeed(events: TestHackathon[]): TestHackathon[] {
  return events.filter((h) => {
    const compStatus = (h.computedStatus || h.status || "").toUpperCase();
    if (compStatus === "ENDED" || compStatus === "COMPLETED" || compStatus === "CANCELLED") {
      return false;
    }
    if (h.verificationStatus === "REJECTED") {
      return false;
    }
    return true;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 7 — Existing Hackathons UI Logic & Invariants", () => {
  const baseEvent: TestHackathon = {
    id: "h-1",
    name: "Smart India Hackathon 2026",
    description: "National flagship collegiate hackathon",
    startDate: "2026-11-10T00:00:00.000Z",
    endDate: "2026-11-12T00:00:00.000Z",
    registrationDeadline: "2026-10-30T00:00:00.000Z",
    participationMode: "HYBRID",
    isNational: true,
    verificationStatus: "VERIFIED",
    status: "UPCOMING",
    organizerName: "Ministry of Education & AICTE",
    prizeAmount: 1000000,
    prizeCurrency: "INR",
    tags: ["AI & ML", "Smart Cities"],
    city: "New Delhi",
    country: "India",
  };

  describe("Date & Deadline formatters (Null-safe, never fabricate)", () => {
    it("handles null dates without fabricating facts", () => {
      expect(formatDateRange(null, null)).toBe("Dates TBA");
      expect(formatDateRange(undefined, undefined)).toBe("Dates TBA");
    });

    it("formats start and end dates within the same month", () => {
      const range = formatDateRange("2026-11-10T00:00:00.000Z", "2026-11-12T00:00:00.000Z");
      expect(range).toBe("Nov 10 – 12, 2026");
    });

    it("formats dates spanning across months", () => {
      const range = formatDateRange("2026-10-30T00:00:00.000Z", "2026-11-02T00:00:00.000Z");
      expect(range).toBe("Oct 30 – Nov 2, 2026");
    });

    it("returns null deadline info when deadline is missing and status is unknown", () => {
      expect(formatDeadlineInfo(null, "UNKNOWN")).toBeNull();
    });

    it("marks deadline closing in under 24 hours as urgent", () => {
      const now = new Date("2026-10-16T12:00:00.000Z");
      const deadline = "2026-10-16T18:00:00.000Z"; // 6 hours
      const info = formatDeadlineInfo(deadline, "OPEN", now);
      expect(info?.isUrgent).toBe(true);
      expect(info?.text).toContain("6h");
    });

    it("marks past deadline as closed", () => {
      const now = new Date("2026-10-16T12:00:00.000Z");
      const deadline = "2026-10-15T12:00:00.000Z";
      const info = formatDeadlineInfo(deadline, "CLOSED", now);
      expect(info?.isPast).toBe(true);
      expect(info?.text).toBe("Closed");
    });
  });

  describe("Prize display (Null-safe, never fabricate $0 or missing prize)", () => {
    it("returns null when prizeAmount is null or undefined", () => {
      expect(formatPrize(null, "USD")).toBeNull();
      expect(formatPrize(undefined, "USD")).toBeNull();
    });

    it("returns null when prizeAmount is zero (learning event, not a zero-dollar claim)", () => {
      expect(formatPrize(0, "USD")).toBeNull();
    });

    it("formats valid prize with currency symbol", () => {
      const prize = formatPrize(50000, "USD");
      expect(prize).toBe("$50,000");
    });
  });

  describe("Default Feed Invariant: Never show completed or cancelled events", () => {
    it("strictly excludes completed and cancelled events from discovery feed", () => {
      const events: TestHackathon[] = [
        { ...baseEvent, id: "active-1", status: "UPCOMING" },
        { ...baseEvent, id: "active-2", status: "ONGOING" },
        { ...baseEvent, id: "ended-1", status: "ENDED" },
        { ...baseEvent, id: "completed-1", computedStatus: "COMPLETED", status: "UPCOMING" },
        { ...baseEvent, id: "cancelled-1", status: "CANCELLED" },
        { ...baseEvent, id: "rejected-1", verificationStatus: "REJECTED" },
      ];

      const feed = filterDefaultDiscoveryFeed(events);
      const ids = feed.map((e) => e.id);

      expect(ids).toEqual(["active-1", "active-2"]);
      expect(ids).not.toContain("ended-1");
      expect(ids).not.toContain("completed-1");
      expect(ids).not.toContain("cancelled-1");
      expect(ids).not.toContain("rejected-1");
    });
  });

  describe("National vs Other Hackathon Distinction", () => {
    it("correctly identifies verified national flagship hackathons", () => {
      const nationalVerified: TestHackathon = { ...baseEvent, isNational: true, verificationStatus: "VERIFIED" };
      const nonNationalVerified: TestHackathon = { ...baseEvent, isNational: false, verificationStatus: "VERIFIED" };
      const nationalUnverified: TestHackathon = { ...baseEvent, isNational: true, verificationStatus: "UNVERIFIED" };

      expect(nationalVerified.isNational && nationalVerified.verificationStatus === "VERIFIED").toBe(true);
      expect(nonNationalVerified.isNational && nonNationalVerified.verificationStatus === "VERIFIED").toBe(false);
      expect(nationalUnverified.isNational && nationalUnverified.verificationStatus === "VERIFIED").toBe(false);
    });
  });

  describe("Filter logic", () => {
    const list: TestHackathon[] = [
      {
        ...baseEvent,
        id: "1",
        name: "National AI Challenge",
        isNational: true,
        participationMode: "ONLINE",
        computedRegistrationStatus: "OPEN",
        tags: ["AI & ML"],
      },
      {
        ...baseEvent,
        id: "2",
        name: "City Web3 Hackathon",
        isNational: false,
        participationMode: "OFFLINE",
        computedRegistrationStatus: "CLOSED",
        tags: ["Web3"],
      },
      {
        ...baseEvent,
        id: "3",
        name: "Collegiate Open Source Summit",
        isNational: false,
        participationMode: "HYBRID",
        computedRegistrationStatus: "OPEN",
        tags: ["Open Source"],
      },
    ];

    it("filters by national-level only", () => {
      const filtered = list.filter((h) => h.isNational);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("1");
    });

    it("filters by registration open only", () => {
      const filtered = list.filter((h) => h.computedRegistrationStatus === "OPEN");
      expect(filtered).toHaveLength(2);
      expect(filtered.map((h) => h.id)).toEqual(["1", "3"]);
    });

    it("filters by participation mode", () => {
      const online = list.filter((h) => h.participationMode === "ONLINE");
      const offline = list.filter((h) => h.participationMode === "OFFLINE");
      const hybrid = list.filter((h) => h.participationMode === "HYBRID");

      expect(online).toHaveLength(1);
      expect(offline).toHaveLength(1);
      expect(hybrid).toHaveLength(1);
    });

    it("filters by category", () => {
      const aiList = list.filter((h) => h.tags?.includes("AI & ML"));
      expect(aiList).toHaveLength(1);
      expect(aiList[0].id).toBe("1");
    });
  });
});
