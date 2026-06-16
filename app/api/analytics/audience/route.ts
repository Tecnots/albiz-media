import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = authUser.id;
  const { searchParams } = new URL(request.url);

  const daysParam = searchParams.get("days");
  const days      = daysParam && daysParam !== "all" ? parseInt(daysParam) : 30;
  const tzOffsetMin = parseInt(searchParams.get("tz") || "0");
  const tzOffsetMs  = tzOffsetMin * 60 * 1000;

  const DAY_MS     = 24 * 60 * 60 * 1000;
  const nowMs      = Date.now();
  const rangeStart = new Date(nowMs - days * DAY_MS);
  const prevStart  = new Date(nowMs - days * 2 * DAY_MS);

  // ── All followers (for aggregation) ──────────────────────────────────────────
  const allFollowers = await prisma.userFollow.findMany({
    where: { followingId: userId },
    orderBy: { createdAt: "desc" },
    include: {
      follower: {
        select: {
          id: true,
          name: true,
          handle: true,
          avatar: true,
          title: true,
          city: true,
          country: true,
          countryCode: true,
        },
      },
    },
  });

  const totalFollowers = allFollowers.length;

  // ── Unfollow events ───────────────────────────────────────────────────────────
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const unfollowEvents = await prisma.userUnfollowEvent.findMany({
    where: { followingId: userId, createdAt: { gte: sixMonthsAgo } },
    select: { followerId: true, createdAt: true },
  });

  // Current and previous period counts
  const newFollowers     = allFollowers.filter(f => f.createdAt >= rangeStart).length;
  const prevNewFollowers = allFollowers.filter(f => f.createdAt >= prevStart && f.createdAt < rangeStart).length;
  const lostFollowers    = unfollowEvents.filter(f => f.createdAt >= rangeStart).length;
  const prevLostFollowers = unfollowEvents.filter(f => f.createdAt >= prevStart && f.createdAt < rangeStart).length;
  const netGrowth        = newFollowers - lostFollowers;

  const calcChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return parseFloat(((curr - prev) / prev * 100).toFixed(1));
  };

  // ── Recent followers (last 10) ────────────────────────────────────────────────
  const recentFollowers = allFollowers.slice(0, 10).map(f => ({
    id:         f.follower.id,
    name:       f.follower.name,
    handle:     f.follower.handle,
    avatar:     f.follower.avatar,
    title:      f.follower.title || "",
    followedAt: f.createdAt.toISOString(),
  }));

  // ── Follower growth — monthly with unfollow counts ────────────────────────────
  const recentFollowEvents = allFollowers.filter(f => f.createdAt >= sixMonthsAgo);

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  let cumulative = allFollowers.filter(f => f.createdAt < sixMonthsAgo).length;

  const followerGrowth = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

    const gained = recentFollowEvents.filter(
      f => f.createdAt >= monthStart && f.createdAt <= monthEnd
    ).length;

    const lost = unfollowEvents.filter(
      f => f.createdAt >= monthStart && f.createdAt <= monthEnd
    ).length;

    cumulative += gained - lost;

    return {
      month:      MONTHS[d.getMonth()],
      gained,
      lost,
      net:        gained - lost,
      cumulative: Math.max(0, cumulative),
    };
  });

  // ── Engaged followers in range ────────────────────────────────────────────────
  const followerIds = new Set(allFollowers.map(f => f.follower.id));

  const [likeEvents, commentEvents] = await Promise.all([
    prisma.postLike.findMany({
      where: { post: { userId }, createdAt: { gte: rangeStart } },
      select: { userId: true },
    }),
    prisma.postComment.findMany({
      where: { post: { userId }, createdAt: { gte: rangeStart } },
      select: { userId: true },
    }),
  ]);

  // Count engagements per user
  const engMap = new Map<number, number>();
  for (const e of [...likeEvents, ...commentEvents]) {
    engMap.set(e.userId, (engMap.get(e.userId) || 0) + 1);
  }

  // Fetch user info for top engaged users
  const topEngagedIds = [...engMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id]) => id);

  const engagedUsers = topEngagedIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: topEngagedIds } },
        select: { id: true, name: true, handle: true, avatar: true, title: true },
      })
    : [];

  const engagedFollowers = topEngagedIds.map(id => {
    const user = engagedUsers.find(u => u.id === id);
    return {
      id,
      name:        user?.name  ?? "Unknown",
      handle:      user?.handle ?? "",
      avatar:      user?.avatar ?? null,
      title:       user?.title  ?? "",
      engagements: engMap.get(id) ?? 0,
      isFollower:  followerIds.has(id),
    };
  });

  // Activity rate: % of followers who engaged at least once in range
  const activeFollowerCount = [...engMap.keys()].filter(id => followerIds.has(id)).length;
  const activityRate = totalFollowers > 0
    ? parseFloat(((activeFollowerCount / totalFollowers) * 100).toFixed(1))
    : 0;

  // ── Top locations ─────────────────────────────────────────────────────────────
  const locationMap = new Map<string, number>();
  for (const f of allFollowers) {
    const loc = f.follower.city || f.follower.country;
    if (loc) locationMap.set(loc, (locationMap.get(loc) || 0) + 1);
  }

  const topLocations = [...locationMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({
      name,
      count,
      pct: totalFollowers > 0 ? Math.round((count / totalFollowers) * 100) : 0,
    }));

  // ── Top countries (for globe) ─────────────────────────────────────────────────
  // Group by countryCode (ISO alpha-2) to avoid case/format fragmentation from freeform country strings.
  // Keep the display name from the first occurrence for each code.
  const countryCodeMap = new Map<string, { name: string; count: number }>();
  for (const f of allFollowers) {
    const code = f.follower.countryCode?.toUpperCase();
    if (!code) continue;
    const existing = countryCodeMap.get(code);
    if (existing) {
      existing.count++;
    } else {
      countryCodeMap.set(code, { name: f.follower.country ?? code, count: 1 });
    }
  }

  const topCountries = [...countryCodeMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20)
    .map(([code, { name, count }]) => ({
      name,
      code,
      count,
      pct: totalFollowers > 0 ? Math.round((count / totalFollowers) * 100) : 0,
    }));

  // ── Demographics ──────────────────────────────────────────────────────────────
  const followerIdList = allFollowers.map(f => f.follower.id);

  // Gender breakdown from follower profiles
  const genderRows = followerIdList.length > 0
    ? await prisma.user.groupBy({
        by: ["gender"],
        where: { id: { in: followerIdList }, gender: { not: null } },
        _count: { gender: true },
      })
    : [];

  const genderTotal = genderRows.reduce((s, r) => s + r._count.gender, 0);
  const genderSplit = genderRows
    .filter(r => r.gender)
    .map(r => ({
      label: r.gender === "male" ? "Male"
           : r.gender === "female" ? "Female"
           : r.gender === "nonbinary" ? "Non-binary"
           : "Other",
      count: r._count.gender,
      pct: genderTotal > 0 ? Math.round((r._count.gender / genderTotal) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Age distribution: compute from birthYear of followers
  const currentYear = new Date().getFullYear();
  const followerBirthYears = followerIdList.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: followerIdList }, birthYear: { not: null } },
        select: { birthYear: true },
      })
    : [];

  const AGE_BUCKETS = [
    { range: "18–24", min: 18, max: 24 },
    { range: "25–34", min: 25, max: 34 },
    { range: "35–44", min: 35, max: 44 },
    { range: "45–54", min: 45, max: 54 },
    { range: "55+",   min: 55, max: 999 },
  ];

  const ageCounts = AGE_BUCKETS.map(b => ({ ...b, count: 0 }));
  for (const { birthYear } of followerBirthYears) {
    if (!birthYear) continue;
    const age = currentYear - birthYear;
    const bucket = ageCounts.find(b => age >= b.min && age <= b.max);
    if (bucket) bucket.count++;
  }
  const ageTotal = ageCounts.reduce((s, b) => s + b.count, 0);
  const ageRanges = ageCounts.map(b => ({
    range: b.range,
    count: b.count,
    pct: ageTotal > 0 ? Math.round((b.count / ageTotal) * 100) : 0,
  }));

  // Device breakdown from PostImpression on the author's posts
  const authorPosts = await prisma.post.findMany({
    where: { userId },
    select: { id: true },
  });
  const authorPostIds = authorPosts.map(p => p.id);

  const deviceRows = authorPostIds.length > 0
    ? await prisma.$queryRaw<{ device: string; count: bigint }[]>`
        SELECT device, COUNT(*) as count
        FROM "PostImpression"
        WHERE "postId" = ANY(${authorPostIds}::int[])
          AND device IS NOT NULL
        GROUP BY device
      `
    : [];

  const deviceTotal = deviceRows.reduce((s, r) => s + Number(r.count), 0);
  const devices = deviceRows
    .map(r => ({
      label: r.device,
      count: Number(r.count),
      pct: deviceTotal > 0 ? Math.round((Number(r.count) / deviceTotal) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // ── Response ──────────────────────────────────────────────────────────────────
  return NextResponse.json({
    totalFollowers,
    newFollowers,
    lostFollowers,
    netGrowth,
    newFollowersChange:  calcChange(newFollowers, prevNewFollowers),
    lostFollowersChange: calcChange(lostFollowers, prevLostFollowers),
    activityRate,
    activeFollowerCount,
    followerGrowth,
    recentFollowers,
    engagedFollowers,
    topLocations,
    topCountries,
    genderSplit,
    ageRanges,
    devices,
  });
}
