import { redis } from "@/lib/redis";

const LOCK_KEY_PREFIX = "lock:hackathon-sync";
const DEFAULT_LOCK_TTL_SECONDS = 300; // 5 minutes max run duration before auto-release

// In-memory fallback lock for environments without active Redis
const memoryLocks = new Map<string, { token: string; expiresAt: number }>();

/**
 * Attempts to acquire an exclusive lock for the ingestion engine.
 * Returns a lock token if acquired, or null if another process holds the lock.
 */
export async function acquireLock(
  resource: string = "global",
  ttlSeconds: number = DEFAULT_LOCK_TTL_SECONDS
): Promise<string | null> {
  const lockKey = `${LOCK_KEY_PREFIX}:${resource}`;
  const token = `token-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  if (redis) {
    try {
      // SET key token NX EX ttl
      const acquired = await redis.set(lockKey, token, {
        nx: true,
        ex: ttlSeconds,
      });
      return acquired ? token : null;
    } catch (err) {
      console.warn("Redis acquireLock error, falling back to memory lock:", err);
    }
  }

  // Memory fallback
  const now = Date.now();
  const existing = memoryLocks.get(lockKey);
  if (existing && existing.expiresAt > now) {
    return null; // Lock is still held
  }

  memoryLocks.set(lockKey, {
    token,
    expiresAt: now + ttlSeconds * 1000,
  });

  return token;
}

/**
 * Safely releases an acquired lock.
 * Ensures that only the process holding the matching token can release it.
 */
export async function releaseLock(
  token: string,
  resource: string = "global"
): Promise<boolean> {
  const lockKey = `${LOCK_KEY_PREFIX}:${resource}`;

  if (redis) {
    try {
      // Lua script or get-check-del to ensure safety
      const currentToken = await redis.get<string>(lockKey);
      if (currentToken === token) {
        await redis.del(lockKey);
        return true;
      }
      return false;
    } catch (err) {
      console.warn("Redis releaseLock error:", err);
    }
  }

  // Memory fallback
  const existing = memoryLocks.get(lockKey);
  if (existing && existing.token === token) {
    memoryLocks.delete(lockKey);
    return true;
  }

  return false;
}
