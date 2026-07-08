import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";
import { blobStorageService } from "@/lib/blob-storage";

const MAX_DAYS = 365;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = authUser.id;
  const { id } = await params;
  const postId = parseInt(id);
  if (isNaN(postId)) return NextResponse.json({ error: "Invalid post id" }, { status: 400 });

  const post = await prisma.post.findFirst({ where: { id: postId, userId } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const daysParam = searchParams.get("days");
  const days = Math.min(
    daysParam && daysParam !== "all" ? Math.max(1, parseInt(daysParam) || 30) : 90,
    MAX_DAYS
  );
  const tzOffsetMin = Math.max(-720, Math.min(720, parseInt(searchParams.get("tz") || "0")));
  const tzOffsetMs = tzOffsetMin * 60 * 1000;

  const nowMs = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  // ── Aggregate counts — no row loading ─────────────────────────────────────────
  const [viewCount, likeCount, commentCount, shareCount] = await Promise.all([
    prisma.postImpression.count({ where: { postId } }),
    prisma.postLike.count({ where: { postId } }),
    prisma.postComment.count({ where: { postId } }),
    prisma.postShareEvent.count({ where: { postId } }),
  ]);

  const engagementRate = parseFloat(
    ((likeCount + commentCount) / (viewCount || 1) * 100).toFixed(1)
  );

  // ── Algorithm signals from aggregation ────────────────────────────────────────
  const [dwellAgg, scrollCount, followCount] = await Promise.all([
    prisma.postEngagement.aggregate({
      where: { postId, action: "dwell" },
      _avg: { value: true },
      _count: true,
    }),
    prisma.postEngagement.count({ where: { postId, action: "scroll_past" } }),
    prisma.postEngagement.count({ where: { postId, action: "follow_author" } }),
  ]);

  const avgDwell = parseFloat((dwellAgg._avg.value ?? 0).toFixed(1));
  const scrollPastRate = parseFloat((scrollCount / (viewCount || 1) * 100).toFixed(1));
  const followThroughRate = parseFloat((followCount / (viewCount || 1) * 100).toFixed(1));

  // ── Audience breakdown via SQL JOIN — no individual row loading ────────────────
  const audienceRows = await prisma.$queryRaw<{ is_circle: boolean; views: bigint; likes: bigint }[]>`
    SELECT
      (u.role = 'CIRCLE') AS is_circle,
      COUNT(DISTINCT pi.id) AS views,
      COUNT(DISTINCT pl.id) AS likes
    FROM "PostImpression" pi
    LEFT JOIN "User" u ON u.id = pi."userId"
    LEFT JOIN "PostLike" pl
      ON pl."postId" = pi."postId" AND pl."userId" = pi."userId"
    WHERE pi."postId" = ${postId}
    GROUP BY (u.role = 'CIRCLE')
  `;

  const circleRow = audienceRows.find(r => r.is_circle);
  const normalRow = audienceRows.find(r => !r.is_circle);
  const circleViews = Number(circleRow?.views ?? 0);
  const normalViews = Number(normalRow?.views ?? 0);
  const circleLikes = Number(circleRow?.likes ?? 0);
  const normalLikes = Number(normalRow?.likes ?? 0);

  // ── Time series — bounded SQL GROUP BY, no in-memory filtering ────────────────
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const localDayIdx     = (utcMs: number) => Math.floor((utcMs + tzOffsetMs) / DAY_MS);
  const localDayToUtcMs = (idx: number)   => idx * DAY_MS - tzOffsetMs;
  const todayLocalIdx   = localDayIdx(nowMs);
  const bucketCount     = Math.min(days, 90);

  const seriesStart = new Date(nowMs - bucketCount * DAY_MS);

  const viewsByDay = await prisma.$queryRaw<{ day: string; count: bigint }[]>`
    SELECT
      TO_CHAR(
        DATE_TRUNC('day', "seenAt" AT TIME ZONE 'UTC'
          + (${tzOffsetMs / 1000}::numeric * INTERVAL '1 second')),
        'YYYY-MM-DD'
      ) AS day,
      COUNT(*) AS count
    FROM "PostImpression"
    WHERE "postId" = ${postId}
      AND "seenAt" >= ${seriesStart}
    GROUP BY day
    ORDER BY day
  `;

  const viewDayMap = new Map(viewsByDay.map(r => [r.day, Number(r.count)]));

  const timeSeries = Array.from({ length: bucketCount }, (_, i) => {
    const endLocalIdx   = todayLocalIdx + 1 - (bucketCount - 1 - i);
    const startLocalIdx = endLocalIdx - 1;
    const utcMs = localDayToUtcMs(startLocalIdx);
    const d     = new Date(utcMs + tzOffsetMs);
    const key   = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    return {
      date:  `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`,
      views: viewDayMap.get(key) ?? 0,
    };
  });

  // ── Feed position distribution — SQL GROUP BY ──────────────────────────────────
  const [positionBuckets, avgPositionRow] = await Promise.all([
    prisma.$queryRaw<{ bucket: string; count: bigint }[]>`
      SELECT
        CASE
          WHEN position BETWEEN 1  AND 3  THEN '1-3'
          WHEN position BETWEEN 4  AND 6  THEN '4-6'
          WHEN position BETWEEN 7  AND 10 THEN '7-10'
          WHEN position > 10               THEN '11+'
        END AS bucket,
        COUNT(*) AS count
      FROM "PostImpression"
      WHERE "postId" = ${postId}
        AND position IS NOT NULL
      GROUP BY bucket
    `,
    prisma.$queryRaw<{ avg: number | null }[]>`
      SELECT AVG(position::float) AS avg
      FROM "PostImpression"
      WHERE "postId" = ${postId} AND position IS NOT NULL
    `,
  ]);

  const avgPosition = avgPositionRow[0]?.avg
    ? parseFloat(Number(avgPositionRow[0].avg).toFixed(1))
    : 0;

  const positionOrder = ["1-3", "4-6", "7-10", "11+"];
  const positionMap = new Map(positionBuckets.map(r => [r.bucket, Number(r.count)]));
  const distribution = positionOrder.map(label => ({
    label,
    count: positionMap.get(label) ?? 0,
  }));

  return NextResponse.json({
    post: {
      id:    post.id,
      title: post.title,
      image: blobStorageService.resolveMediaUrl(post.image),
      type:  post.type,
      date:  post.createdAt.toISOString(),
    },
    stats: { views: viewCount, likes: likeCount, comments: commentCount, shares: shareCount, engagementRate },
    audience: { circleViews, normalViews, circleLikes, normalLikes },
    algorithmSignals: { avgDwell, scrollPastRate, followThroughRate, engagementRate },
    timeSeries,
    feedPosition: { avgPosition, distribution },
  });
}
