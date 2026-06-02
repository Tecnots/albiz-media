import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";
import { blobStorageService } from "@/lib/blob-storage";

function parseFollowers(s: string): number {
  if (!s) return 0;
  const c = s.replace(/,/g, "").trim().toLowerCase();
  if (c.endsWith("m")) return Math.round(parseFloat(c) * 1_000_000);
  if (c.endsWith("k")) return Math.round(parseFloat(c) * 1_000);
  return parseInt(c) || 0;
}

function resolveAvatar(image: string | null): string | null {
  if (!image) return null;
  if (blobStorageService.isAvailable) {
    const blobName = blobStorageService.extractBlobName(image);
    if (blobName) return blobStorageService.getFileUrl(blobName);
  }
  return image;
}

function suggestedReason(
  mutual: number,
  affinity: number,
  hasInterestMatch: boolean,
  role: string
): string | undefined {
  if (affinity > 2)       return "Based on your activity";
  if (mutual >= 3)        return `${mutual} people you follow also follow them`;
  if (mutual === 2)       return "2 people you follow also follow them";
  if (mutual === 1)       return "Someone you follow also follows them";
  if (hasInterestMatch)   return "Matches your interests";
  if (role === "CIRCLE")  return "Circle member";
  return undefined;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "5"), 20);

  const authUser = await getAuthUser(req);
  const userId   = authUser?.id ?? 0;

  // Load following IDs to exclude already-followed users
  const followRows = userId
    ? await prisma.$queryRaw<{ followingId: number }[]>`
        SELECT "followingId" FROM "UserFollow" WHERE "followerId" = ${userId}
      `.catch(() => [])
    : [];
  const followingIds = new Set(followRows.map(r => r.followingId));

  // Candidates: CIRCLE and AUTHOR users only — the professional discovery surface
  const candidates = await prisma.$queryRaw<{
    id: number; name: string; handle: string; avatar: string | null;
    title: string; verified: boolean; isPremium: boolean;
    followers: string; role: string; hasStory: boolean;
  }[]>`
    SELECT id, name, handle, avatar, title, verified, "isPremium", followers, role, "hasStory"
    FROM "User"
    WHERE role IN ('CIRCLE', 'AUTHOR')
      AND (banned = false OR banned IS NULL)
      AND "deactivatedAt" IS NULL
  `.catch(() => []);

  if (candidates.length === 0) return NextResponse.json([]);

  // Exclude current user + already-followed (JS filter — avoids dynamic SQL interpolation)
  const unfollowed = candidates.filter(u => u.id !== userId && !followingIds.has(u.id));
  if (unfollowed.length === 0) return NextResponse.json([]);

  const candidateIds = unfollowed.map(u => u.id);

  // Scoring signals — all in parallel
  const [reachRows, velocityRows, socialRows, affinityRows, tagRows, interestRows] = await Promise.all([
    // All-time reach: likes + comments×3
    prisma.$queryRaw<{ userId: number; reach: bigint }[]>`
      SELECT p."userId",
        (COUNT(DISTINCT pl.id) * 1 + COUNT(DISTINCT pc.id) * 3) AS reach
      FROM "Post" p
      LEFT JOIN "PostLike" pl ON pl."postId" = p.id
      LEFT JOIN "PostComment" pc ON pc."postId" = p.id
      WHERE p."userId" = ANY(${candidateIds}::int[])
        AND (p.status = 'published' OR p.status IS NULL)
      GROUP BY p."userId"
    `.catch(() => []),

    // Velocity: engagement in last 7 days
    prisma.$queryRaw<{ userId: number; velocity: bigint }[]>`
      SELECT p."userId",
        (COUNT(DISTINCT pl.id) * 1 + COUNT(DISTINCT pc.id) * 3) AS velocity
      FROM "Post" p
      LEFT JOIN "PostLike" pl ON pl."postId" = p.id
      LEFT JOIN "PostComment" pc ON pc."postId" = p.id
      WHERE p."userId" = ANY(${candidateIds}::int[])
        AND p."createdAt" > NOW() - INTERVAL '7 days'
        AND (p.status = 'published' OR p.status IS NULL)
      GROUP BY p."userId"
    `.catch(() => []),

    // Mutual follows: people the viewer follows who also follow each candidate
    userId && followingIds.size > 0
      ? prisma.$queryRaw<{ userId: number; mutual: bigint }[]>`
          SELECT f2."followingId" AS "userId", COUNT(*) AS mutual
          FROM "UserFollow" f1
          JOIN "UserFollow" f2 ON f1."followingId" = f2."followerId"
          WHERE f1."followerId" = ${userId}
            AND f2."followingId" = ANY(${candidateIds}::int[])
          GROUP BY f2."followingId"
        `.catch(() => [])
      : Promise.resolve([]),

    // Affinity: viewer's recency-weighted engagement with each candidate's posts
    userId
      ? prisma.$queryRaw<{ userId: number; affinity: number }[]>`
          SELECT p."userId",
            SUM(COALESCE(pe.value, 1.0) * POWER(0.9::float, EXTRACT(EPOCH FROM (NOW() - pe."createdAt")) / 86400.0)) AS affinity
          FROM "PostEngagement" pe
          JOIN "Post" p ON p.id = pe."postId"
          WHERE pe."userId" = ${userId}
            AND pe.action IN ('like','comment','dwell','follow_author')
            AND pe."createdAt" > NOW() - INTERVAL '30 days'
            AND p."userId" = ANY(${candidateIds}::int[])
          GROUP BY p."userId"
        `.catch(() => [])
      : Promise.resolve([]),

    // Post tags per candidate — for interest match
    prisma.$queryRaw<{ userId: number; tag: string }[]>`
      SELECT DISTINCT p."userId", UNNEST(p.tags) AS tag
      FROM "Post" p
      WHERE p."userId" = ANY(${candidateIds}::int[])
        AND (p.status = 'published' OR p.status IS NULL)
    `.catch(() => []),

    // Viewer's interest tags
    userId
      ? prisma.$queryRaw<{ name: string }[]>`
          SELECT name FROM "UserInterest" WHERE "userId" = ${userId}
        `.catch(() => [])
      : Promise.resolve([]),
  ]);

  const reachMap    = new Map(reachRows.map(r => [r.userId, Number(r.reach)]));
  const velMap      = new Map(velocityRows.map(r => [r.userId, Number(r.velocity)]));
  const socialMap   = new Map(socialRows.map(r => [r.userId, Number(r.mutual)]));
  const affinityMap = new Map(affinityRows.map(r => [r.userId, Number(r.affinity)]));

  const authorTagMap = new Map<number, Set<string>>();
  for (const row of tagRows) {
    if (!authorTagMap.has(row.userId)) authorTagMap.set(row.userId, new Set());
    authorTagMap.get(row.userId)!.add(row.tag.toLowerCase());
  }
  const userTagSet = new Set((interestRows as any[]).map((r: any) => r.name.toLowerCase()));

  // Score each candidate
  const scored = unfollowed.map(u => {
    const followers  = parseFollowers(u.followers ?? "0");
    const reach      = reachMap.get(u.id) ?? 0;
    const vel        = velMap.get(u.id) ?? 0;
    const mutual     = socialMap.get(u.id) ?? 0;
    const affinity   = affinityMap.get(u.id) ?? 0;

    const followerScore  = Math.log10(Math.max(followers + 1, 1)) * 10;
    const reachScore     = Math.log10(Math.max(reach + 1, 1)) * 8;
    const velocityScore  = Math.log10(Math.max(vel + 1, 1)) * 5;
    const socialScore    = Math.min(mutual * 3, 15);
    const affinityScore  = Math.min(affinity, 10);

    const authorTags       = authorTagMap.get(u.id) ?? new Set<string>();
    const hasInterestMatch = userTagSet.size > 0 && [...authorTags].some(t => userTagSet.has(t));
    const interestBonus    = hasInterestMatch ? 5 : 0;

    const base = followerScore + reachScore + velocityScore + socialScore + affinityScore;

    let multiplier = 1.0;
    if (u.verified)          multiplier += 0.10;
    if (u.isPremium)         multiplier += 0.05;
    if (u.role === "CIRCLE") multiplier += 0.08;
    if (u.role === "AUTHOR") multiplier += 0.05;

    const score  = (base + interestBonus) * multiplier;
    const reason = suggestedReason(mutual, affinity, hasInterestMatch, u.role);

    return { user: u, score, mutual, reason };
  });

  scored.sort((a, b) => b.score - a.score);

  const top = scored.slice(0, limit);

  return NextResponse.json(
    top.map(({ user, score, mutual, reason }) => ({
      id:           user.id,
      name:         user.name,
      handle:       user.handle,
      title:        user.title ?? "",
      avatar:       resolveAvatar(user.avatar),
      verified:     user.verified,
      isPremium:    user.isPremium,
      role:         user.role,
      hasStory:     user.hasStory,
      followers:    user.followers ?? "0",
      mutualFollows: mutual,
      score,
      reason,
    }))
  );
}
