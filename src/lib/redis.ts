import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

// Gracefully handle missing env vars in local dev
const hasRedisConfig =
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_URL !== "your-upstash-url" &&
  process.env.UPSTASH_REDIS_REST_TOKEN &&
  process.env.UPSTASH_REDIS_REST_TOKEN !== "your-upstash-token";

// Real Redis client — only instantiated when credentials are present
export const redis = hasRedisConfig
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// Rate limiter: 5 applications/invites per 10 minutes per user/IP
export const applicationRatelimit = hasRedisConfig
  ? new Ratelimit({
      redis: redis as Redis,
      limiter: Ratelimit.slidingWindow(5, "10 m"),
      analytics: true,
      prefix: "projectmatch:apply",
    })
  : null;

/**
 * Check rate limit for a given identifier (userId or IP).
 * Returns { success: true } when Redis is not configured (dev fallback).
 */
export async function checkRateLimit(
  identifier: string
): Promise<{ success: boolean; remaining?: number; reset?: number }> {
  if (!applicationRatelimit) {
    // Dev fallback: always allow
    return { success: true, remaining: 999 };
  }

  const result = await applicationRatelimit.limit(identifier);
  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
  };
}
