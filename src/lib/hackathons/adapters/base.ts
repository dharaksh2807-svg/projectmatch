import {
  HackathonSourceAdapter,
  AdapterFetchResult,
  SyncOptions,
} from "../types";

/**
 * Base abstract adapter providing shared logging and structure.
 */
export abstract class BaseHackathonAdapter implements HackathonSourceAdapter {
  abstract readonly sourceId: string;
  abstract readonly sourceName: string;
  abstract readonly defaultSyncIntervalHours: number;

  abstract isConfigured(): boolean;

  abstract fetchEvents(options?: SyncOptions): Promise<AdapterFetchResult>;

  protected log(message: string, ...args: unknown[]) {
    console.log(`[Adapter:${this.sourceId}] ${message}`, ...args);
  }

  protected warn(message: string, ...args: unknown[]) {
    console.warn(`[Adapter:${this.sourceId}] ⚠️ ${message}`, ...args);
  }

  protected error(message: string, ...args: unknown[]) {
    console.error(`[Adapter:${this.sourceId}] ❌ ${message}`, ...args);
  }
}
