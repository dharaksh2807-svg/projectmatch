/**
 * Compressed metadata shape for AI context injection.
 * Every field is optional — only what the platform exposes publicly.
 * Keys are abbreviated to minimize token cost when serialized.
 */
export interface CompressedMetadata {
  /** Current rating (Codeforces, LeetCode contest) */
  rating?: number;
  /** Max rating ever achieved */
  maxRating?: number;
  /** Total problems solved */
  solved?: number;
  /** Top 3 programming languages by usage */
  langs?: string[];
  /** Global/country rank */
  rank?: string;
  /** Competition medals or badges count */
  medals?: number;
  /** Kaggle performance tier e.g. "Grandmaster" */
  tier?: string;
  /** Number of public notebooks or repositories */
  notebooks?: number;
  /** Number of public datasets */
  datasets?: number;
  /** ISO timestamp of last sync */
  syncedAt: string;
}

export class IntegrationError extends Error {
  constructor(
    public platform: string,
    message: string,
    public retryable: boolean = false
  ) {
    super(`[${platform}] ${message}`);
    this.name = "IntegrationError";
  }
}
