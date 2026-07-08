// Shared utilities for the recommendation engine.
// Used by both the Shorts feed and (optionally) future refactors of the Posts feed.
// The existing Posts feed route (app/api/feed/route.ts) is NOT modified.

import { prisma } from "@/lib/prisma";

// ── Opaque cursor ─────────────────────────────────────────────────────────────

const MAX_OFFSET = 500;
const CURSOR_TTL_S = 7200; // 2 hours

export function encodeCursor(offset: number): string {
  const payload = JSON.stringify({ o: offset, t: Math.floor(Date.now() / 1000) });
  return Buffer.from(payload).toString("base64url");
}

export function decodeCursor(raw: string | null | undefined): number {
  if (!raw || raw === "0") return 0;
  const asInt = parseInt(raw, 10);
  if (!isNaN(asInt) && String(asInt) === raw) {
    return Math.max(0, Math.min(asInt, MAX_OFFSET));
  }
  try {
    const decoded = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    const age = Math.floor(Date.now() / 1000) - (decoded.t ?? 0);
    if (age > CURSOR_TTL_S) return 0;
    return Math.max(0, Math.min(decoded.o ?? 0, MAX_OFFSET));
  } catch {
    return 0;
  }
}

// ── Shared DB helpers ─────────────────────────────────────────────────────────

export async function getBlockedIds(userId: number): Promise<Set<number>> {
  try {
    const rows = await prisma.$queryRaw<{ uid: number }[]>`
      SELECT "blockedId" AS uid FROM "BlockedUser" WHERE "blockerId" = ${userId}
      UNION
      SELECT "blockerId" AS uid FROM "BlockedUser" WHERE "blockedId"  = ${userId}
    `;
    return new Set(rows.map(r => Number(r.uid)));
  } catch { return new Set(); }
}

export async function getMutedIds(userId: number): Promise<Set<number>> {
  try {
    const rows = await prisma.$queryRaw<{ mutedId: number }[]>`
      SELECT "mutedId" FROM "UserMute" WHERE "userId" = ${userId}
    `;
    return new Set(rows.map(r => Number(r.mutedId)));
  } catch { return new Set(); }
}

export async function getUserCountryCode(userId: number): Promise<string | null> {
  try {
    const rows = await prisma.$queryRaw<{ countryCode: string | null }[]>`
      SELECT "countryCode" FROM "User" WHERE id = ${userId} LIMIT 1
    `;
    return rows[0]?.countryCode ?? null;
  } catch { return null; }
}

export async function getUserFollowingIds(userId: number): Promise<number[]> {
  try {
    const rows = await prisma.$queryRaw<{ followingId: number }[]>`
      SELECT "followingId" FROM "UserFollow" WHERE "followerId" = ${userId}
    `;
    return rows.map(r => Number(r.followingId));
  } catch { return []; }
}

export async function getUserInterestTags(userId: number): Promise<string[]> {
  try {
    const rows = await prisma.$queryRaw<{ name: string }[]>`
      SELECT name FROM "UserInterest" WHERE "userId" = ${userId}
    `;
    return rows.map(r => r.name);
  } catch { return []; }
}