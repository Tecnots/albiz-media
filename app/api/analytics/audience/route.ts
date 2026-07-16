import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";
import { blobStorageService } from "@/lib/blob-storage";

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = authUser.id;
  const { searchParams } = new URL(request.url);

  const daysParam = searchParams.get("days");
  const days      = daysParam && daysParam !== "all" ? Math.max(1, Math.min(365, parseInt(daysParam) || 30)) : 30;

  const DAY_MS     = 24 * 60 * 60 * 1000;
  const nowMs      = Date.now();
  const rangeStart = new Date(nowMs - days * DAY_MS);
  const prevStart  = new Date(nowMs - days * 2 * DAY_MS);

  const calcChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return parseFloat(((curr - prev) / prev * 100).toFixed(1));
  };

  // ── Follower counts — aggregation only, no row loading ────────────────────────
  const [totalFollowers, newFollowers, prevNewFollowers] = await Promise.all([
    prisma.userFollow.count({ where: { followingId: userId } }),
    prisma.userFollow.count({ where: { followingId: userId, createdAt: { gte: rangeStart } } }),
    prisma.userFollow.count({ where: { followingId: userId, createdAt: { gte: prevStart, lt: rangeStart } } }),
  ]);

  // ── Unfollow events ───────────────────────────────────────────────────────────
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [lostFollowers, prevLostFollowers] = await Promise.all([
    prisma.userUnfollowEvent.count({ where: { followingId: userId, createdAt: { gte: rangeStart } } }),
    prisma.userUnfollowEvent.count({ where: { followingId: userId, createdAt: { gte: prevStart, lt: rangeStart } } }),
  ]);

  const netGrowth = newFollowers - lostFollowers;

  // ── Recent followers — bounded (take 10 at DB level) ─────────────────────────
  const recentFollowersRaw = await prisma.userFollow.findMany({
    where: { followingId: userId },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      follower: {
        select: { id: true, name: true, handle: true, avatar: true, title: true },
      },
    },
  });

  const recentFollowers = recentFollowersRaw.map(f => ({
    id:         f.follower.id,
    name:       f.follower.name,
    handle:     f.follower.handle,
    avatar:     blobStorageService.resolveMediaUrl(f.follower.avatar),
    title:      f.follower.title || "",
    followedAt: f.createdAt.toISOString(),
  }));

  // ── Follower growth — SQL GROUP BY month, no in-memory aggregation ────────────
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const [gainedByMonth, lostByMonth] = await Promise.all([
    prisma.$queryRaw<{ month: Date; count: bigint }[]>`
      SELECT DATE_TRUNC('month', "createdAt") AS month, COUNT(*) AS count
      FROM "UserFollow"
      WHERE "followingId" = ${userId} AND "createdAt" >= ${sixMonthsAgo}
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY month ASC
    `,
    prisma.$queryRaw<{ month: Date; count: bigint }[]>`
      SELECT DATE_TRUNC('month', "createdAt") AS month, COUNT(*) AS count
      FROM "UserUnfollowEvent"
      WHERE "followingId" = ${userId} AND "createdAt" >= ${sixMonthsAgo}
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY month ASC
    `,
  ]);

  // Count followers before the 6-month window for cumulative baseline
  const baselineCount = await prisma.userFollow.count({
    where: { followingId: userId, createdAt: { lt: sixMonthsAgo } },
  });

  const gainMap = new Map(gainedByMonth.map(r => [r.month.toISOString().slice(0, 7), Number(r.count)]));
  const lostMap = new Map(lostByMonth.map(r => [r.month.toISOString().slice(0, 7), Number(r.count)]));

  let cumulative = baselineCount;
  const followerGrowth = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const key     = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const gained  = gainMap.get(key) ?? 0;
    const lost    = lostMap.get(key) ?? 0;
    cumulative    += gained - lost;
    return { month: MONTHS[d.getMonth()], gained, lost, net: gained - lost, cumulative: Math.max(0, cumulative) };
  });

  // ── Engaged followers — SQL JOIN + GROUP BY, bounded to top 8 ────────────────
  const engagedRows = await prisma.$queryRaw<{
    id: number; name: string; handle: string; avatar: string | null;
    title: string | null; engagements: bigint; is_follower: boolean;
  }[]>`
    SELECT
      u.id, u.name, u.handle, u.avatar, u.title,
      COUNT(*) AS engagements,
      EXISTS (
        SELECT 1 FROM "UserFollow" uf2
        WHERE uf2."followerId" = u.id AND uf2."followingId" = ${userId}
      ) AS is_follower
    FROM (
      SELECT pl."userId"
      FROM "PostLike" pl
      JOIN "Post" p ON p.id = pl."postId"
      WHERE p."userId" = ${userId} AND pl."createdAt" >= ${rangeStart}
      UNION ALL
      SELECT pc."userId"
      FROM "PostComment" pc
      JOIN "Post" p ON p.id = pc."postId"
      WHERE p."userId" = ${userId} AND pc."createdAt" >= ${rangeStart}
    ) events
    JOIN "User" u ON u.id = events."userId"
    GROUP BY u.id, u.name, u.handle, u.avatar, u.title
    ORDER BY engagements DESC
    LIMIT 8
  `;

  const engagedFollowers = engagedRows.map(r => ({
    id:          r.id,
    name:        r.name,
    handle:      r.handle,
    avatar:      blobStorageService.resolveMediaUrl(r.avatar),
    title:       r.title ?? "",
    engagements: Number(r.engagements),
    isFollower:  Boolean(r.is_follower),
  }));

  // Activity rate: % of followers who engaged at least once in range
  const activeFollowerCount = engagedRows.filter(r => r.is_follower).length;
  const activityRate = totalFollowers > 0
    ? parseFloat(((activeFollowerCount / totalFollowers) * 100).toFixed(1))
    : 0;

  // ── Top locations — SQL JOIN + GROUP BY ───────────────────────────────────────
  const locationRows = await prisma.$queryRaw<{ loc: string; count: bigint }[]>`
    SELECT
      COALESCE(u.city, u.country) AS loc,
      COUNT(*) AS count
    FROM "User" u
    JOIN "UserFollow" uf ON uf."followerId" = u.id
    WHERE uf."followingId" = ${userId}
      AND COALESCE(u.city, u.country) IS NOT NULL
    GROUP BY COALESCE(u.city, u.country)
    ORDER BY count DESC
    LIMIT 5
  `;

  const topLocations = locationRows.map(r => ({
    name:  r.loc,
    count: Number(r.count),
    pct:   totalFollowers > 0 ? Math.round((Number(r.count) / totalFollowers) * 100) : 0,
  }));

  // ── Top countries — SQL JOIN + GROUP BY, bounded to 20 ───────────────────────
  const countryRows = await prisma.$queryRaw<{
    code: string; country: string | null; count: bigint;
  }[]>`
    SELECT
      UPPER(u."countryCode") AS code,
      u.country,
      COUNT(*) AS count
    FROM "User" u
    JOIN "UserFollow" uf ON uf."followerId" = u.id
    WHERE uf."followingId" = ${userId}
      AND u."countryCode" IS NOT NULL
    GROUP BY UPPER(u."countryCode"), u.country
    ORDER BY count DESC
    LIMIT 20
  `;

  const topCountries = countryRows.map(r => ({
    name:  r.country ?? r.code,
    code:  r.code,
    count: Number(r.count),
    pct:   totalFollowers > 0 ? Math.round((Number(r.count) / totalFollowers) * 100) : 0,
  }));

  // ── Demographics — SQL JOIN + GROUP BY, no in-memory fan-out ─────────────────
  const [genderRows, ageRows, deviceRows] = await Promise.all([
    prisma.$queryRaw<{ gender: string; count: bigint }[]>`
      SELECT u.gender, COUNT(*) AS count
      FROM "User" u
      JOIN "UserFollow" uf ON uf."followerId" = u.id
      WHERE uf."followingId" = ${userId} AND u.gender IS NOT NULL
      GROUP BY u.gender
      ORDER BY count DESC
    `,
    prisma.$queryRaw<{ age_range: string; count: bigint }[]>`
      SELECT
        CASE
          WHEN (EXTRACT(YEAR FROM NOW()) - u."birthYear") BETWEEN 18 AND 24 THEN '18–24'
          WHEN (EXTRACT(YEAR FROM NOW()) - u."birthYear") BETWEEN 25 AND 34 THEN '25–34'
          WHEN (EXTRACT(YEAR FROM NOW()) - u."birthYear") BETWEEN 35 AND 44 THEN '35–44'
          WHEN (EXTRACT(YEAR FROM NOW()) - u."birthYear") BETWEEN 45 AND 54 THEN '45–54'
          WHEN (EXTRACT(YEAR FROM NOW()) - u."birthYear") >= 55              THEN '55+'
        END AS age_range,
        COUNT(*) AS count
      FROM "User" u
      JOIN "UserFollow" uf ON uf."followerId" = u.id
      WHERE uf."followingId" = ${userId}
        AND u."birthYear" IS NOT NULL
        AND (EXTRACT(YEAR FROM NOW()) - u."birthYear") BETWEEN 18 AND 120
      GROUP BY age_range
      ORDER BY count DESC
    `,
    prisma.$queryRaw<{ device: string; count: bigint }[]>`
      SELECT pi.device, COUNT(*) AS count
      FROM "PostImpression" pi
      JOIN "Post" p ON p.id = pi."postId"
      WHERE p."userId" = ${userId} AND pi.device IS NOT NULL
      GROUP BY pi.device
      ORDER BY count DESC
    `,
  ]);

  const genderTotal = genderRows.reduce((s, r) => s + Number(r.count), 0);
  const genderSplit = genderRows.map(r => ({
    label: r.gender === "male" ? "Male" : r.gender === "female" ? "Female" : r.gender === "nonbinary" ? "Non-binary" : "Other",
    count: Number(r.count),
    pct:   genderTotal > 0 ? Math.round((Number(r.count) / genderTotal) * 100) : 0,
  }));

  const ageOrder   = ["18–24","25–34","35–44","45–54","55+"];
  const ageTotal   = ageRows.reduce((s, r) => s + Number(r.count), 0);
  const ageMap     = new Map(ageRows.map(r => [r.age_range, Number(r.count)]));
  const ageRanges  = ageOrder.map(range => ({
    range,
    count: ageMap.get(range) ?? 0,
    pct:   ageTotal > 0 ? Math.round(((ageMap.get(range) ?? 0) / ageTotal) * 100) : 0,
  }));

  const deviceTotal = deviceRows.reduce((s, r) => s + Number(r.count), 0);
  const devices     = deviceRows.map(r => ({
    label: r.device,
    count: Number(r.count),
    pct:   deviceTotal > 0 ? Math.round((Number(r.count) / deviceTotal) * 100) : 0,
  }));

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
