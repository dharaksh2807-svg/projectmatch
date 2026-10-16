import {
  HackathonStatus,
  RegistrationStatus,
  VerificationStatus,
  ParticipationMode,
  SyncStatus,
} from "@prisma/client";

/**
 * Clean, normalized event representation ready for idempotent database upsert.
 * Guaranteed to conform to the Phase 3 schema.
 */
export interface NormalizedHackathonInput {
  // Source identity & deduplication
  sourceId: string;
  sourceEventId: string;
  canonicalUrl?: string | null;

  // Event details
  name: string;
  description?: string | null;

  // Organizer
  organizerName?: string | null;
  organizerCredibility?: string | null;

  // URLs
  websiteUrl?: string | null;
  devpostUrl?: string | null;
  registrationUrl?: string | null;
  bannerUrl?: string | null;

  // Dates & Timezone
  startDate?: Date | null;
  endDate?: Date | null;
  registrationStartDate?: Date | null;
  registrationDeadline?: Date | null;
  timezone?: string | null;

  // Geography & Participation
  location?: string | null;
  participationMode?: ParticipationMode | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  countryCode?: string | null;

  // Eligibility & Team
  eligibilityRequirements?: string | null;
  minTeamSize?: number | null;
  maxTeamSize?: number | null;

  // Classification & Tags
  tags: string[];
  themes: string[];

  // Prizes & Fees
  prizeAmount?: number | null;
  prizeCurrency?: string | null;
  registrationFee?: number | null;

  // National Recognition
  isNational: boolean;
  nationalEvidence?: string | null;

  // Ranking & Lifecycle
  importanceScore?: number;
  status: HackathonStatus;
  registrationStatus: RegistrationStatus;
  verificationStatus: VerificationStatus;
}

/**
 * Result returned by an individual source adapter's fetch method.
 */
export interface AdapterFetchResult {
  sourceId: string;
  discovered: number;
  events: NormalizedHackathonInput[];
  warnings?: string[];
  errors?: string[];
}

/**
 * Options passed to an adapter during synchronization.
 */
export interface SyncOptions {
  fullSync?: boolean;
  triggeredBy?: string;
  timeoutMs?: number;
}

/**
 * Standard interface that every source adapter must implement.
 */
export interface HackathonSourceAdapter {
  readonly sourceId: string;
  readonly sourceName: string;
  readonly defaultSyncIntervalHours: number;

  /**
   * Whether the adapter currently has valid credentials and is ready to execute.
   */
  isConfigured(): boolean;

  /**
   * Fetches, validates, and normalizes events from the external source.
   */
  fetchEvents(options?: SyncOptions): Promise<AdapterFetchResult>;
}

/**
 * Outcome of a single adapter run inside the ingestion engine.
 */
export interface SourceSyncOutcome {
  sourceId: string;
  status: SyncStatus;
  recordsDiscovered: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsSkipped: number;
  durationMs: number;
  errorMessage?: string | null;
  startedAt: Date;
  completedAt: Date;
}

/**
 * Full engine synchronization summary.
 */
export interface EngineSyncSummary {
  success: boolean;
  lockAcquired: boolean;
  durationMs: number;
  sourcesRun: number;
  totalDiscovered: number;
  totalInserted: number;
  totalUpdated: number;
  totalSkipped: number;
  outcomes: SourceSyncOutcome[];
}
