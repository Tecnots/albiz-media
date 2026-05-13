import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const now = new Date();
    const h24Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const d7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // ── Core counts ────────────────────────────────────────────────────────
    const [
      totalUsers,
      totalPosts,
      activeUsers24h,
      newSignups7d,
      circleMembers,
      pendingApprovals,
      flaggedContent,
      articlesPublished,
      activeConversations,
      totalComments,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.post.count(),
      prisma.user.count({ where: { lastSeenAt: { gte: h24Ago } } }),
      prisma.user.count({ where: { emailVerified: { gte: d7Ago } } }),
      prisma.user.count({ where: { role: "CIRCLE" } }),
      prisma.circleUpgradeRequest.count({ where: { status: "PENDING" } }),
      prisma.post.count({ where: { status: "flagged" } }),
      prisma.post.count({ where: { type: "ARTICLE", status: { not: "flagged" } } }),
      prisma.conversation.count(),
      prisma.postComment.count(),
    ]);

    // ── Recent Activity from ActivityLog ────────────────────────────────────
    let rawLogs: any[] = [];
    try {
      const activityLogModel = (prisma as any).activityLog;
      if (activityLogModel && typeof activityLogModel.findMany === "function") {
        rawLogs = await activityLogModel.findMany({
          take: 30,
          orderBy: { createdAt: "desc" },
        });
      }
    } catch (logErr) {
      console.warn("[admin/dashboard] ActivityLog not available:", logErr);
    }

    const actionLabel: Record<string, string> = {
      SIGNUP: "signed up",
      SIGNIN: "signed in",
      DEACTIVATE: "deactivated their account",
      REACTIVATE: "reactivated their account",
      DELETE_ACCOUNT: "deleted their account",
      CIRCLE_REQUEST: "requested Circle access",
      CIRCLE_APPROVED: "was approved for Circle",
      CIRCLE_REJECTED: "was rejected from Circle",
      BAN: "was banned",
      UNBAN: "was unbanned",
    };

    const recentActivity = rawLogs.map((log: any) => ({
      id: `log-${log.id}`,
      userName: log.userName ?? "Unknown",
      handle: log.handle ?? "",
      avatar: log.avatar ?? "",
      action: actionLabel[log.eventType] ?? log.eventType,
      actionType: log.eventType.toLowerCase(),
      meta: log.meta,
      time: formatRelative(log.createdAt),
    }));

    return NextResponse.json({
      stats: { totalUsers, totalPosts, activeUsers24h, newSignups7d },
      quickStats: {
        circleMembers,
        pendingApprovals,
        flaggedContent,
        articlesPublished,
        activeConversations,
        totalComments,
      },
      recentActivity,
    });
  } catch (err) {
    console.error("[admin/dashboard] Error:", err);
    return NextResponse.json(
      { error: "Failed to load dashboard data", detail: String(err) },
      { status: 500 }
    );
  }
}

function formatRelative(date: Date): string {
  if (!date) return "recently";
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
