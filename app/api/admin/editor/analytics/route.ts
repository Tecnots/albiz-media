import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";
import { blobStorageService } from "@/lib/blob-storage";

const MAX_DAYS = 365;
const SLA_HOURS = 48;

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (authUser.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const daysParam = searchParams.get("days");
  const isAllTime = !daysParam || daysParam === "all";
  const days = isAllTime ? MAX_DAYS : Math.min(Math.max(1, parseInt(daysParam) || 30), MAX_DAYS);

  const rangeStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const slaThreshold = new Date(Date.now() - SLA_HOURS * 60 * 60 * 1000);

  const [
    pendingCount,
    inReviewCount,
    approvedCount,
    revisionsCount,
    publishedCount,
    rejectedCount,
    slaBreachCount,
    noteCount,
    dailyActivityRows,
    actionBreakdownRows,
    noteTypeRows,
    notePriorityRows,
    editorLeaderboardRows,
    oldestPendingRows,
    recentActivityRows,
  ] = await Promise.all([
    // Live queue state — not time-bounded
    prisma.$queryRaw<[{ c: bigint }]>`
      SELECT COUNT(*) AS c FROM "Post" WHERE status = 'submitted'
    `.then((r: [{ c: bigint }]) => Number(r[0].c)),

    prisma.$queryRaw<[{ c: bigint }]>`
      SELECT COUNT(*) AS c FROM "Post" WHERE status = 'in_review'
    `.then((r: [{ c: bigint }]) => Number(r[0].c)),

    // Period workflow counts from EditorActivity
    prisma.$queryRaw<[{ c: bigint }]>`
      SELECT COUNT(*) AS c FROM "EditorActivity"
      WHERE action = 'approved' AND "createdAt" >= ${rangeStart}
    `.then((r: [{ c: bigint }]) => Number(r[0].c)),

    prisma.$queryRaw<[{ c: bigint }]>`
      SELECT COUNT(*) AS c FROM "EditorActivity"
      WHERE action = 'revision_requested' AND "createdAt" >= ${rangeStart}
    `.then((r: [{ c: bigint }]) => Number(r[0].c)),

    prisma.$queryRaw<[{ c: bigint }]>`
      SELECT COUNT(*) AS c FROM "EditorActivity"
      WHERE action = 'published' AND "createdAt" >= ${rangeStart}
    `.then((r: [{ c: bigint }]) => Number(r[0].c)),

    prisma.$queryRaw<[{ c: bigint }]>`
      SELECT COUNT(*) AS c FROM "EditorActivity"
      WHERE action = 'rejected' AND "createdAt" >= ${rangeStart}
    `.then((r: [{ c: bigint }]) => Number(r[0].c)),

    // SLA: posts stuck in queue for over 48h without editor action
    prisma.$queryRaw<[{ c: bigint }]>`
      SELECT COUNT(*) AS c FROM "Post"
      WHERE status IN ('submitted', 'in_review') AND "createdAt" < ${slaThreshold}
    `.then((r: [{ c: bigint }]) => Number(r[0].c)),

    // Editor notes written in period
    prisma.$queryRaw<[{ c: bigint }]>`
      SELECT COUNT(*) AS c FROM "EditorNote" WHERE "createdAt" >= ${rangeStart}
    `.then((r: [{ c: bigint }]) => Number(r[0].c)),

    // Daily activity time series — group by calendar day
    prisma.$queryRaw<{ day: Date; approved: bigint; revisions: bigint; published: bigint; total: bigint }[]>`
      SELECT
        DATE_TRUNC('day', "createdAt") AS day,
        SUM(CASE WHEN action = 'approved'            THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN action = 'revision_requested'  THEN 1 ELSE 0 END) AS revisions,
        SUM(CASE WHEN action = 'published'           THEN 1 ELSE 0 END) AS published,
        COUNT(*) AS total
      FROM "EditorActivity"
      WHERE "createdAt" >= ${rangeStart} AND action <> 'note_added'
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY day ASC
    `,

    // Action distribution for the period
    prisma.$queryRaw<{ action: string; count: bigint }[]>`
      SELECT action, COUNT(*) AS count
      FROM "EditorActivity"
      WHERE "createdAt" >= ${rangeStart}
      GROUP BY action
      ORDER BY count DESC
      LIMIT 10
    `,

    // Note type breakdown
    prisma.$queryRaw<{ type: string; count: bigint }[]>`
      SELECT type, COUNT(*) AS count
      FROM "EditorNote"
      WHERE "createdAt" >= ${rangeStart}
      GROUP BY type
      ORDER BY count DESC
      LIMIT 10
    `,

    // Note priority breakdown
    prisma.$queryRaw<{ priority: string; count: bigint }[]>`
      SELECT priority, COUNT(*) AS count
      FROM "EditorNote"
      WHERE "createdAt" >= ${rangeStart}
      GROUP BY priority
      ORDER BY count DESC
    `,

    // Editor output leaderboard — one row per editor
    prisma.$queryRaw<{
      editorId: number;
      name: string;
      handle: string;
      avatar: string | null;
      approved: bigint;
      revisions: bigint;
      published: bigint;
      total: bigint;
    }[]>`
      SELECT
        ea."editorId",
        u.name,
        u.handle,
        u.avatar,
        SUM(CASE WHEN ea.action = 'approved'           THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN ea.action = 'revision_requested' THEN 1 ELSE 0 END) AS revisions,
        SUM(CASE WHEN ea.action = 'published'          THEN 1 ELSE 0 END) AS published,
        SUM(CASE WHEN ea.action NOT IN ('note_added', 'assigned') THEN 1 ELSE 0 END) AS total
      FROM "EditorActivity" ea
      JOIN "User" u ON u.id = ea."editorId"
      WHERE ea."createdAt" >= ${rangeStart}
      GROUP BY ea."editorId", u.name, u.handle, u.avatar
      ORDER BY total DESC
      LIMIT 10
    `,

    // Oldest articles still waiting for editorial action
    prisma.$queryRaw<{
      id: number;
      title: string | null;
      status: string;
      createdAt: Date;
      authorName: string;
      sectionName: string | null;
    }[]>`
      SELECT
        p.id,
        p.title,
        p.status,
        p."createdAt",
        u.name          AS "authorName",
        s.name          AS "sectionName"
      FROM "Post" p
      JOIN "User" u ON u.id = p."userId"
      LEFT JOIN "ArticleSection" s ON s.id = p."sectionId"
      WHERE p.status IN ('submitted', 'in_review')
      ORDER BY p."createdAt" ASC
      LIMIT 10
    `,

    // Recent editorial actions across all editors
    prisma.$queryRaw<{
      id: number;
      action: string;
      createdAt: Date;
      editorName: string;
      editorHandle: string;
      postId: number;
      postTitle: string | null;
    }[]>`
      SELECT
        ea.id,
        ea.action,
        ea."createdAt",
        u.name   AS "editorName",
        u.handle AS "editorHandle",
        p.id     AS "postId",
        p.title  AS "postTitle"
      FROM "EditorActivity" ea
      JOIN "User" u ON u.id = ea."editorId"
      JOIN "Post" p ON p.id = ea."postId"
      WHERE ea.action <> 'note_added'
      ORDER BY ea."createdAt" DESC
      LIMIT 15
    `,
  ]);

  // Derived rates
  const decisioned = approvedCount + rejectedCount;
  const approvalRate = decisioned > 0
    ? Math.round((approvedCount / decisioned) * 1000) / 10
    : 0;
  const totalProcessed = approvedCount + rejectedCount + revisionsCount + publishedCount;
  const backlogSize = pendingCount + inReviewCount;

  // Build a filled daily series for the selected range (capped at 90 visible points)
  const seriesDays = Math.min(days, 90);
  const today = new Date();
  const filledDays = Array.from({ length: seriesDays }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (seriesDays - 1 - i));
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });

  const dayMap = new Map<string, { approved: number; revisions: number; published: number; total: number }>();
  for (const row of dailyActivityRows) {
    const label = new Date(row.day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    dayMap.set(label, {
      approved:  Number(row.approved),
      revisions: Number(row.revisions),
      published: Number(row.published),
      total:     Number(row.total),
    });
  }

  const dailyActivity = filledDays.map(date => ({
    date,
    approved:  dayMap.get(date)?.approved  ?? 0,
    revisions: dayMap.get(date)?.revisions ?? 0,
    published: dayMap.get(date)?.published ?? 0,
    total:     dayMap.get(date)?.total     ?? 0,
  }));

  // Action breakdown with percentages
  const totalActionCount = actionBreakdownRows.reduce((s, r) => s + Number(r.count), 0);
  const actionBreakdown = actionBreakdownRows.map((r: { action: string; count: bigint }) => ({
    action: r.action,
    count:  Number(r.count),
    pct:    totalActionCount > 0
      ? Math.round((Number(r.count) / totalActionCount) * 1000) / 10
      : 0,
  }));

  const nowMs = Date.now();

  return NextResponse.json({
    kpis: {
      pendingReview:  pendingCount,
      inReview:       inReviewCount,
      approved:       approvedCount,
      revisions:      revisionsCount,
      published:      publishedCount,
      rejected:       rejectedCount,
      totalProcessed,
      approvalRate,
      backlogSize,
      slaBreaches:    slaBreachCount,
      noteCount,
    },
    dailyActivity,
    actionBreakdown,
    noteTypes: noteTypeRows.map((r: { type: string; count: bigint }) => ({
      type:  r.type,
      count: Number(r.count),
    })),
    notePriorities: notePriorityRows.map((r: { priority: string; count: bigint }) => ({
      priority: r.priority,
      count:    Number(r.count),
    })),
    editorLeaderboard: editorLeaderboardRows.map(r => ({
      editorId:  r.editorId,
      name:      r.name,
      handle:    r.handle,
      avatar:    blobStorageService.resolveMediaUrl(r.avatar ?? null),
      approved:  Number(r.approved),
      revisions: Number(r.revisions),
      published: Number(r.published),
      total:     Number(r.total),
    })),
    oldestPending: oldestPendingRows.map(r => ({
      id:           r.id,
      title:        r.title ?? "Untitled",
      status:       r.status,
      createdAt:    r.createdAt,
      authorName:   r.authorName,
      sectionName:  r.sectionName ?? null,
      hoursWaiting: Math.round((nowMs - new Date(r.createdAt).getTime()) / (1000 * 60 * 60) * 10) / 10,
    })),
    recentActivity: recentActivityRows.map(r => ({
      id:           r.id,
      action:       r.action,
      createdAt:    r.createdAt,
      editorName:   r.editorName,
      editorHandle: r.editorHandle,
      postId:       r.postId,
      postTitle:    r.postTitle ?? "Untitled",
    })),
  });
}
