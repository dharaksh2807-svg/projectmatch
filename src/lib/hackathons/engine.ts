import { prisma } from "@/lib/prisma";
import { SyncStatus } from "@prisma/client";
import {
  HackathonSourceAdapter,
  NormalizedHackathonInput,
  SourceSyncOutcome,
  EngineSyncSummary,
  SyncOptions,
} from "./types";
import { getAllAdapters, getAdapter } from "./adapters";
import { acquireLock, releaseLock } from "./utils/lock";

export class HackathonIngestionEngine {
  /**
   * Run synchronization for all registered adapters.
   */
  async syncAll(options: SyncOptions = {}): Promise<EngineSyncSummary> {
    const startTime = Date.now();
    const triggeredBy = options.triggeredBy ?? "cron";

    console.log(`[IngestionEngine] Starting full synchronization triggered by: ${triggeredBy}`);

    // Overlap prevention
    const lockToken = await acquireLock("global-sync", 600); // 10 minute lock
    if (!lockToken) {
      console.warn("[IngestionEngine] Another synchronization job is already running. Aborting.");
      return {
        success: false,
        lockAcquired: false,
        durationMs: Date.now() - startTime,
        sourcesRun: 0,
        totalDiscovered: 0,
        totalInserted: 0,
        totalUpdated: 0,
        totalSkipped: 0,
        outcomes: [],
      };
    }

    const outcomes: SourceSyncOutcome[] = [];
    const adapters = getAllAdapters();

    try {
      for (const adapter of adapters) {
        const outcome = await this.syncAdapter(adapter, options);
        outcomes.push(outcome);
      }
    } finally {
      await releaseLock(lockToken, "global-sync");
    }

    const durationMs = Date.now() - startTime;
    const totalDiscovered = outcomes.reduce((acc, o) => acc + o.recordsDiscovered, 0);
    const totalInserted = outcomes.reduce((acc, o) => acc + o.recordsInserted, 0);
    const totalUpdated = outcomes.reduce((acc, o) => acc + o.recordsUpdated, 0);
    const totalSkipped = outcomes.reduce((acc, o) => acc + o.recordsSkipped, 0);
    const anyFailed = outcomes.some((o) => o.status === SyncStatus.FAILED);

    console.log(
      `[IngestionEngine] Sync complete in ${durationMs}ms: ${totalDiscovered} discovered, ${totalInserted} inserted, ${totalUpdated} updated, ${totalSkipped} skipped.`
    );

    return {
      success: !anyFailed,
      lockAcquired: true,
      durationMs,
      sourcesRun: outcomes.length,
      totalDiscovered,
      totalInserted,
      totalUpdated,
      totalSkipped,
      outcomes,
    };
  }

  /**
   * Run synchronization for a single source adapter by ID.
   */
  async syncSource(
    sourceId: string,
    options: SyncOptions = {}
  ): Promise<SourceSyncOutcome> {
    const adapter = getAdapter(sourceId);
    if (!adapter) {
      throw new Error(`Unknown hackathon source adapter: "${sourceId}"`);
    }

    const lockToken = await acquireLock(`source-${sourceId}`, 300);
    if (!lockToken) {
      throw new Error(`Synchronization for source "${sourceId}" is already running.`);
    }

    try {
      return await this.syncAdapter(adapter, options);
    } finally {
      await releaseLock(lockToken, `source-${sourceId}`);
    }
  }

  /**
   * Executes a single adapter with complete error isolation and idempotent upserts.
   */
  private async syncAdapter(
    adapter: HackathonSourceAdapter,
    options: SyncOptions
  ): Promise<SourceSyncOutcome> {
    const startedAt = new Date();
    const sourceId = adapter.sourceId;
    const triggeredBy = options.triggeredBy ?? "cron";

    console.log(`[IngestionEngine] Synchronizing source: ${adapter.sourceName} (${sourceId})...`);

    let discovered = 0;
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let errorMessage: string | null = null;
    let status: SyncStatus = SyncStatus.SUCCESS;

    try {
      // 1. Fetch & normalize
      const fetchResult = await adapter.fetchEvents(options);
      discovered = fetchResult.discovered;

      if (fetchResult.errors && fetchResult.errors.length > 0) {
        errorMessage = fetchResult.errors.join("; ");
        status = fetchResult.events.length > 0 ? SyncStatus.PARTIAL : SyncStatus.FAILED;
      }

      // 2. Idempotent upsert into database
      const now = new Date();

      for (const event of fetchResult.events) {
        try {
          const result = await this.upsertEvent(event, now);
          if (result === "inserted") {
            inserted++;
          } else if (result === "updated") {
            updated++;
          } else {
            skipped++;
          }
        } catch (upsertErr) {
          console.error(
            `[IngestionEngine] Failed to upsert event ${event.sourceEventId} from ${sourceId}:`,
            upsertErr
          );
          skipped++;
        }
      }
    } catch (adapterErr) {
      status = SyncStatus.FAILED;
      errorMessage = adapterErr instanceof Error ? adapterErr.message : String(adapterErr);
      console.error(`[IngestionEngine] Unhandled exception in adapter "${sourceId}":`, adapterErr);
    }

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    // 3. Record sync log
    try {
      await prisma.hackathonSyncLog.create({
        data: {
          sourceId,
          status,
          recordsDiscovered: discovered,
          recordsInserted: inserted,
          recordsUpdated: updated,
          recordsSkipped: skipped,
          durationMs,
          errorMessage,
          triggeredBy,
          startedAt,
          completedAt,
        },
      });
    } catch (logErr) {
      console.error(`[IngestionEngine] Failed to write HackathonSyncLog for "${sourceId}":`, logErr);
    }

    return {
      sourceId,
      status,
      recordsDiscovered: discovered,
      recordsInserted: inserted,
      recordsUpdated: updated,
      recordsSkipped: skipped,
      durationMs,
      errorMessage,
      startedAt,
      completedAt,
    };
  }

