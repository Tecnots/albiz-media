import { NextRequest, NextResponse } from "next/server";
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


export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const tab    = searchParams.get("tab") ?? "all";
  const sub    = searchParams.get("sub") ?? "top";
  const cursor = parseInt(searchParams.get("cursor") ?? "0");
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);

  const authUser = await getAuthUser(req);
  const userId   = authUser?.id ?? 0;

  // Step 1: Load following IDs (needed for mutual follows display + followed tab)
  const followRows = userId
    ? await prisma.$queryRaw<{ followingId: number }[]>`
        SELECT "followingId" FROM "UserFollow" WHERE "followerId" = ${userId}
      `.catch(() => [])
    : [];

  const followingIds = followRows.map(r => r.followingId);

  // Step 2: Early exit for "followed" tab
  if (tab === "followed") {
    if (!userId) {
      return NextResponse.json({ users: [], nextCursor: 0, hasMore: false, total: 0, empty: "sign_in" });
    }
    if (followingIds.length === 0) {
      return NextResponse.json({ users: [], nextCursor: 0, hasMore: false, total: 0, empty: "no_follows" });
    }
  }

  // Step 3: Fetch candidates using Prisma ORM (safe, avoids raw SQL boolean issues)
  let rawUsers: any[];

  if (tab === "followed") {
    rawUsers = await prisma.user.findMany({
      where: { id: { in: followingIds }, deactivatedAt: null, role: { in: ["CIRCLE", "AUTHOR"] } },
      select: {
        id: true, name: true, handle: true, title: true, avatar: true,
        verified: true, isPremium: true, hasStory: true, role: true,
        followers: true, followingCount: true, bio: true, location: true,
        website: true, joinedDate: true,
      },
      take: 300,
    }).catch(() => []);
  } else {
    rawUsers = await prisma.user.findMany({
      where: {
        deactivatedAt: null,
        banned: { not: true },
        role: { in: ["CIRCLE", "AUTHOR"] },
        ...(userId ? { id: { not: userId } } : {}),
      },
      select: {
        id: true, name: true, handle: true, title: true, avatar: true,
        verified: true, isPremium: true, hasStory: true, role: true,
        followers: true, followingCount: true, bio: true, location: true,
        website: true, joinedDate: true,
      },
      orderBy: { id: "desc" },
      take: 500,
    }).catch(() => []);
  }

  // Tab filter in JS
  let candidates: any[] = tab === "followed"
    ? rawUsers
    : rawUsers.filter(u => {
        const title = (u.title ?? "").toLowerCase();
        switch (tab) {
          case "creators":  return title.includes("creator") || title.includes("founder");
          case "investor":  return title.includes("investor") || title.includes("entrepreneur");
          case "ceo":       return title.includes("ceo");
          case "other":
            return !title.includes("creator") && !title.includes("founder") &&
                   !title.includes("investor") && !title.includes("entrepreneur") &&
                   !title.includes("ceo");
          default:          return true;
        }
      });

  // Step 4: Sub-tab filter (People / Companies)
  // Companies are identified via CircleUpgradeRequest.accountType = "COMPANY" (approved).
  // Title keyword matching is unreliable — Circle company profiles don't use "inc"/"corp" etc.
  // AUTHORS are always individuals (people), never companies.
  if (sub === "people" || sub === "companies") {
    const preCandidateIds = candidates.map(u => u.id);
    const companyRows = await prisma.circleUpgradeRequest.findMany({
      where: {
        userId: { in: preCandidateIds },
        accountType: "COMPANY",
        status: "APPROVED",
      },
      select: { userId: true },
    }).catch(() => []);

    const companyUserIds = new Set(companyRows.map(r => r.userId));

    if (sub === "companies") {
      candidates = candidates.filter(u => companyUserIds.has(u.id));
    } else {
      // People: exclude company accounts (AUTHOR role is always individual)
      candidates = candidates.filter(u => u.role === "AUTHOR" || !companyUserIds.has(u.id));
    }
  }

  if (candidates.length === 0) {
    return NextResponse.json({ users: [], nextCursor: 0, hasMore: false, total: 0 });
  }

  const candidateIds = candidates.map(u => u.id);

  // Step 5: Fetch scoring signals in parallel
  const [velocityRows, reachRows, socialRows, affinityRows, tagRows, interestRows, viewerRows] = await Promise.all([
    // Content velocity: likes + comments×3 on their posts in last 7 days
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

    // Total reach: all-time likes + comments×3 — global authority anchor
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

    // Mutual follows — for display label + socialScore
    userId && followingIds.length > 0
      ? prisma.$queryRaw<{ userId: number; mutual: bigint }[]>`
          SELECT f2."followingId" AS "userId", COUNT(*) AS mutual
          FROM "UserFollow" f1
          JOIN "UserFollow" f2 ON f1."followingId" = f2."followerId"
          WHERE f1."followerId" = ${userId}
            AND f2."followingId" = ANY(${candidateIds}::int[])
          GROUP BY f2."followingId"
        `.catch(() => [])
      : Promise.resolve([]),

    // Affinity: recency-weighted engagement with candidate authors (30-day window)
    userId
      ? prisma.$queryRaw<{ userId: number; affinity: number }[]>`
          SELECT p."userId",
            SUM(COALESCE(pe.value, 1.0) * POWER(0.9::float, EXTRACT(EPOCH FROM (NOW() - pe."createdAt")) / 86400.0)) AS affinity
          FROM "PostEngagement" pe
          JOIN "Post" p ON p.id = pe."postId"
          WHERE pe."userId" = ${userId}
            AND pe.action IN ('like', 'comment', 'dwell', 'follow_author')
            AND pe."createdAt" > NOW() - INTERVAL '30 days'
            AND p."userId" = ANY(${candidateIds}::int[])
          GROUP BY p."userId"
        `.catch(() => [])
      : Promise.resolve([]),

    // Post tags — for interest match bonus (distinct tags per author)
    prisma.$queryRaw<{ userId: number; tag: string }[]>`
      SELECT DISTINCT p."userId", UNNEST(p.tags) AS tag
      FROM "Post" p
      WHERE p."userId" = ANY(${candidateIds}::int[])
        AND (p.status = 'published' OR p.status IS NULL)
    `.catch(() => []),

    // Current viewer's interest tags
    userId
      ? prisma.$queryRaw<{ name: string }[]>`
          SELECT name FROM "UserInterest" WHERE "userId" = ${userId}
        `.catch(() => [])
      : Promise.resolve([]),

    // Viewer role (for peer boost)
    userId
      ? prisma.$queryRaw<{ role: string }[]>`
          SELECT role FROM "User" WHERE id = ${userId} LIMIT 1
        `.catch(() => [])
      : Promise.resolve([]),
  ]);

  const velocityMap  = new Map(velocityRows.map(r => [r.userId, Number(r.velocity)]));
  const reachMap     = new Map(reachRows.map(r => [r.userId, Number(r.reach)]));
  const socialMap    = new Map(socialRows.map(r => [r.userId, Number(r.mutual)]));
  const affinityMap  = new Map(affinityRows.map(r => [r.userId, Number(r.affinity)]));

  // Build per-author tag set for interest matching
  const authorTagMap = new Map<number, Set<string>>();
  for (const row of tagRows) {
    if (!authorTagMap.has(row.userId)) authorTagMap.set(row.userId, new Set());
    authorTagMap.get(row.userId)!.add(row.tag.toLowerCase());
  }
  const userTagSet   = new Set((interestRows as any[]).map((r: any) => r.name.toLowerCase()));
  const viewerRole   = (viewerRows as any[])[0]?.role ?? "NORMAL";
  const viewerIsPro  = viewerRole === "CIRCLE" || viewerRole === "AUTHOR";

  // Step 6: Score each candidate
  const scored = candidates.map(u => {
    const followers   = parseFollowers(u.followers ?? "0");
    const totalReach  = reachMap.get(u.id) ?? 0;
    const vel         = velocityMap.get(u.id) ?? 0;
    const mutualCount = socialMap.get(u.id) ?? 0;
    const affinity    = affinityMap.get(u.id) ?? 0;

    // Additive base — zero followers + zero posts = zero score
    const followerScore  = Math.log10(Math.max(followers + 1, 1)) * 10;   // 0–30 pts
    const reachScore     = Math.log10(Math.max(totalReach + 1, 1)) * 8;   // 0–24 pts
    const velocityScore  = Math.log10(Math.max(vel + 1, 1)) * 5;          // 0–15 pts
    const socialScore    = Math.min(mutualCount * 3, 15);                  // 0–15 pts (mutual follows)
    const affinityScore  = Math.min(affinity, 10);                         // 0–10 pts (engagement history)

    // Interest match bonus: +5 pts if this author posts in topics the viewer follows
    const authorTags    = authorTagMap.get(u.id) ?? new Set<string>();
    const interestBonus = (userTagSet.size > 0 && [...authorTags].some(t => userTagSet.has(t))) ? 5 : 0;

    const baseScore = followerScore + reachScore + velocityScore + socialScore + affinityScore;

    // Role/verification multiplier — only boosts profiles with a real base score
    let multiplier = 1.0;
    if (u.verified)          multiplier += 0.10;
    if (u.isPremium)         multiplier += 0.05;
    if (u.role === "AUTHOR") multiplier += 0.08;
    if (u.role === "CIRCLE") multiplier += 0.06;
    // Peer boost: Circle/Author viewers see other Circle/Author profiles ranked higher
    if (viewerIsPro && (u.role === "CIRCLE" || u.role === "AUTHOR")) multiplier += 0.20;

    const score = (baseScore + interestBonus) * multiplier;

    return { user: u, score, mutualFollows: mutualCount };
  });

  // Step 7: Sort — deterministic, no jitter so rank is stable across refreshes
  if (sub === "latest") {
    scored.sort((a, b) => b.user.id - a.user.id);
  } else {
    scored.sort((a, b) => b.score - a.score);
  }

  const total = scored.length;
  const page  = scored.slice(cursor, cursor + limit);

  const users = page.map(({ user, score, mutualFollows }, idx) => ({
    id:            user.id,
    name:          user.name,
    handle:        user.handle,
    title:         user.title ?? "",
    avatar:        resolveAvatar(user.avatar),
    verified:      user.verified,
    isPremium:     user.isPremium,
    hasStory:      user.hasStory,
    role:          user.role,
    followers:     user.followers ?? "0",
    followingCount: user.followingCount ?? "0",
    bio:           user.bio ?? null,
    location:      user.location ?? null,
    website:       user.website ?? null,
    joinedDate:    user.joinedDate ?? null,
    isFollowing:   followingIds.includes(user.id),
    mutualFollows,
    score,
    rank:          cursor + idx + 1,
  }));

  return NextResponse.json({ users, nextCursor: cursor + limit, hasMore: cursor + limit < total, total });
}
