/**
 * Abuse detection — per-user and per-IP counters with soft and hard blocking.
 *
 * Counters are stored in Redis when available; falls back to in-memory.
 *
 * Thresholds:
 *   Follow spam:     > 200 follows/hour         → soft block (warn) at 150, hard block at 200
 *   Unfollow churn:  > 100 unfollows/hour        → hard block
 *   Comment flood:   > 60 comments/15 min        → hard block
 *   Upload burst:    > 50 uploads/hour           → hard block
 *   Login attempts:  > 10/15 min per IP/email    → hard block (separate from auth rate limit)
 *   Invite spam:     > 20 invites/hour           → hard block
 *   Post burst:      > 30 posts/hour             → hard block
 */

import { getRedis } from "./redis";

// ─── In-memory fallback ───────────────────────────────────────────────────────

const counters = new Map<string, { count: number; expiresAt: number }>();

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of counters.entries()) if (v.expiresAt < now) counters.delete(k);
  }, 60_000);
}

function inMemoryIncr(key: string, ttlMs: number): number {
  const now = Date.now();
  const entry = counters.get(key);
  if (!entry || entry.expiresAt < now) {
    counters.set(key, { count: 1, expiresAt: now + ttlMs });
    return 1;
  }
  entry.count += 1;
  return entry.count;
}

async function redisIncr(key: string, ttlMs: number): Promise<number> {
  const redis = getRedis();
  if (!redis) return inMemoryIncr(key, ttlMs);
  try {
    const pipeline = redis.pipeline();
    pipeline.incr(`abuse:${key}`);
    pipeline.pexpire(`abuse:${key}`, ttlMs);
    const res = await pipeline.exec();
    return (res?.[0]?.[1] as number) ?? 1;
  } catch {
    return inMemoryIncr(key, ttlMs);
  }
}

async function getCount(key: string): Promise<number> {
  const redis = getRedis();
  if (!redis) {
    const e = counters.get(key);
    return e && e.expiresAt > Date.now() ? e.count : 0;
  }
  try {
    const v = await redis.get(`abuse:${key}`);
    return v ? parseInt(v) : 0;
  } catch {
    return 0;
  }
}

async function setBlock(key: string, ttlMs: number): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    counters.set(`block:${key}`, { count: 1, expiresAt: Date.now() + ttlMs });
    return;
  }
  try {
    await redis.set(`abuse:block:${key}`, "1", "PX", ttlMs);
  } catch {
    counters.set(`block:${key}`, { count: 1, expiresAt: Date.now() + ttlMs });
  }
}

async function isBlocked(key: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) {
    const e = counters.get(`block:${key}`);
    return !!(e && e.expiresAt > Date.now());
  }
  try {
    return (await redis.exists(`abuse:block:${key}`)) === 1;
  } catch {
    return false;
  }
}

// ─── Abuse check results ──────────────────────────────────────────────────────

export interface AbuseCheckResult {
  blocked: boolean;
  soft: boolean;
  reason?: string;
  retryAfterMs?: number;
}

function ok(): AbuseCheckResult { return { blocked: false, soft: false }; }
function hard(reason: string, retryAfterMs = 60_000): AbuseCheckResult {
  return { blocked: true, soft: false, reason, retryAfterMs };
}
function soft(reason: string): AbuseCheckResult {
  return { blocked: false, soft: true, reason };
}

// ─── Specific checks ──────────────────────────────────────────────────────────

export async function checkFollowAbuse(userId: number): Promise<AbuseCheckResult> {
  if (await isBlocked(`follow:${userId}`)) return hard("Follow rate exceeded. Try again later.");
  const count = await redisIncr(`follow:${userId}`, 60 * 60_000); // 1-hour window
  if (count > 200) {
    await setBlock(`follow:${userId}`, 30 * 60_000); // block 30 min
    return hard("Too many follows in a short period.", 30 * 60_000);
  }
  if (count > 150) return soft("High follow activity detected.");
  return ok();
}

