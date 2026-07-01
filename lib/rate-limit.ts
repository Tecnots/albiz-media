/**
 * Distributed sliding-window rate limiter.
 *
 * When REDIS_URL is set, uses a Redis-backed sliding window so state is shared
 * across all server instances (multi-region, Kubernetes, Vercel Edge, etc.).
 *
 * When Redis is unavailable (no REDIS_URL, or connection error), falls back to
 * a per-process in-memory store — identical behavior to the original
 * implementation. Rate limits are then per-instance, not global.
 */

import { getRedis } from "./redis";

// ─── In-memory fallback ───────────────────────────────────────────────────────

type Entry = { count: number; windowStart: number };
const store = new Map<string, Entry>();

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now - entry.windowStart > 10 * 60_000) store.delete(key);
    }
  }, 5 * 60_000);
}

function inMemoryCheck(key: string, maxRequests: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || now - entry.windowStart >= windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }
  entry.count += 1;
  const remaining = Math.max(0, maxRequests - entry.count);
  return { allowed: entry.count <= maxRequests, remaining, resetAt: entry.windowStart + windowMs };
}

// ─── Redis sliding window ─────────────────────────────────────────────────────

async function redisCheck(key: string, maxRequests: number, windowMs: number): Promise<RateLimitResult> {
  const redis = getRedis();
  if (!redis) return inMemoryCheck(key, maxRequests, windowMs);

  const now = Date.now();
  const windowStart = now - windowMs;
  const redisKey = `rl:${key}`;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(redisKey, "-inf", windowStart);
  pipeline.zadd(redisKey, now, `${now}-${Math.random()}`);
  pipeline.zcard(redisKey);
  pipeline.pexpire(redisKey, windowMs + 1000);

  const results = await pipeline.exec();
  const count = (results?.[2]?.[1] as number) ?? 1;
  const remaining = Math.max(0, maxRequests - count);
  const resetAt = now + windowMs;

  return { allowed: count <= maxRequests, remaining, resetAt };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  try {
    return await redisCheck(key, maxRequests, windowMs);
  } catch {
    return inMemoryCheck(key, maxRequests, windowMs);
  }
}

export async function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult & { error?: { error: string; retryAfterMs: number } }> {
  const result = await checkRateLimit(key, maxRequests, windowMs);
  if (!result.allowed) {
    return {
      ...result,
      error: {
        error: "Too many requests. Please slow down.",
        retryAfterMs: Math.max(0, result.resetAt - Date.now()),
      },
    };
  }
  return result;
}
