import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";
import { blobStorageService } from "@/lib/blob-storage";

const INITIAL_COLORS = ["#F44444","#F97316","#EAB308","#22C55E","#3B82F6","#8B5CF6","#EC4899","#14B8A6"];

function parseFollowers(s: string): number {
  if (!s) return 0;
  const c = s.replace(/,/g, "").trim().toLowerCase();
  if (c.endsWith("m")) return Math.round(parseFloat(c) * 1_000_000);
  if (c.endsWith("k")) return Math.round(parseFloat(c) * 1_000);
  return parseInt(c) || 0;
}

function resolveAvatar(image: string | null): string | null {
  return blobStorageService.resolveMediaUrl(image);
}

function suggestedReason(
  mutual: number,
  affinity: number,
  hasInterestMatch: boolean,
  velocity: number
): string | undefined {
  if (affinity > 2)   return "Based on your activity";
  if (mutual >= 3)    return `${mutual} people you follow also follow them`;
  if (mutual === 2)   return "2 people you follow also follow them";
  if (mutual === 1)   return "Someone you follow also follows them";
  if (hasInterestMatch) return "Matches your interests";
  if (velocity > 5)  return "Active in Circle this week";
  return undefined;
}

export async function GET(req: NextRequest) {
  // Circle member directory is public — any visitor can browse who's in Circle.
  // A resolved user, when present, adds personalization (mutual follows,
  // affinity, and excluding already-followed members from Suggested).
  const authUser = await getAuthUser(req);

  const { searchParams } = req.nextUrl;
  const mode = searchParams.get("mode") ?? "explore"; // "explore" | "suggested"

  const userId = authUser?.id ?? null;

  // Following IDs
  const followRows = userId
    ? await prisma.$queryRaw<{ followingId: number }[]>`
        SELECT "followingId" FROM "UserFollow" WHERE "followerId" = ${userId}
      `.catch(() => [])
    : [];
  const followingIds = new Set(followRows.map(r => r.followingId));

  // All CIRCLE users
  const users = await prisma.$queryRaw<{
    id: number; name: string; handle: string; avatar: string | null;
    title: string; verified: boolean; isPremium: boolean; followers: string;
  }[]>`
    SELECT id, name, handle, avatar, title, verified, "isPremium", followers
    FROM "User"
    WHERE role = 'CIRCLE'
      AND (banned = false OR banned IS NULL)
      AND "deactivatedAt" IS NULL
  `.catch(() => []);

  if (users.length === 0) return NextResponse.json([]);

  const userIds = users.map(u => u.id);

  // ── Base scoring signals (all modes) ─────────────────────────────────────────

  const [reachRows, velocityRows, socialRows, companyRows] = await Promise.all([
    prisma.$queryRaw<{ userId: number; reach: bigint }[]>`
      SELECT p."userId",
        (COUNT(DISTINCT pl.id) * 1 + COUNT(DISTINCT pc.id) * 3) AS reach
      FROM "Post" p
      LEFT JOIN "PostLike" pl ON pl."postId" = p.id
      LEFT JOIN "PostComment" pc ON pc."postId" = p.id
      WHERE p."userId" = ANY(${userIds}::int[])
        AND (p.status = 'published' OR p.status IS NULL)
      GROUP BY p."userId"
    `.catch(() => []),

    prisma.$queryRaw<{ userId: number; velocity: bigint }[]>`
      SELECT p."userId",
        (COUNT(DISTINCT pl.id) * 1 + COUNT(DISTINCT pc.id) * 3) AS velocity
      FROM "Post" p
      LEFT JOIN "PostLike" pl ON pl."postId" = p.id
      LEFT JOIN "PostComment" pc ON pc."postId" = p.id
      WHERE p."userId" = ANY(${userIds}::int[])
        AND p."createdAt" > NOW() - INTERVAL '7 days'
        AND (p.status = 'published' OR p.status IS NULL)
      GROUP BY p."userId"
    `.catch(() => []),

    userId && followingIds.size > 0
      ? prisma.$queryRaw<{ userId: number; mutual: bigint }[]>`
          SELECT f2."followingId" AS "userId", COUNT(*) AS mutual
          FROM "UserFollow" f1
          JOIN "UserFollow" f2 ON f1."followingId" = f2."followerId"
          WHERE f1."followerId" = ${userId}
            AND f2."followingId" = ANY(${userIds}::int[])
          GROUP BY f2."followingId"
        `.catch(() => [])
      : Promise.resolve([]),

    prisma.$queryRaw<{ userId: number }[]>`
      SELECT "userId" FROM "circle_upgrade_requests"
      WHERE "userId" = ANY(${userIds}::int[])
        AND "accountType" = 'COMPANY'
        AND status = 'APPROVED'
    `.catch(() => []),
  ]);

  const reachMap   = new Map(reachRows.map(r => [r.userId, Number(r.reach)]));
  const velMap     = new Map(velocityRows.map(r => [r.userId, Number(r.velocity)]));
  const socialMap  = new Map(socialRows.map(r => [r.userId, Number(r.mutual)]));
  const companySet = new Set(companyRows.map(r => r.userId));

  // ── Suggested-only signals ────────────────────────────────────────────────────

  let affinityMap  = new Map<number, number>();
  let authorTagMap = new Map<number, Set<string>>();
  let userTagSet   = new Set<string>();

  if (mode === "suggested") {
    const [affinityRows, tagRows, interestRows] = await Promise.all([
      // Recency-weighted engagement with each Circle member's posts (30 days)
      userId
        ? prisma.$queryRaw<{ userId: number; affinity: number }[]>`
            SELECT p."userId",
              SUM(COALESCE(pe.value, 1.0) * POWER(0.9::float, EXTRACT(EPOCH FROM (NOW() - pe."createdAt")) / 86400.0)) AS affinity
            FROM "PostEngagement" pe
            JOIN "Post" p ON p.id = pe."postId"
            WHERE pe."userId" = ${userId}
              AND pe.action IN ('like','comment','dwell','follow_author')
              AND pe."createdAt" > NOW() - INTERVAL '30 days'
              AND p."userId" = ANY(${userIds}::int[])
            GROUP BY p."userId"
          `.catch(() => [])
        : Promise.resolve([]),

      // Post tags per Circle member (for interest match)
      prisma.$queryRaw<{ userId: number; tag: string }[]>`
        SELECT DISTINCT p."userId", UNNEST(p.tags) AS tag
        FROM "Post" p
        WHERE p."userId" = ANY(${userIds}::int[])
          AND (p.status = 'published' OR p.status IS NULL)
      `.catch(() => []),

      // Viewer's interest tags
      userId
        ? prisma.$queryRaw<{ name: string }[]>`
            SELECT name FROM "UserInterest" WHERE "userId" = ${userId}
          `.catch(() => [])
        : Promise.resolve([]),
    ]);

    affinityMap = new Map(affinityRows.map(r => [r.userId, Number(r.affinity)]));

    for (const row of tagRows) {
      if (!authorTagMap.has(row.userId)) authorTagMap.set(row.userId, new Set());
      authorTagMap.get(row.userId)!.add(row.tag.toLowerCase());
    }
    userTagSet = new Set((interestRows as any[]).map((r: any) => r.name.toLowerCase()));
  }

  // ── Score ─────────────────────────────────────────────────────────────────────

  const scored = users.map(u => {
    const followers  = parseFollowers(u.followers ?? "0");
    const totalReach = reachMap.get(u.id) ?? 0;
    const vel        = velMap.get(u.id) ?? 0;
    const mutual     = socialMap.get(u.id) ?? 0;
    const affinity   = affinityMap.get(u.id) ?? 0;

    const followerScore  = Math.log10(Math.max(followers + 1, 1)) * 10;
    const reachScore     = Math.log10(Math.max(totalReach + 1, 1)) * 8;
    const velocityScore  = Math.log10(Math.max(vel + 1, 1)) * 6;
    const socialScore    = Math.min(mutual * 3, 15);
    // Suggested-only: affinity + interest boost
    const affinityScore  = mode === "suggested" ? Math.min(affinity, 10) : 0;
    const authorTags     = authorTagMap.get(u.id) ?? new Set<string>();
    const hasInterestMatch = userTagSet.size > 0 && [...authorTags].some(t => userTagSet.has(t));
    const interestBonus  = mode === "suggested" && hasInterestMatch ? 5 : 0;

    const baseScore = followerScore + reachScore + velocityScore + socialScore + affinityScore;

    let multiplier = 1.0;
    if (u.verified)  multiplier += 0.10;
    if (u.isPremium) multiplier += 0.05;

    const score = (baseScore + interestBonus) * multiplier;

    const reason = mode === "suggested"
      ? suggestedReason(mutual, affinity, hasInterestMatch, Number(vel))
      : undefined;

    return {
      user: u,
      score,
      velocityScore: velocityScore * multiplier,
      mutualFollows: mutual,
      isCompany: companySet.has(u.id),
      reason,
    };
  });

  // ── Sort ──────────────────────────────────────────────────────────────────────

  scored.sort((a, b) => b.score - a.score);

  // Suggested: exclude already-followed members (server-side)
  const filtered = mode === "suggested" && userId
    ? scored.filter(s => !followingIds.has(s.user.id))
    : scored;

  return NextResponse.json(
    filtered.map(({ user, score, velocityScore, mutualFollows, isCompany, reason }, i) => ({
      id:           user.id,
      name:         user.name,
      handle:       user.handle,
      avatar:       resolveAvatar(user.avatar),
      title:        user.title ?? "",
      verified:     user.verified,
      isPremium:    user.isPremium,
      followers:    user.followers ?? "0",
      rank:         i + 1,
      hasInitial:   !user.avatar,
      initial:      user.name.charAt(0).toUpperCase(),
      initialBg:    INITIAL_COLORS[Math.abs(user.id) % INITIAL_COLORS.length],
      isFollowing:  followingIds.has(user.id),
      mutualFollows,
      isCompany,
      score,
      velocityScore,
      reason,
    }))
  );
}
