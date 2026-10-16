import { HackathonStatus, VerificationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  computeEffectiveEventStatus,
  computeEffectiveRegistrationStatus,
  detectContradiction,
  isStaleRecord,
} from "./utils/status";

export interface StatusMaintenanceResult {
  processed: number;
  updated: number;
  flaggedStale: number;
  flaggedContradiction: number;
  errors: number;
  durationMs: number;
  ranAt: Date;
}

/**
 * PHASE 5 — Status Maintenance Job
 *
 * Scans all non-cancelled, non-rejected hackathons in the database and:
 * 1. Recalculates event lifecycle and registration status from timestamps.
 * 2. Persists the updated statuses to the database.
 * 3. Flags records with stale sync data or contradictory date configurations.
 *
 * This job runs separately from the source ingestion sync. It can be invoked:
 * - Via the Vercel Cron scheduled task alongside the ingestion engine.
 * - On-demand via the sync maintenance API endpoint.
 *
 * This ensures that even if a sync is delayed, expired events are removed from
 * the default feed the next time this job runs — not just when source data arrives.
 *
 * Important: This job does NOT fetch from external sources. It only re-derives
 * status from what is already stored. The ingestion engine (Phase 4) handles
 * source fetches.
 */
export async function runStatusMaintenance(): Promise<StatusMaintenanceResult> {
  const startedAt = new Date();
  let processed = 0;
  let updated = 0;
  let flaggedStale = 0;
  let flaggedContradiction = 0;
  let errors = 0;

  // Fetch all candidates: everything except CANCELLED (admin-set) and REJECTED
  // We also skip admin-only VERIFIED that might be deliberately held at a status.
  const candidates = await prisma.hackathon.findMany({
    where: {
      status: {
        not: HackathonStatus.CANCELLED,
      },
      verificationStatus: {
        not: VerificationStatus.REJECTED,
      },
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      registrationDeadline: true,
      registrationStartDate: true,
      timezone: true,
      status: true,
      registrationStatus: true,
      verificationStatus: true,
      lastSyncAt: true,
      lastVerifiedAt: true,
      sourceId: true,
    },
  });

  processed = candidates.length;

  for (const hackathon of candidates) {
    try {
      const now = new Date();

      const computedStatus = computeEffectiveEventStatus(hackathon, now);
      const computedRegStatus = computeEffectiveRegistrationStatus(hackathon, now);
      const stale = isStaleRecord(hackathon, now);
      const { hasContradiction, reason: contradictionReason } = detectContradiction(hackathon);

      // Determine what verification status should be written
      let newVerificationStatus = hackathon.verificationStatus;
      if (hasContradiction && hackathon.verificationStatus === VerificationStatus.UNVERIFIED) {
        newVerificationStatus = VerificationStatus.FLAGGED;
        flaggedContradiction++;
        console.warn(
          `[status-maintenance] Flagging hackathon ${hackathon.id} for contradiction: ${contradictionReason}`
        );
      } else if (stale && hackathon.verificationStatus === VerificationStatus.UNVERIFIED) {
        // Stale records get flagged but only if they are UPCOMING/ONGOING
        // (we don't need to flag stale ENDED records — they are historical)
        if (
          computedStatus === HackathonStatus.UPCOMING ||
          computedStatus === HackathonStatus.ONGOING
        ) {
          newVerificationStatus = VerificationStatus.FLAGGED;
          flaggedStale++;
          console.warn(
            `[status-maintenance] Flagging hackathon ${hackathon.id} for stale sync data (lastSyncAt: ${hackathon.lastSyncAt})`
          );
        }
      }

      // Determine if we need to write anything
      const statusChanged = computedStatus !== hackathon.status;
      const regStatusChanged = computedRegStatus !== hackathon.registrationStatus;
      const verificationChanged = newVerificationStatus !== hackathon.verificationStatus;

      if (statusChanged || regStatusChanged || verificationChanged) {
        await prisma.hackathon.update({
          where: { id: hackathon.id },
          data: {
            status: computedStatus,
            registrationStatus: computedRegStatus,
            verificationStatus: newVerificationStatus,
            updatedAt: now,
          },
        });
        updated++;

        if (statusChanged) {
          console.log(
            `[status-maintenance] ${hackathon.id}: status ${hackathon.status} → ${computedStatus}`
          );
        }
        if (regStatusChanged) {
          console.log(
            `[status-maintenance] ${hackathon.id}: registrationStatus ${hackathon.registrationStatus} → ${computedRegStatus}`
          );
        }
      }
    } catch (err) {
      errors++;
      console.error(`[status-maintenance] Error processing hackathon ${hackathon.id}:`, err);
    }
  }

  const durationMs = Date.now() - startedAt.getTime();

  const result: StatusMaintenanceResult = {
    processed,
    updated,
    flaggedStale,
    flaggedContradiction,
    errors,
    durationMs,
    ranAt: startedAt,
  };

  console.log("[status-maintenance] Completed:", JSON.stringify(result));
  return result;
}
