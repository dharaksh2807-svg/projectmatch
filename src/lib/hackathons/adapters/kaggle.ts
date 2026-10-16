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
  parsePrizePool,
} from "../utils/normalize";
import { VerificationStatus, ParticipationMode } from "@prisma/client";

const KAGGLE_API_URL = "https://www.kaggle.com/api/v1/competitions/list";

const KaggleCompetitionSchema = z.object({
  id: z.union([z.string(), z.number()]),
  ref: z.string().optional().nullable(),
  title: z.string().min(1),
  url: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  deadline: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  reward: z.string().optional().nullable(),
  teamCount: z.number().optional().nullable(),
  organizationName: z.string().optional().nullable(),
  isKernelsOnly: z.boolean().optional().nullable(),
});

type KaggleCompetition = z.infer<typeof KaggleCompetitionSchema>;

export class KaggleAdapter extends BaseHackathonAdapter {
  readonly sourceId = "kaggle";
  readonly sourceName = "Kaggle Competitions";
  readonly defaultSyncIntervalHours = 12;

  isConfigured(): boolean {
    return Boolean(process.env.KAGGLE_USERNAME && process.env.KAGGLE_KEY);
  }

  async fetchEvents(options?: SyncOptions): Promise<AdapterFetchResult> {
    if (!this.isConfigured()) {
      this.warn(
        "Kaggle API credentials (KAGGLE_USERNAME, KAGGLE_KEY) are not set. Skipping Kaggle sync."
      );
      return {
        sourceId: this.sourceId,
        discovered: 0,
        events: [],
        warnings: [
          "Kaggle credentials not configured in environment variables (KAGGLE_USERNAME / KAGGLE_KEY).",
        ],
      };
    }

    const username = process.env.KAGGLE_USERNAME!;
    const key = process.env.KAGGLE_KEY!;
    const authHeader = `Basic ${Buffer.from(`${username}:${key}`).toString("base64")}`;

    const queryParams = new URLSearchParams({
      group: "general",
      category: "all",
      sortBy: "earliestDeadline",
      page: "1",
    });

    const url = `${KAGGLE_API_URL}?${queryParams.toString()}`;
    const timeoutMs = options?.timeoutMs ?? 15000;

    this.log(`Fetching active competitions from ${url}...`);

    let rawData: unknown;
    try {
      rawData = await withExponentialBackoff(
        async (attempt) => {
          this.log(`Attempt ${attempt} connecting to Kaggle Competitions API...`);
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);

          try {
            const res = await fetch(url, {
              headers: {
                Accept: "application/json",
                Authorization: authHeader,
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
          initialDelayMs: 1500,
          shouldRetry: (err) => {
            const msg = err instanceof Error ? err.message : String(err);
            return msg.includes("Transient") || msg.includes("abort") || msg.includes("network");
          },
        }
      );
    } catch (fetchError: unknown) {
      const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
      this.error(`Failed to fetch from Kaggle API: ${errorMsg}`);
      return {
        sourceId: this.sourceId,
        discovered: 0,
        events: [],
        errors: [errorMsg],
      };
    }

    if (!Array.isArray(rawData)) {
      const err = "Invalid response format: expected an array of competitions";
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
      const parseResult = KaggleCompetitionSchema.safeParse(item);
      if (!parseResult.success) {
        warnings.push(`Skipped malformed record: ${parseResult.error.message}`);
        continue;
      }

      const raw: KaggleCompetition = parseResult.data;

      const deadline = normalizeDate(raw.deadline);
      // Kaggle competitions generally run over several months up to the deadline
      const startDate = now; // active now
      const endDate = deadline;

      const websiteUrl = raw.url
        ? normalizeUrl(raw.url)
        : raw.ref
        ? `https://www.kaggle.com/competitions/${raw.ref}`
        : null;

      const { amount: prizeAmount, currency: prizeCurrency } = parsePrizePool(raw.reward);

      const status = computeEventStatus(startDate, endDate, now);
      const registrationStatus = computeRegistrationStatus(deadline, null, startDate, now);

      const tags: string[] = ["Machine Learning", "AI & Data Science", "Competition"];
      if (raw.category) tags.push(raw.category);

      normalizedEvents.push({
        sourceId: this.sourceId,
        sourceEventId: String(raw.id),
        canonicalUrl: websiteUrl,
        name: raw.title.trim(),
        description: raw.description?.trim() ?? "Kaggle Machine Learning Challenge",
        organizerName: raw.organizationName?.trim() || "Kaggle",
        organizerCredibility: "Verified Kaggle Hosted Competition",
        websiteUrl,
        registrationUrl: websiteUrl,
        bannerUrl: null,
        startDate,
        endDate,
        registrationStartDate: null,
        registrationDeadline: deadline,
        timezone: "UTC",
        location: "Global Virtual",
        participationMode: ParticipationMode.ONLINE,
        city: null,
        state: null,
        country: "Global Virtual",
        countryCode: null,
        minTeamSize: 1,
        maxTeamSize: 5,
        tags,
        themes: ["Artificial Intelligence", "Predictive Modeling"],
        prizeAmount,
        prizeCurrency,
        registrationFee: 0,
        isNational: false,
        nationalEvidence: null,
        importanceScore: prizeAmount && prizeAmount >= 50000 ? 0.9 : 0.75,
        status,
        registrationStatus,
        verificationStatus: VerificationStatus.VERIFIED,
      });
    }

    this.log(`Successfully normalized ${normalizedEvents.length} competitions from Kaggle`);

    return {
      sourceId: this.sourceId,
      discovered,
      events: normalizedEvents,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }
}
