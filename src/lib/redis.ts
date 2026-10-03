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

// Rate limiter: 20 chat requests per minute per user
export const chatRatelimit = hasRedisConfig
  ? new Ratelimit({
      redis: redis as Redis,
      limiter: Ratelimit.slidingWindow(20, "1 m"),
      analytics: true,
      prefix: "promptwars:chat",
    })
  : null;

// Rate limiter: 10 agent mutations (PUT/DELETE) and 10 applications per minute per user
// Prevents automated abuse of write endpoints — stricter than chat since these hit the DB.
export const agentMutationRatelimit = hasRedisConfig
  ? new Ratelimit({
      redis: redis as Redis,
      limiter: Ratelimit.slidingWindow(10, "1 m"),
      analytics: true,
      prefix: "projectmatch:agent-mutation",
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

  try {
    const result = await applicationRatelimit.limit(identifier);
    return {
      success: result.success,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (err) {
    console.error("Redis RateLimit error (checkRateLimit):", err);
    return { success: true, remaining: 999 };
  }
}

/**
 * Check chat rate limit (20 req/min) for a given userId.
 * Returns { success: true } when Redis is not configured (dev fallback).
 */
export async function checkChatRateLimit(
  userId: string
): Promise<{ success: boolean; remaining?: number; reset?: number }> {
  if (!chatRatelimit) {
    return { success: true, remaining: 20 };
  }
  try {
    const result = await chatRatelimit.limit(userId);
    return {
      success: result.success,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (err) {
    console.error("Redis RateLimit error (checkChatRateLimit):", err);
    return { success: true, remaining: 999 };
  }
}

/**
 * Check agent mutation rate limit (10 req/min) for a given userId.
 * Used on PUT /api/agents/[id] and POST /api/applications to prevent
 * automated write abuse. Returns { success: true } in dev (no Redis config).
 */
export async function checkAgentMutationRateLimit(
  userId: string
): Promise<{ success: boolean; remaining?: number; reset?: number }> {
  if (!agentMutationRatelimit) {
    // Dev fallback: always allow when Upstash is not configured
    return { success: true, remaining: 10 };
  }
  try {
    const result = await agentMutationRatelimit.limit(userId);
    return {
      success: result.success,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (err) {
    console.error("Redis RateLimit error (checkAgentMutationRateLimit):", err);
    return { success: true, remaining: 999 };
  }
}

// ─────────────────────────────────────────────
// Direct Message Rate Limiting & Pub/Sub
// ─────────────────────────────────────────────

// Rate limiter: 30 direct messages per minute per user
export const dmRatelimit = hasRedisConfig
  ? new Ratelimit({
      redis: redis as Redis,
      limiter: Ratelimit.slidingWindow(30, "1 m"),
      analytics: true,
      prefix: "projectmatch:dm",
    })
  : null;

/**
 * Check DM rate limit (30 msg/min) for a given userId.
 * Returns { success: true } when Redis is not configured (dev fallback).
 */
export async function checkDmRateLimit(
  userId: string
): Promise<{ success: boolean; remaining?: number; reset?: number }> {
  if (!dmRatelimit) {
    return { success: true, remaining: 30 };
  }
  try {
    const result = await dmRatelimit.limit(userId);
    return {
      success: result.success,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (err) {
    console.error("Redis RateLimit error (checkDmRateLimit):", err);
    return { success: true, remaining: 999 };
  }
}

/**
 * Publish a real-time event to a Redis channel.
 * Writes to both a pub/sub channel and a polling key for Upstash REST compat.
 * The polling key is used by the SSE stream endpoint.
 * No-ops silently if Redis is unavailable.
 */
export async function publishEvent(
  channel: string,
  data: Record<string, unknown>
): Promise<void> {
  if (!redis) return;
  const payload = JSON.stringify(data);
  try {
    // Write to the polling key (SSE reads this)
    // TTL of 120s ensures stale data is cleaned up automatically
    await redis.set(`${channel}:latest`, payload, { ex: 120 });
    // Also publish for any native subscribers
    await redis.publish(channel, payload);
  } catch (err) {
    console.error(`Failed to publish to channel "${channel}":`, err);
  }
}

/**
 * Build the Redis channel name for a conversation's real-time stream.
 */
export function conversationChannel(conversationId: string): string {
  return `dm:conversation:${conversationId}`;
}

/**
 * Build the Redis channel name for a user's global notification stream.
 * Used by the SSE endpoint at /api/notifications/stream to push
 * real-time notification events (new messages, applications, etc.).
 */
export function userNotificationsChannel(userId: string): string {
  return `user:notifications:${userId}`;
}
