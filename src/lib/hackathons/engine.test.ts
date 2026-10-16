import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  normalizeDate,
  normalizeUrl,
  computeEventStatus,
  computeRegistrationStatus,
  computeParticipationMode,
  parsePrizePool,
} from "./utils/normalize";
import { withExponentialBackoff, isRetryableHttpStatus } from "./utils/retry";
import { acquireLock, releaseLock } from "./utils/lock";
import { HackClubAdapter } from "./adapters/hackclub";
import { KaggleAdapter } from "./adapters/kaggle";
import { HackathonStatus, RegistrationStatus, ParticipationMode } from "@prisma/client";

describe("Deterministic Normalization", () => {
  it("normalizes ISO date strings and handles invalid dates safely", () => {
    const valid = normalizeDate("2026-10-24T19:00:00.000Z");
    expect(valid).toBeInstanceOf(Date);
    expect(valid?.toISOString()).toBe("2026-10-24T19:00:00.000Z");

    expect(normalizeDate("invalid-date")).toBeNull();
    expect(normalizeDate(null)).toBeNull();
    expect(normalizeDate(undefined)).toBeNull();
  });

  it("normalizes and cleans URLs with protocol fallback", () => {
    expect(normalizeUrl("https://hackpenn.com")).toBe("https://hackpenn.com/");
    expect(normalizeUrl("hackpenn.com")).toBe("https://hackpenn.com/");
    expect(normalizeUrl("not a valid url $$$")).toBeNull();
    expect(normalizeUrl("")).toBeNull();
  });

  it("computes event status accurately based on timestamps", () => {
    const now = new Date("2026-10-20T12:00:00.000Z");

    // Upcoming
    const futureStart = new Date("2026-10-25T00:00:00.000Z");
    const futureEnd = new Date("2026-10-27T00:00:00.000Z");
    expect(computeEventStatus(futureStart, futureEnd, now)).toBe(HackathonStatus.UPCOMING);

    // Ongoing
    const pastStart = new Date("2026-10-18T00:00:00.000Z");
    expect(computeEventStatus(pastStart, futureEnd, now)).toBe(HackathonStatus.ONGOING);

    // Ended
    const pastEnd = new Date("2026-10-19T00:00:00.000Z");
    expect(computeEventStatus(pastStart, pastEnd, now)).toBe(HackathonStatus.ENDED);
  });

  it("computes registration status accurately", () => {
    const now = new Date("2026-10-20T12:00:00.000Z");

    const futureDeadline = new Date("2026-10-22T00:00:00.000Z");
    const pastDeadline = new Date("2026-10-18T00:00:00.000Z");

    expect(computeRegistrationStatus(futureDeadline, null, null, now)).toBe(RegistrationStatus.OPEN);
    expect(computeRegistrationStatus(pastDeadline, null, null, now)).toBe(RegistrationStatus.CLOSED);

    // Coming soon
    const futureRegStart = new Date("2026-10-21T00:00:00.000Z");
    expect(computeRegistrationStatus(futureDeadline, futureRegStart, null, now)).toBe(
      RegistrationStatus.COMING_SOON
    );
  });

  it("determines participation mode from flags and location text", () => {
    expect(computeParticipationMode({ isHybrid: true })).toBe(ParticipationMode.HYBRID);
    expect(computeParticipationMode({ isVirtual: true })).toBe(ParticipationMode.ONLINE);
    expect(computeParticipationMode({ location: "Virtual / Discord" })).toBe(ParticipationMode.ONLINE);
    expect(computeParticipationMode({ location: "Bengaluru, India" })).toBe(ParticipationMode.OFFLINE);
  });

  it("extracts prize amount and currency from diverse formats", () => {
    expect(parsePrizePool("$100,000")).toEqual({ amount: 100000, currency: "USD" });
    expect(parsePrizePool("₹5,00,000")).toEqual({ amount: 500000, currency: "INR" });
    expect(parsePrizePool("Swag & Trophies")).toEqual({ amount: null, currency: null });
    expect(parsePrizePool(null)).toEqual({ amount: null, currency: null });
  });
});

