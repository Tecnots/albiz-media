import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";
import { blobStorageService } from "@/lib/blob-storage";
import { cacheGet, cacheSet } from "@/lib/cache";

function parseStat(s: string): number {
  if (!s) return 0;
  const c = s.replace(/,/g, "").trim().toLowerCase();
  if (c.endsWith("m")) return Math.round(parseFloat(c) * 1_000_000);
  if (c.endsWith("k")) return Math.round(parseFloat(c) * 1_000);
  return parseInt(c) || 0;
}

function resolveImage(image: string | null | undefined): string | null {
  return blobStorageService.resolveMediaUrl(image);
}

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (authUser.role !== 'CIRCLE' && authUser.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const mode   = (searchParams.get("mode") ?? "for-you") as "for-you" | "following" | "trending";
  const cursor = parseInt(searchParams.get("cursor") ?? "0");
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);

  const userId = authUser.id;

  // Short-lived cache for first page of each mode — reduces DB pressure on circle pages
  const cacheKey = `circle:feed:${userId}:${mode}:${cursor}:${limit}`;
  if (cursor === 0) {
    const cached = await cacheGet<object>(cacheKey);
    if (cached) return NextResponse.json(cached);
  }

  // Step 1: Get current user's following list
  const followingIds = new Set<number>();
  if (userId) {
    const rows = await prisma.$queryRaw<{ followingId: number }[]>`
      SELECT "followingId" FROM "UserFollow" WHERE "followerId" = ${userId}
    `.catch(() => []);
    rows.forEach(r => followingIds.add(r.followingId));
  }

  // Step 2: Get all CIRCLE-role user IDs
  const circleUsers = await prisma.$queryRaw<{
    id: number; name: string; handle: string; avatar: string | null;
    title: string; verified: boolean; isPremium: boolean; followers: string;
  }[]>`
    SELECT id, name, handle, avatar, title, verified, "isPremium", followers
    FROM "User"
    WHERE role = 'CIRCLE'
      AND (banned = false OR banned IS NULL)
      AND "deactivatedAt" IS NULL
  `.catch(() => []);

  if (circleUsers.length === 0) {
    return NextResponse.json({ items: [], nextCursor: 0, hasMore: false, total: 0 });
  }

  const circleUserIds = circleUsers.map(u => u.id);
  const userMap = new Map(circleUsers.map(u => [u.id, u]));

  // Step 3: Fetch posts from CIRCLE users
  let posts: any[] = [];

  if (mode === "following") {
    if (!userId || followingIds.size === 0) {
      return NextResponse.json({ items: [], nextCursor: 0, hasMore: false, total: 0, empty: userId ? "no_follows" : "sign_in" });
    }
    const followedCircleIds = circleUserIds.filter(id => followingIds.has(id));
    if (followedCircleIds.length === 0) {
      return NextResponse.json({ items: [], nextCursor: 0, hasMore: false, total: 0, empty: "no_follows" });
    }
    posts = await prisma.$queryRaw<any[]>`
      SELECT p.id, p."userId", p.type, p.content, p.title, p.description,
             p.image, p.tags, p.views, p.likes, p.comments, p.shares,
             COALESCE(p."createdAt", NOW()) AS "createdAt"
      FROM "Post" p
      WHERE p."userId" = ANY(${followedCircleIds}::int[])
        AND (p.status = 'published' OR p.status IS NULL)
      ORDER BY p."createdAt" DESC
      LIMIT 200
    `.catch(() => []);
  } else if (mode === "trending") {
    posts = await prisma.$queryRaw<any[]>`
      SELECT p.id, p."userId", p.type, p.content, p.title, p.description,
             p.image, p.tags, p.views, p.likes, p.comments, p.shares,
             COALESCE(p."createdAt", NOW()) AS "createdAt"
      FROM "Post" p
      WHERE p."userId" = ANY(${circleUserIds}::int[])
        AND (p.status = 'published' OR p.status IS NULL)
        AND COALESCE(p."createdAt", NOW()) > NOW() - INTERVAL '72 hours'
      ORDER BY p."createdAt" DESC
      LIMIT 300
    `.catch(() => []);
    // Fallback: if nothing in the last 72 hours, show all Circle posts ranked by velocity
    if (posts.length === 0) {
      posts = await prisma.$queryRaw<any[]>`
        SELECT p.id, p."userId", p.type, p.content, p.title, p.description,
               p.image, p.tags, p.views, p.likes, p.comments, p.shares,
               COALESCE(p."createdAt", NOW()) AS "createdAt"
        FROM "Post" p
        WHERE p."userId" = ANY(${circleUserIds}::int[])
          AND (p.status = 'published' OR p.status IS NULL)
        ORDER BY p."createdAt" DESC
        LIMIT 300
      `.catch(() => []);
    }
  } else {
    posts = await prisma.$queryRaw<any[]>`
      SELECT p.id, p."userId", p.type, p.content, p.title, p.description,
             p.image, p.tags, p.views, p.likes, p.comments, p.shares,
             COALESCE(p."createdAt", NOW()) AS "createdAt"
      FROM "Post" p
      WHERE p."userId" = ANY(${circleUserIds}::int[])
        AND (p.status = 'published' OR p.status IS NULL)
      ORDER BY p."createdAt" DESC
      LIMIT 500
    `.catch(() => []);
  }

  if (posts.length === 0) {
    return NextResponse.json({ items: [], nextCursor: 0, hasMore: false, total: 0 });
  }

  const postIds = posts.map(p => p.id);

  // Step 4: Scoring signals in parallel
  const [likeRows, likedRows, affinityRows, articleRows] = await Promise.all([
    prisma.$queryRaw<{ postId: number; count: bigint }[]>`
      SELECT "postId", COUNT(*) AS count FROM "PostLike"
      WHERE "postId" = ANY(${postIds}::int[])
      GROUP BY "postId"
    `.catch(() => []),

    userId
      ? prisma.$queryRaw<{ postId: number }[]>`
          SELECT "postId" FROM "PostLike"
          WHERE "userId" = ${userId} AND "postId" = ANY(${postIds}::int[])
        `.catch(() => [])
      : Promise.resolve([]),

    userId
      ? prisma.$queryRaw<{ userId: number; affinity: number }[]>`
          SELECT p."userId",
            SUM(pe.value * POWER(0.9::float, EXTRACT(EPOCH FROM (NOW() - pe."createdAt")) / 86400.0)) AS affinity
          FROM "PostEngagement" pe
          JOIN "Post" p ON p.id = pe."postId"
          WHERE pe."userId" = ${userId}
            AND pe.action IN ('like','comment','dwell','follow_author')
            AND pe."createdAt" > NOW() - INTERVAL '30 days'
            AND p."userId" = ANY(${circleUserIds}::int[])
          GROUP BY p."userId"
        `.catch(() => [])
      : Promise.resolve([]),

    // Article content for article-type posts
    prisma.$queryRaw<{ postId: number; paragraphs: string[] }[]>`
      SELECT "postId", paragraphs FROM "ArticleContent"
      WHERE "postId" = ANY(${postIds}::int[])
    `.catch(() => []),
  ]);

  const likeMap     = new Map(likeRows.map(r => [r.postId, Number(r.count)]));
  const likedSet    = new Set(likedRows.map(r => r.postId));
  const affinityMap = new Map(affinityRows.map(r => [r.userId, Number(r.affinity)]));
  const articleMap  = new Map(articleRows.map(r => [r.postId, r.paragraphs]));

  const nowMs = Date.now();

  // Step 5: Score each post
  const scored = posts.map(post => {
    const user      = userMap.get(post.userId);
    const likes     = likeMap.get(post.id) ?? 0;
    const comments  = parseStat(post.comments);
    const shares    = parseStat(post.shares);
    const followers = parseStat(user?.followers ?? "0");
    const hoursOld  = Math.max((nowMs - new Date(post.createdAt).getTime()) / 3_600_000, 0.1);

    const totalEngagement = likes + comments * 3 + shares * 2;

    // ── For You score ─────────────────────────────────────────────────────────
    // Authority-first: who has the most followers + all-time reach + personal signals
    const reachScore     = Math.log10(Math.max(totalEngagement + 1, 1)) * 8;
    const authorityBoost = Math.log10(Math.max(followers + 1, 1)) * 6; // boosted weight
    const freshnessScore = Math.max(0, (72 - hoursOld) / 72) * 3;
    const followBoost    = (userId && followingIds.has(post.userId)) ? 15 : 0;
    const affinityBoost  = Math.min(10, affinityMap.get(post.userId) ?? 0);

    let multiplier = 1.0;
    if (user?.verified)  multiplier += 0.10;
    if (user?.isPremium) multiplier += 0.05;

    const forYouScore = (reachScore + authorityBoost + freshnessScore + followBoost + affinityBoost) * multiplier;

    // ── Trending score ────────────────────────────────────────────────────────
    // Pure velocity: engagement per hour (no authority, no personal signals)
    // A post with 5 likes in 1h beats a post with 100 likes posted 2 weeks ago
    const words      = (post.content ?? post.title ?? "").replace(/<[^>]*>/g, "").split(/\s+/).filter(Boolean).length;
    const readMins   = Math.max(1, Math.round(words / 200));
    const normAge    = hoursOld / Math.max(readMins / 60, 0.1);
    const velocity   = totalEngagement / Math.max(normAge, 0.1);
    const trendScore = Math.log10(Math.max(velocity, 0.01) + 1) * 12;

    let reason = "From Circle";
    if (followingIds.has(post.userId))   reason = "From someone you follow";
    else if (trendScore > 5)             reason = "Trending in Circle";
    else if (affinityBoost > 3)          reason = "Based on your activity";

    return { post, user, score: forYouScore, trendScore, reason };
  });

  if (mode === "trending") {
    // Sort by velocity; when scores are equal (no engagement data), newer posts first
    scored.sort((a, b) => {
      const diff = b.trendScore - a.trendScore;
      if (Math.abs(diff) > 0.001) return diff;
      return new Date(b.post.createdAt).getTime() - new Date(a.post.createdAt).getTime();
    });
  } else {
    // For You: authority + engagement quality + freshness
    scored.sort((a, b) => b.score - a.score);
  }

  const total = scored.length;
  const page  = scored.slice(cursor, cursor + limit);

  const items = page.map(({ post, user, score, reason }, idx) => ({
    id:      post.id,
    type:    post.type?.toLowerCase() ?? "post",
    content: post.content,
    title:   post.title,
    image:   resolveImage(post.image),
    tags:    post.tags ?? [],
    liked:   likedSet.has(post.id),
    reason,
    score,
    rank: cursor + idx + 1,
    stats: {
      views:    post.views,
      likes:    post.likes || "0",
      comments: post.comments,
      shares:   post.shares,
    },
    articleContent: articleMap.has(post.id) ? { paragraphs: articleMap.get(post.id) } : undefined,
    member: user ? {
      id:        user.id,
      name:      user.name,
      handle:    user.handle,
      title:     user.title ?? "",
      avatar:    resolveImage(user.avatar),
      verified:  user.verified,
      isPremium: user.isPremium,
      followers: user.followers,
      hasInitial: !user.avatar,
      initial:   user.name.charAt(0).toUpperCase(),
      initialBg: `hsl(${(user.id * 47) % 360}, 60%, 45%)`,
    } : null,
  }));

  const responseData = { items, nextCursor: cursor + limit, hasMore: cursor + limit < total, total };
  if (cursor === 0) {
    cacheSet(cacheKey, responseData, 30).catch(() => {});
  }
  return NextResponse.json(responseData);
}
