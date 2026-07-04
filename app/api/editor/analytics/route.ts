import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";

function periodStart(period: string): Date | null {
  const map: Record<string, number> = { "1d": 1, "7d": 7, "30d": 30, "90d": 90, "365d": 365 };
  const days = map[period];
  return days ? new Date(Date.now() - days * 86_400_000) : null;
}

function dayLabel(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (authUser.role !== "EDITOR" && authUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const period = req.nextUrl.searchParams.get("period") ?? "30d";
  const rangeStart = periodStart(period);
  const days = period === "1d" ? 1 : period === "7d" ? 7 : period === "90d" ? 90 : period === "365d" ? 365 : 30;

  const actWhere = {
    editorId: authUser.id,
    ...(rangeStart ? { createdAt: { gte: rangeStart } } : {}),
  };
  const noteWhere = {
    editorId: authUser.id,
    ...(rangeStart ? { createdAt: { gte: rangeStart } } : {}),
  };

  const assignments = await prisma.editorSectionAssignment.findMany({
    where: { editorId: authUser.id },
    select: { sectionId: true },
  });
  const sectionIds = assignments.map(a => a.sectionId);

  const [activities, notes, allActivities, pendingCount, inReviewCount] = await Promise.all([
    prisma.editorActivity.findMany({
      where: actWhere,
      select: { id: true, action: true, createdAt: true, postId: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.editorNote.findMany({
      where: noteWhere,
      select: { id: true, type: true, priority: true, createdAt: true, postId: true },
    }),
    prisma.editorActivity.findMany({
      where: { editorId: authUser.id },
      select: { action: true, createdAt: true },
    }),
    sectionIds.length > 0 ? prisma.post.count({
      where: {
        sectionId: { in: sectionIds },
        assignedEditorId: authUser.id,
        status: { in: ["submitted", "under_review", "revision_requested"] },
        type: "ARTICLE",
      },
    }) : Promise.resolve(0),
    sectionIds.length > 0 ? prisma.post.count({
      where: {
        sectionId: { in: sectionIds },
        assignedEditorId: authUser.id,
        status: "under_review",
        type: "ARTICLE",
      },
    }) : Promise.resolve(0),
  ]);

  const count = (action: string) =>
    activities.filter(a => a.action === action).length;

  const approved   = count("approved");
  const revisions  = count("revision_requested");
  const published  = count("published");
  const rejected   = count("rejected");
  const assigned   = count("assigned");
  const allTime_approved  = allActivities.filter(a => a.action === "approved").length;
  const allTime_published = allActivities.filter(a => a.action === "published").length;
  const allTime_rejected  = allActivities.filter(a => a.action === "rejected").length;
  const totalDecisioned = allTime_approved + allTime_rejected;
  const approvalRate = totalDecisioned > 0
    ? Math.round((allTime_approved / totalDecisioned) * 1000) / 10
    : 0;

  // Daily time series
  const seriesDays = Math.min(days, 90);
  const today = new Date();
  const dateLabels = Array.from({ length: seriesDays }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (seriesDays - 1 - i));
    return dayLabel(d);
  });

  type DayEntry = { approved: number; revisions: number; published: number; total: number };
  const dayMap = new Map<string, DayEntry>();
  for (const a of activities) {
    if (a.action === "note_added") continue;
    const label = dayLabel(new Date(a.createdAt));
    const prev = dayMap.get(label) ?? { approved: 0, revisions: 0, published: 0, total: 0 };
    dayMap.set(label, {
      approved:  prev.approved  + (a.action === "approved"           ? 1 : 0),
      revisions: prev.revisions + (a.action === "revision_requested" ? 1 : 0),
      published: prev.published + (a.action === "published"          ? 1 : 0),
      total:     prev.total     + 1,
    });
  }
  const dailySeries = dateLabels.map(date => ({
    date,
    ...(dayMap.get(date) ?? { approved: 0, revisions: 0, published: 0, total: 0 }),
  }));

  // Action breakdown
  const actionMap = new Map<string, number>();
  for (const a of activities) {
    actionMap.set(a.action, (actionMap.get(a.action) ?? 0) + 1);
  }
  const totalActions = activities.length;
  const actionBreakdown = [...actionMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([action, count]) => ({
      action,
      count,
      pct: totalActions > 0 ? Math.round((count / totalActions) * 1000) / 10 : 0,
    }));

  // Note type breakdown
  const noteTypeMap = new Map<string, number>();
  for (const n of notes) noteTypeMap.set(n.type, (noteTypeMap.get(n.type) ?? 0) + 1);
  const noteTypes = [...noteTypeMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count }));

  // Recent activity with post titles
  const recentIds = activities.slice(0, 15).map(a => a.postId);
  const recentPosts = await prisma.post.findMany({
    where: { id: { in: recentIds } },
    select: { id: true, title: true, status: true },
  });
  const postMap = new Map(recentPosts.map(p => [p.id, p]));
  const recentActivity = activities.slice(0, 15).map(a => ({
    id:        a.id,
    action:    a.action,
    createdAt: a.createdAt.toISOString(),
    postId:    a.postId,
    postTitle: postMap.get(a.postId)?.title ?? "Untitled",
    postStatus: postMap.get(a.postId)?.status ?? "",
  }));

  return NextResponse.json({
    kpis: {
      periodApproved:  approved,
      periodRevisions: revisions,
      periodPublished: published,
      periodRejected:  rejected,
      periodAssigned:  assigned,
      periodNotes:     notes.length,
      allTimeApproved: allTime_approved,
      allTimePublished:allTime_published,
      approvalRate,
      pendingQueue:    pendingCount,
      myQueue:         inReviewCount,
    },
    dailySeries,
    actionBreakdown,
    noteTypes,
    recentActivity,
  });
}