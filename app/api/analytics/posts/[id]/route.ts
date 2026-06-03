import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = authUser.id;
  const { id } = await params;
  const postId = parseInt(id);

  if (isNaN(postId)) {
    return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
  }

  const post = await prisma.post.findFirst({ where: { id: postId, userId } });
  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const daysParam = searchParams.get("days");
  const days      = daysParam && daysParam !== "all" ? parseInt(daysParam) : 30;
  const isAllTime = !daysParam || daysParam === "all";

  const tzOffsetMin = parseInt(searchParams.get("tz") || "0");
  const tzOffsetMs  = tzOffsetMin * 60 * 1000;

  const nowMs   = Date.now();
  const DAY_MS  = 24 * 60 * 60 * 1000;
  const rangeMs = isAllTime ? nowMs : days * DAY_MS;
  const rangeStart = new Date(nowMs - rangeMs);
  const rangeDays  = days;

  const localDayIdx      = (utcMs: number) => Math.floor((utcMs + tzOffsetMs) / DAY_MS);
  const localDayToUtcMs  = (idx: number)   => idx * DAY_MS - tzOffsetMs;

  const [impressions, likes, comments, shares, engagements] = await Promise.all([
    prisma.postImpression.findMany({
      where: { postId },
      select: { seenAt: true, userId: true, position: true },
    }),
    prisma.postLike.findMany({
      where: { postId },
      select: { createdAt: true, userId: true },
    }),
    prisma.postComment.findMany({
      where: { postId },
      select: { createdAt: true, userId: true },
    }),
    prisma.postShareEvent.findMany({
      where: { postId },
      select: { createdAt: true },
    }),
    prisma.postEngagement.findMany({
      where: { postId },
      select: { action: true, value: true },
    }),
  ]);

  // ── Algorithm signals ─────────────────────────────────────────────────────────
  const dwellEvents = engagements.filter(e => e.action === "dwell");
  const avgDwell = dwellEvents.length > 0
    ? parseFloat((dwellEvents.reduce((s, e) => s + e.value, 0) / dwellEvents.length).toFixed(1))
    : 0;

  const impressionCount = impressions.length || 1;

  const scrollPastRate = parseFloat(
    (engagements.filter(e => e.action === "scroll_past").length / impressionCount * 100).toFixed(1)
  );
  const followThroughRate = parseFloat(
    (engagements.filter(e => e.action === "follow_author").length / impressionCount * 100).toFixed(1)
  );
  const engagementRate = parseFloat(
    ((likes.length + comments.length) / (impressions.length || 1) * 100).toFixed(1)
  );

  // ── Audience breakdown ────────────────────────────────────────────────────────
  const audienceIds = Array.from(new Set([
    ...impressions.map(e => e.userId),
    ...likes.map(e => e.userId),
  ])) as number[];

  const audienceUsers = audienceIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: audienceIds } }, select: { id: true, role: true } })
    : [];

  const roleMap = new Map(audienceUsers.map(u => [u.id, u.role as string]));
  const isCircle = (uid: number) => roleMap.get(uid) === "CIRCLE";

  const circleViews  = impressions.filter(e => isCircle(e.userId)).length;
  const normalViews  = impressions.filter(e => !isCircle(e.userId)).length;
  const circleLikes  = likes.filter(e => isCircle(e.userId)).length;
  const normalLikes  = likes.filter(e => !isCircle(e.userId)).length;

  // ── Time series ───────────────────────────────────────────────────────────────
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const fmtLocalDay = (utcMs: number) => {
    const d = new Date(utcMs + tzOffsetMs);
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  };
  const fmtLocalMonth = (utcMs: number) => {
    const d = new Date(utcMs + tzOffsetMs);
    return `${MONTHS[d.getUTCMonth()]} '${String(d.getUTCFullYear()).slice(2)}`;
  };

  let bucketDays: number;
  let bucketCount: number;
  let fmtBucket: (utcMs: number) => string;

  if (rangeDays <= 30) {
    bucketDays  = 1;
    bucketCount = isAllTime ? 30 : rangeDays;
    fmtBucket   = fmtLocalDay;
  } else if (rangeDays <= 90) {
    bucketDays  = 7;
    bucketCount = Math.ceil(rangeDays / 7);
    fmtBucket   = fmtLocalDay;
  } else {
    bucketDays  = 30;
    bucketCount = Math.ceil(rangeDays / 30);
    fmtBucket   = fmtLocalMonth;
  }
  bucketCount = Math.min(bucketCount, 60);

  const todayLocalIdx = localDayIdx(nowMs);

  const timeSeries = Array.from({ length: bucketCount }, (_, i) => {
    const endLocalIdx   = todayLocalIdx + 1 - (bucketCount - 1 - i) * bucketDays;
    const startLocalIdx = endLocalIdx - bucketDays;

    const bucketStartUtc = localDayToUtcMs(startLocalIdx);
    const bucketEndUtc   = localDayToUtcMs(endLocalIdx);

    const bucketStart = new Date(bucketStartUtc);
    const bucketEnd   = new Date(bucketEndUtc);

    const views = impressions.filter(e => e.seenAt >= bucketStart && e.seenAt < bucketEnd).length;

    return { date: fmtBucket(bucketStartUtc), views };
  });

  // ── Feed position ─────────────────────────────────────────────────────────────
  const positioned = impressions.filter(e => e.position !== null) as { seenAt: Date; userId: number; position: number }[];

  const avgPosition = positioned.length > 0
    ? parseFloat((positioned.reduce((s, e) => s + e.position, 0) / positioned.length).toFixed(1))
    : 0;

  const posBuckets = [
    { label: "1-3",  min: 1,  max: 3  },
    { label: "4-6",  min: 4,  max: 6  },
    { label: "7-10", min: 7,  max: 10 },
    { label: "11+",  min: 11, max: Infinity },
  ];

  const distribution = posBuckets.map(b => ({
    label: b.label,
    count: positioned.filter(e => e.position >= b.min && e.position <= b.max).length,
  }));

  return NextResponse.json({
    post: {
      id:    post.id,
      title: post.title,
      image: post.image,
      type:  post.type,
      date:  post.createdAt.toISOString(),
    },
    stats: {
      views:          impressions.length,
      likes:          likes.length,
      comments:       comments.length,
      shares:         shares.length,
      engagementRate,
    },
    audience: { circleViews, normalViews, circleLikes, normalLikes },
    algorithmSignals: { avgDwell, scrollPastRate, followThroughRate, engagementRate },
    timeSeries,
    feedPosition: { avgPosition, distribution },
  });
}
