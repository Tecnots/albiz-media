import { getRedis } from "./redis";

const LOCAL_TTL = 10_000; // 10s in-process cache as fallback

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const localCache = new Map<string, CacheEntry<unknown>>();

// Prune expired entries every 60s to avoid unbounded growth
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, e] of localCache.entries()) {
      if (e.expiresAt < now) localCache.delete(k);
    }
  }, 60_000);
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  // Try Redis first
  try {
    const redis = getRedis();
    if (redis) {
      const raw = await redis.get(key);
      if (raw !== null) return JSON.parse(raw) as T;
      return null;
    }
  } catch {}

  // Fallback: local in-process cache
  const entry = localCache.get(key) as CacheEntry<T> | undefined;
  if (entry && entry.expiresAt > Date.now()) return entry.value;
  return null;
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  try {
    const redis = getRedis();
    if (redis) {
      await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
      return;
    }
  } catch {}

  // Fallback
  localCache.set(key, { value, expiresAt: Date.now() + Math.min(ttlSeconds * 1000, LOCAL_TTL) });
}

export async function cacheInvalidate(...keys: string[]): Promise<void> {
  try {
    const redis = getRedis();
    if (redis && keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {}
  keys.forEach(k => localCache.delete(k));
}

export async function cacheInvalidatePattern(pattern: string): Promise<void> {
  try {
    const redis = getRedis();
    if (redis) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) await redis.del(...keys);
    }
  } catch {}

  // Clear matching local entries
  for (const k of localCache.keys()) {
    if (matchGlob(k, pattern)) localCache.delete(k);
  }
}

function matchGlob(str: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`).test(str);
}

export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;
  const value = await fn();
  await cacheSet(key, value, ttlSeconds);
  return value;
}
