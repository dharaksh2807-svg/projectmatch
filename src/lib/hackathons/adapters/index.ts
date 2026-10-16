import { HackathonSourceAdapter } from "../types";
import { HackClubAdapter } from "./hackclub";
import { KaggleAdapter } from "./kaggle";

// Singleton instances of registered adapters
const hackClubAdapter = new HackClubAdapter();
const kaggleAdapter = new KaggleAdapter();

/**
 * Registry of all available source adapters.
 */
export const ADAPTER_REGISTRY: Record<string, HackathonSourceAdapter> = {
  [hackClubAdapter.sourceId]: hackClubAdapter,
  [kaggleAdapter.sourceId]: kaggleAdapter,
};

/**
 * Get all registered adapters.
 */
export function getAllAdapters(): HackathonSourceAdapter[] {
  return Object.values(ADAPTER_REGISTRY);
}

/**
 * Look up a specific adapter by its source ID.
 */
export function getAdapter(sourceId: string): HackathonSourceAdapter | undefined {
  return ADAPTER_REGISTRY[sourceId];
}

export { HackClubAdapter, KaggleAdapter };