  /**
   * Idempotently upserts a single normalized hackathon into PostgreSQL.
   */
  private async upsertEvent(
    event: NormalizedHackathonInput,
    now: Date
  ): Promise<"inserted" | "updated" | "skipped"> {
    // Check if record already exists by (sourceId, sourceEventId)
    const existing = await prisma.hackathon.findUnique({
      where: {
        sourceId_sourceEventId: {
          sourceId: event.sourceId,
          sourceEventId: event.sourceEventId,
        },
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.hackathon.update({
        where: { id: existing.id },
        data: {
          name: event.name,
          description: event.description,
          organizerName: event.organizerName,
          organizerCredibility: event.organizerCredibility,
          websiteUrl: event.websiteUrl,
          devpostUrl: event.devpostUrl,
          registrationUrl: event.registrationUrl,
          bannerUrl: event.bannerUrl,
          startDate: event.startDate,
          endDate: event.endDate,
          registrationStartDate: event.registrationStartDate,
          registrationDeadline: event.registrationDeadline,
          timezone: event.timezone,
          location: event.location,
          participationMode: event.participationMode,
          city: event.city,
          state: event.state,
          country: event.country,
          countryCode: event.countryCode,
          eligibilityRequirements: event.eligibilityRequirements,
          minTeamSize: event.minTeamSize,
          maxTeamSize: event.maxTeamSize,
          tags: event.tags,
          themes: event.themes,
          prizeAmount: event.prizeAmount,
          prizeCurrency: event.prizeCurrency,
          registrationFee: event.registrationFee,
          isNational: event.isNational,
          nationalEvidence: event.nationalEvidence,
          importanceScore: event.importanceScore ?? 0.0,
          status: event.status,
          registrationStatus: event.registrationStatus,
          verificationStatus: event.verificationStatus,
          lastSyncAt: now,
          lastVerifiedAt: now,
        },
      });
      return "updated";
    }

    // Insert new record
    await prisma.hackathon.create({
      data: {
        sourceId: event.sourceId,
        sourceEventId: event.sourceEventId,
        canonicalUrl: event.canonicalUrl,
        name: event.name,
        description: event.description,
        organizerName: event.organizerName,
        organizerCredibility: event.organizerCredibility,
        websiteUrl: event.websiteUrl,
        devpostUrl: event.devpostUrl,
        registrationUrl: event.registrationUrl,
        bannerUrl: event.bannerUrl,
        startDate: event.startDate,
        endDate: event.endDate,
        registrationStartDate: event.registrationStartDate,
        registrationDeadline: event.registrationDeadline,
        timezone: event.timezone,
        location: event.location,
        participationMode: event.participationMode,
        city: event.city,
        state: event.state,
        country: event.country,
        countryCode: event.countryCode,
        eligibilityRequirements: event.eligibilityRequirements,
        minTeamSize: event.minTeamSize,
        maxTeamSize: event.maxTeamSize,
        tags: event.tags,
        themes: event.themes,
        prizeAmount: event.prizeAmount,
        prizeCurrency: event.prizeCurrency,
        registrationFee: event.registrationFee,
        isNational: event.isNational,
        nationalEvidence: event.nationalEvidence,
        importanceScore: event.importanceScore ?? 0.0,
        status: event.status,
        registrationStatus: event.registrationStatus,
        verificationStatus: event.verificationStatus,
        firstDiscoveredAt: now,
        lastSyncAt: now,
        lastVerifiedAt: now,
      },
    });

    return "inserted";
  }
}

// Singleton engine instance
export const hackathonIngestionEngine = new HackathonIngestionEngine();
