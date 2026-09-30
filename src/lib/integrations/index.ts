import { CompressedMetadata, IntegrationError } from "./types";
import { fetchLeetCode } from "./leetcode";
import { fetchCodeforces } from "./codeforces";
import { fetchKaggle } from "./kaggle";
import { Redis } from "@upstash/redis";

// ─────────────────────────────────────────────
// Platform registry
// ─────────────────────────────────────────────

type Fetcher = (handle: string) => Promise<CompressedMetadata>;

const FETCHERS: Record<string, Fetcher> = {
  leetcode: fetchLeetCode,
  codeforces: fetchCodeforces,
  kaggle: fetchKaggle,
};

// Stub for platforms with no public data API yet.
// Returns a minimal object so the AI context still knows the platform exists.
function stubFetcher(_platform: string): Fetcher {
  return async (handle: string): Promise<CompressedMetadata> => ({
    rank: handle, // just record the handle as a marker
    syncedAt: new Date().toISOString(),
  });
}

// Platforms that only store handles — no public stat API available
const STUB_PLATFORMS = [
  "stackoverflow",
  "medium",
  "hashnode",
  "devto",
  "hackerrank",
  "gitlab",
  "twitter",
] as const;

// Register stubs
for (const platform of STUB_PLATFORMS) {
  FETCHERS[platform] = stubFetcher(platform);
}

// ─────────────────────────────────────────────
// Factory function
// ─────────────────────────────────────────────

const CACHE_TTL_SEC = 15 * 60; // 15 minutes in seconds

// Initialize Redis from ENV variables (UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN)
// Fallback to null if env variables are not present (for local dev without Redis)
let redis: Redis | null = null;
try {
  redis = Redis.fromEnv();
} catch (e) {
  console.warn("Upstash Redis is not configured. Falling back to un-cached fetches.");
}

/**
 * Fetch and compress public profile data for a given platform + handle.
 * Includes a short-lived in-memory cache to prevent excessive third-party API hits.
 *
 * @param platform  Normalized platform key e.g. "leetcode", "codeforces"
 * @param handle    The user's public handle/username on that platform
 * @returns         A CompressedMetadata object (token-economical for AI injection)
 * @throws          IntegrationError on fetch failure or unknown platform
 *
 * @example
 * const meta = await syncPlatformData("codeforces", "tourist");
 * // { rating: 3979, maxRating: 3979, rank: "legendary grandmaster", langs: ["C++"], syncedAt: "..." }
 */
export async function syncPlatformData(
  platform: string,
  handle: string
): Promise<CompressedMetadata> {
  const normalizedPlatform = platform.toLowerCase().trim();
  const normalizedHandle = handle.trim();

  if (!normalizedHandle) {
    throw new IntegrationError(normalizedPlatform, "Handle cannot be empty");
  }

  const fetcher = FETCHERS[normalizedPlatform];
  if (!fetcher) {
    throw new IntegrationError(
      normalizedPlatform,
      `No integration registered for platform "${normalizedPlatform}"`
    );
  }

  const cacheKey = `integration:${normalizedPlatform}:${normalizedHandle}`;

  // Try fetching from Redis first
  if (redis) {
    try {
      const cached = await redis.get<CompressedMetadata>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (e) {
      console.error("Redis get error:", e);
    }
  }

  // Fallback to actual fetch
  const data = await fetcher(normalizedHandle);
  
  // Set in Redis
  if (redis) {
    try {
      await redis.set(cacheKey, data, { ex: CACHE_TTL_SEC });
    } catch (e) {
      console.error("Redis set error:", e);
    }
  }
  
  return data;
}

// ─────────────────────────────────────────────
// AI Context serializer
// ─────────────────────────────────────────────

/**
 * Converts a user's full connections map into a single compressed string
 * that can be prepended to an AI system prompt with minimal token cost.
 *
 * @example
 * buildContextString({
 *   leetcode: { solved: 450, langs: ["Python", "C++"], syncedAt: "..." },
 *   codeforces: { rating: 1850, rank: "expert", syncedAt: "..." },
 * })
 * // Returns: "UserCtx:LC[solved=450,langs=Python/C++];CF[rating=1850,rank=expert]"
 */
export function buildContextString(
  connections: Record<string, CompressedMetadata>
): string {
  const parts: string[] = [];

  for (const [platform, meta] of Object.entries(connections)) {
    const fields: string[] = [];

    if (meta.rating !== undefined) fields.push(`rating=${meta.rating}`);
    if (meta.maxRating !== undefined) fields.push(`maxRating=${meta.maxRating}`);
    if (meta.solved !== undefined) fields.push(`solved=${meta.solved}`);
    if (meta.rank !== undefined) fields.push(`rank=${meta.rank}`);
    if (meta.tier !== undefined) fields.push(`tier=${meta.tier}`);
    if (meta.medals !== undefined) fields.push(`medals=${meta.medals}`);
    if (meta.notebooks !== undefined) fields.push(`notebooks=${meta.notebooks}`);
    if (meta.langs && meta.langs.length > 0) {
      fields.push(`langs=${meta.langs.join("/")}`);
    }

    if (fields.length > 0) {
      const prefix = platform.slice(0, 2).toUpperCase(); // "leetcode" → "LE"
      parts.push(`${prefix}[${fields.join(",")}]`);
    }
  }

  if (parts.length === 0) return "";
  return `UserCtx:${parts.join(";")}`;
}

export type { CompressedMetadata };
export { IntegrationError };