describe("Exponential Backoff & Retry Logic", () => {
  it("succeeds on first attempt without delay", async () => {
    const op = vi.fn().mockResolvedValue("success");
    const result = await withExponentialBackoff(op, { maxAttempts: 3, initialDelayMs: 10 });
    expect(result).toBe("success");
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("retries on retryable errors and succeeds when transient error resolves", async () => {
    let callCount = 0;
    const op = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount < 2) {
        throw new Error("Transient network failure");
      }
      return "recovered";
    });

    const result = await withExponentialBackoff(op, {
      maxAttempts: 3,
      initialDelayMs: 10,
      shouldRetry: (err) => (err as Error).message.includes("Transient"),
    });

    expect(result).toBe("recovered");
    expect(op).toHaveBeenCalledTimes(2);
  });

  it("identifies retryable HTTP status codes correctly", () => {
    expect(isRetryableHttpStatus(429)).toBe(true);
    expect(isRetryableHttpStatus(500)).toBe(true);
    expect(isRetryableHttpStatus(503)).toBe(true);
    expect(isRetryableHttpStatus(404)).toBe(false);
    expect(isRetryableHttpStatus(401)).toBe(false);
  });
});

describe("Job Locking Mechanism", () => {
  it("prevents overlapping sync execution and releases cleanly", async () => {
    const resource = `test-${Date.now()}`;
    const token1 = await acquireLock(resource, 60);
    expect(token1).not.toBeNull();

    // Second acquire should be rejected while lock is held
    const token2 = await acquireLock(resource, 60);
    expect(token2).toBeNull();

    // Release first lock
    const released = await releaseLock(token1!, resource);
    expect(released).toBe(true);

    // Now third acquire should succeed
    const token3 = await acquireLock(resource, 60);
    expect(token3).not.toBeNull();
    await releaseLock(token3!, resource);
  });
});

describe("Hack Club Adapter", () => {
  const adapter = new HackClubAdapter();

  it("has correct metadata and is always configured", () => {
    expect(adapter.sourceId).toBe("hackclub");
    expect(adapter.isConfigured()).toBe(true);
    expect(adapter.defaultSyncIntervalHours).toBe(8);
  });

  it("normalizes raw Hack Club API data into Phase 3 schema format", async () => {
    const mockApiResponse = [
      {
        id: "rec123",
        name: "Hack Bengaluru 2026",
        website: "https://hackbengaluru.in",
        start: "2026-11-01T09:00:00.000Z",
        end: "2026-11-02T18:00:00.000Z",
        city: "Bengaluru",
        state: "KA",
        country: "India",
        countryCode: "IN",
        virtual: false,
        hybrid: false,
        mlhAssociated: true,
        apac: true,
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockApiResponse,
    } as unknown as Response);

    const result = await adapter.fetchEvents();

    expect(result.discovered).toBe(1);
    expect(result.events).toHaveLength(1);

    const event = result.events[0];
    expect(event.sourceId).toBe("hackclub");
    expect(event.sourceEventId).toBe("rec123");
    expect(event.name).toBe("Hack Bengaluru 2026");
    expect(event.isNational).toBe(true);
    expect(event.countryCode).toBe("IN");
    expect(event.participationMode).toBe(ParticipationMode.OFFLINE);
    expect(event.tags).toContain("India");
    expect(event.tags).toContain("MLH");
  });

  it("handles malformed records gracefully without aborting the entire fetch", async () => {
    const mockApiResponse = [
      { id: "valid_1", name: "Valid Hackathon", start: "2026-11-01T00:00:00Z" },
      { notAnId: 999 }, // malformed, missing name and id
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockApiResponse,
    } as unknown as Response);

    const result = await adapter.fetchEvents();
    expect(result.discovered).toBe(2);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].name).toBe("Valid Hackathon");
    expect(result.warnings?.length).toBeGreaterThan(0);
  });
});

describe("Kaggle Adapter", () => {
  const adapter = new KaggleAdapter();

  beforeEach(() => {
    delete process.env.KAGGLE_USERNAME;
    delete process.env.KAGGLE_KEY;
  });

  it("reports unconfigured when credentials are absent and skips cleanly", async () => {
    expect(adapter.isConfigured()).toBe(false);
    const result = await adapter.fetchEvents();
    expect(result.discovered).toBe(0);
    expect(result.events).toHaveLength(0);
    expect(result.warnings?.[0]).toContain("Kaggle credentials not configured");
  });
});
