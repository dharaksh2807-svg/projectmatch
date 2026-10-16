import { z } from "zod";
import { BaseHackathonAdapter } from "./base";
import {
  AdapterFetchResult,
  NormalizedHackathonInput,
  SyncOptions,
} from "../types";
import { withExponentialBackoff, isRetryableHttpStatus } from "../utils/retry";
import {
  normalizeDate,
  normalizeUrl,
  computeEventStatus,
  computeRegistrationStatus,
  computeParticipationMode,
} from "../utils/normalize";
import { VerificationStatus } from "@prisma/client";

const HACKCLUB_UPCOMING_URL = "https://hackathons.hackclub.com/api/events/upcoming";
const HACKCLUB_ALL_URL = "https://hackathons.hackclub.com/api/events/all";

/**
 * Zod schema to validate raw items from Hack Club API.
 * Uses safe coercion / nullability so unexpected extra fields or slight deviations don't crash.
 */
const HackClubRawEventSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  website: z.string().optional().nullable(),
  start: z.string().optional().nullable(),
  end: z.string().optional().nullable(),
  banner: z.string().optional().nullable(),
  logo: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  countryCode: z.string().optional().nullable(),
  virtual: z.boolean().optional().nullable(),
  hybrid: z.boolean().optional().nullable(),
  mlhAssociated: z.boolean().optional().nullable(),
  apac: z.boolean().optional().nullable(),
});

type HackClubRawEvent = z.infer<typeof HackClubRawEventSchema>;

export class HackClubAdapter extends BaseHackathonAdapter {
  readonly sourceId = "hackclub";
  readonly sourceName = "Hack Club Hackathons";
  readonly defaultSyncIntervalHours = 8;

  isConfigured(): boolean {
    // Open public API — no API key required
    return true;
  }

  async fetchEvents(options?: SyncOptions): Promise<AdapterFetchResult> {
    const url = options?.fullSync ? HACKCLUB_ALL_URL : HACKCLUB_UPCOMING_URL;
    const timeoutMs = options?.timeoutMs ?? 15000;

    this.log(`Fetching events from ${url}...`);

    let rawData: unknown;
    try {
      rawData = await withExponentialBackoff(
        async (attempt) => {
          this.log(`Attempt ${attempt} connecting to Hack Club API...`);
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);

          try {
            const res = await fetch(url, {
              headers: {
                Accept: "application/json",
                "User-Agent": "ProjectMatch-Ingestion-Bot/1.0",
              },
              signal: controller.signal,
            });

            if (!res.ok) {
              if (isRetryableHttpStatus(res.status)) {
                throw new Error(`Transient HTTP ${res.status}: ${res.statusText}`);
              }
              throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }

            return await res.json();
          } finally {
            clearTimeout(timer);
          }
        },
        {
          maxAttempts: 3,
          initialDelayMs: 1000,
          shouldRetry: (err) => {
            const msg = err instanceof Error ? err.message : String(err);
            return msg.includes("Transient") || msg.includes("abort") || msg.includes("network");
          },
        }
      );
    } catch (fetchError: unknown) {
      const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
      this.error(`Failed to fetch from Hack Club API: ${errorMsg}`);
      return {
        sourceId: this.sourceId,
        discovered: 0,
        events: [],
        errors: [errorMsg],
      };
    }

    if (!Array.isArray(rawData)) {
      const err = "Invalid response format: expected an array of hackathons";
      this.error(err);
      return {
        sourceId: this.sourceId,
        discovered: 0,
        events: [],
        errors: [err],
      };
    }

    const discovered = rawData.length;
    const normalizedEvents: NormalizedHackathonInput[] = [];
    const warnings: string[] = [];

    const now = new Date();

    for (const item of rawData) {
      const parseResult = HackClubRawEventSchema.safeParse(item);
      if (!parseResult.success) {
        warnings.push(`Skipped malformed record: ${parseResult.error.message}`);
        continue;
      }

      const raw: HackClubRawEvent = parseResult.data;

      const startDate = normalizeDate(raw.start);
      const endDate = normalizeDate(raw.end);
      const websiteUrl = normalizeUrl(raw.website);
      const bannerUrl = normalizeUrl(raw.banner || raw.logo);

      const isVirtual = Boolean(raw.virtual);
      const isHybrid = Boolean(raw.hybrid);
      const participationMode = computeParticipationMode({
        isVirtual,
        isHybrid,
        location: raw.city ? `${raw.city}, ${raw.country}` : null,
      });

      const status = computeEventStatus(startDate, endDate, now);
      const registrationStatus = computeRegistrationStatus(null, null, startDate, now);

      const countryCode = raw.countryCode ? raw.countryCode.trim().toUpperCase() : null;
      const isIndia = countryCode === "IN";
      const isApac = Boolean(raw.apac);

      // Construct tags
      const tags: string[] = ["Hackathon", "Student"];
      if (raw.mlhAssociated) tags.push("MLH");
      if (isIndia) tags.push("India");
      if (isApac && !isIndia) tags.push("APAC");
      if (isVirtual) tags.push("Virtual");

      // Check national classification
      const isNational = isIndia;
      const nationalEvidence = isIndia
        ? "National student hackathon registered in India (Hack Club Directory)"
        : null;

      const locationParts = [raw.city, raw.state, raw.country].filter(Boolean);
      const location = locationParts.length > 0 ? locationParts.join(", ") : isVirtual ? "Virtual" : null;

      normalizedEvents.push({
        sourceId: this.sourceId,
        sourceEventId: raw.id,
        canonicalUrl: websiteUrl,
        name: raw.name.trim(),
        description: raw.mlhAssociated
          ? `Official Major League Hacking partner hackathon hosted in ${raw.city || "virtual environment"}. Open to student builders and engineers.`
          : `Student hackathon hosted in ${raw.city || "virtual environment"}. Listed on the Hack Club global hackathon directory.`,
        organizerName: raw.mlhAssociated ? "Major League Hacking / Hack Club" : "Hack Club Student Organizer",
        organizerCredibility: raw.mlhAssociated ? "Verified MLH Partner Event" : "Curated Hack Club Directory Event",
        websiteUrl,
        registrationUrl: websiteUrl,
        bannerUrl,
        startDate,
        endDate,
        timezone: null,
        location,
        participationMode,
        city: raw.city ?? null,
        state: raw.state ?? null,
        country: raw.country ?? null,
        countryCode,
        minTeamSize: 1,
        maxTeamSize: 4,
        tags,
        themes: ["Open Innovation", "Software Engineering"],
        prizeAmount: null,
        prizeCurrency: null,
        registrationFee: 0, // Hack Club events are free for students
        isNational,
        nationalEvidence,
        importanceScore: isIndia ? 0.8 : (raw.mlhAssociated ? 0.75 : 0.6),
        status,
        registrationStatus,
        verificationStatus: VerificationStatus.VERIFIED,
      });
    }

    this.log(`Successfully normalized ${normalizedEvents.length} events from Hack Club (${warnings.length} warnings)`);

    return {
      sourceId: this.sourceId,
      discovered,
      events: normalizedEvents,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }
}