export async function checkUnfollowAbuse(userId: number): Promise<AbuseCheckResult> {
  if (await isBlocked(`unfollow:${userId}`)) return hard("Unfollow rate exceeded.");
  const count = await redisIncr(`unfollow:${userId}`, 60 * 60_000);
  if (count > 100) {
    await setBlock(`unfollow:${userId}`, 30 * 60_000);
    return hard("Rapid follow/unfollow detected. Account temporarily restricted.", 30 * 60_000);
  }
  return ok();
}

export async function checkCommentAbuse(userId: number): Promise<AbuseCheckResult> {
  if (await isBlocked(`comment:${userId}`)) return hard("Comment rate exceeded.");
  const count = await redisIncr(`comment:${userId}`, 15 * 60_000); // 15-min window
  if (count > 60) {
    await setBlock(`comment:${userId}`, 15 * 60_000);
    return hard("Comment flooding detected.", 15 * 60_000);
  }
  return ok();
}

export async function checkUploadAbuse(userId: number): Promise<AbuseCheckResult> {
  if (await isBlocked(`upload:${userId}`)) return hard("Upload rate exceeded.");
  const count = await redisIncr(`upload:${userId}`, 60 * 60_000);
  if (count > 50) {
    await setBlock(`upload:${userId}`, 30 * 60_000);
    return hard("Bulk upload detected. Try again later.", 30 * 60_000);
  }
  return ok();
}

export async function checkLoginAbuse(ip: string, email: string): Promise<AbuseCheckResult> {
  const ipKey = `login:ip:${ip}`;
  const emailKey = `login:email:${email}`;
  if ((await isBlocked(ipKey)) || (await isBlocked(emailKey))) {
    return hard("Too many login attempts. Try again later.", 15 * 60_000);
  }
  const [ipCount, emailCount] = await Promise.all([
    redisIncr(ipKey, 15 * 60_000),
    redisIncr(emailKey, 15 * 60_000),
  ]);
  if (ipCount > 30 || emailCount > 10) {
    await Promise.all([setBlock(ipKey, 15 * 60_000), setBlock(emailKey, 15 * 60_000)]);
    return hard("Too many login attempts. Account temporarily locked.", 15 * 60_000);
  }
  return ok();
}

export async function checkInviteAbuse(userId: number): Promise<AbuseCheckResult> {
  if (await isBlocked(`invite:${userId}`)) return hard("Invite rate exceeded.");
  const count = await redisIncr(`invite:${userId}`, 60 * 60_000);
  if (count > 20) {
    await setBlock(`invite:${userId}`, 60 * 60_000);
    return hard("Too many invites sent. Try again in an hour.", 60 * 60_000);
  }
  return ok();
}

export async function checkPostAbuse(userId: number): Promise<AbuseCheckResult> {
  if (await isBlocked(`post:${userId}`)) return hard("Post rate exceeded.");
  const count = await redisIncr(`post:${userId}`, 60 * 60_000);
  if (count > 30) {
    await setBlock(`post:${userId}`, 30 * 60_000);
    return hard("Too many posts in a short period.", 30 * 60_000);
  }
  return ok();
}

export async function checkCircleUpgradeAbuse(userId: number): Promise<AbuseCheckResult> {
  const count = await getCount(`circle_upgrade:${userId}`);
  if (count >= 3) return hard("Maximum daily Circle upgrade submissions reached.", 24 * 60 * 60_000);
  await redisIncr(`circle_upgrade:${userId}`, 24 * 60 * 60_000);
  return ok();
}

export async function getAbuseCounters(userId: number): Promise<Record<string, number>> {
  const keys = ["follow", "unfollow", "comment", "upload", "post", "invite"];
  const counts = await Promise.all(keys.map(k => getCount(`${k}:${userId}`)));
  return Object.fromEntries(keys.map((k, i) => [k, counts[i]]));
}
