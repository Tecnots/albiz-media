import Image from "next/image";
import { AdminStatCard, AdminChart } from "./admin-components";
import { platformActivityData } from "./admin-data";
import { prisma } from "@/lib/prisma";

interface ActivityItem {
  id: string;
  userName: string;
  handle: string;
  avatar: string;
  action: string;
  actionType: string;
  meta?: string | null;
  time: string;
}

interface DashboardData {
  stats: {
    totalUsers: number;
    totalPosts: number;
    activeUsers24h: number;
    newSignups7d: number;
  };
  quickStats: {
    circleMembers: number;
    pendingApprovals: number;
    flaggedContent: number;
    articlesPublished: number;
    activeConversations: number;
    totalComments: number;
  };
  recentActivity: ActivityItem[];
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(".0", "")}k`;
  return n.toString();
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

// Badge config per event type
const eventBadge: Record<string, { label: string; color: string; bg: string }> = {
  SIGNUP:          { label: "Signup",    color: "#16a34a", bg: "#dcfce7" },
  SIGNIN:          { label: "Login",     color: "#2563eb", bg: "#dbeafe" },
  DEACTIVATE:      { label: "Deactivate", color: "#d97706", bg: "#fef3c7" },
  REACTIVATE:      { label: "Reactivate", color: "#059669", bg: "#d1fae5" },
  DELETE_ACCOUNT:  { label: "Deleted",   color: "#dc2626", bg: "#fee2e2" },
  CIRCLE_REQUEST:  { label: "Circle Request", color: "#7c3aed", bg: "#ede9fe" },
  CIRCLE_APPROVED: { label: "Approved",  color: "#16a34a", bg: "#dcfce7" },
  CIRCLE_REJECTED: { label: "Rejected",  color: "#dc2626", bg: "#fee2e2" },
  BAN:             { label: "Banned",    color: "#dc2626", bg: "#fee2e2" },
  UNBAN:           { label: "Unbanned",  color: "#525252", bg: "#f5f5f5" },
};

async function getDashboardData(): Promise<DashboardData | null> {
  try {
    const now = new Date();
    const h24Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const d7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

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

    // Activity log — separate query so a missing model doesn't crash the whole dashboard
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
      console.warn("[AdminDashboard] ActivityLog not available yet:", logErr);
    }

    const recentActivity: ActivityItem[] = rawLogs.map((log: any) => ({
      id: `log-${log.id}`,
      userName: log.userName ?? "Unknown",
      handle: log.handle ?? "",
      avatar: log.avatar ?? "",
      action: actionLabel[log.eventType] ?? log.eventType.toLowerCase().replace(/_/g, " "),
      actionType: log.eventType,
      meta: log.meta,
      time: formatRelative(log.createdAt),
    }));

    return {
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
    };
  } catch (err) {
    console.error("[AdminDashboard] DB error:", err);
    return null;
  }
}

export default async function AdminDashboard() {
  const data = await getDashboardData();

  const statCards = data
    ? [
        { label: "Total Users", value: fmt(data.stats.totalUsers), change: 0, up: true, sparkline: [80, 85, 82, 90, 88, 95, 92, 100, 98, 108, 105, 115] },
        { label: "Total Posts", value: fmt(data.stats.totalPosts), change: 0, up: true, sparkline: [40, 45, 42, 50, 55, 52, 60, 58, 65, 70, 68, 78] },
        { label: "Active Users (24h)", value: fmt(data.stats.activeUsers24h), change: 0, up: true, sparkline: [60, 58, 62, 55, 59, 63, 57, 61, 64, 60, 62, 65] },
        { label: "New Signups (7d)", value: fmt(data.stats.newSignups7d), change: 0, up: true, sparkline: [15, 20, 18, 25, 22, 30, 28, 35, 32, 40, 38, 45] },
      ]
    : [];

  const quickStatsList = data
    ? [
        { label: "Circle Members", value: fmt(data.quickStats.circleMembers) },
        { label: "Pending Approvals", value: fmt(data.quickStats.pendingApprovals), warn: data.quickStats.pendingApprovals > 0 },
        { label: "Flagged Content", value: fmt(data.quickStats.flaggedContent), danger: data.quickStats.flaggedContent > 0 },
        { label: "Articles Published", value: fmt(data.quickStats.articlesPublished) },
        { label: "Active Conversations", value: fmt(data.quickStats.activeConversations) },
        { label: "Total Comments", value: fmt(data.quickStats.totalComments) },
      ]
    : [];

  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-[#0a0a0a]">Dashboard</h1>
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#e5e5e5] text-xs font-medium text-[#525252]">
          {data ? "Live data" : "Unavailable"}
          <span className={`w-1.5 h-1.5 rounded-full inline-block ${data ? "bg-green-500" : "bg-[#a3a3a3]"}`} />
        </span>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {data
          ? statCards.map((stat) => <AdminStatCard key={stat.label} {...stat} />)
          : [1, 2, 3, 4].map((i) => <div key={i} className="h-28 rounded-xl border border-[#e5e5e5] bg-white" />)}
      </div>

      {/* Chart + Quick Stats */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <AdminChart data={platformActivityData} title="Platform Activity" />
        </div>
        <div className="lg:w-64 rounded-xl border border-[#e5e5e5] p-4 bg-white flex-shrink-0">
          <span className="text-sm font-semibold text-[#0a0a0a] block mb-3">Quick Stats</span>
          <div className="space-y-0.5">
            {data
              ? quickStatsList.map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-2.5 px-1 border-b border-[#f5f5f5] last:border-0">
                    <span className="text-sm text-[#525252]">{item.label}</span>
                    <span className={`text-sm font-semibold ${"danger" in item && item.danger ? "text-[#F44444]" : "warn" in item && item.warn ? "text-amber-600" : "text-[#0a0a0a]"}`}>
                      {item.value}
                    </span>
                  </div>
                ))
              : Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 px-1">
                    <div className="h-3 w-28 bg-[#f0f0f0] rounded" />
                    <div className="h-3 w-8 bg-[#f0f0f0] rounded" />
                  </div>
                ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e5e5e5] flex items-center justify-between">
          <span className="text-sm font-semibold text-[#0a0a0a]">Recent Activity</span>
          {data && data.recentActivity.length > 0 && (
            <span className="text-xs text-[#a3a3a3]">{data.recentActivity.length} events</span>
          )}
        </div>
        <div className="divide-y divide-[#f0f0f0]">
          {!data ? (
            <div className="px-5 py-8 text-center text-sm text-[#a3a3a3]">Unable to load activity</div>
          ) : data.recentActivity.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-[#a3a3a3]">No activity yet</p>
              <p className="text-xs text-[#c0c0c0] mt-1">Events will appear here as users sign up, sign in, and interact with the platform</p>
            </div>
          ) : (
            data.recentActivity.map((item) => {
              const badge = eventBadge[item.actionType];
              return (
                <div key={item.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#fafafa] transition-colors">
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-[#e5e5e5] bg-[#f0f0f0]">
                    {item.avatar ? (
                      <Image src={item.avatar} alt={item.userName} width={32} height={32} className="object-cover w-full h-full" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs font-semibold text-[#525252]">
                        {item.userName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#0a0a0a] leading-snug">
                      <span className="font-medium">{item.userName}</span>
                      <span className="text-[#525252]"> {item.action}</span>
                    </p>
                    {item.handle && (
                      <p className="text-xs text-[#a3a3a3]">@{item.handle}</p>
                    )}
                  </div>

                  {/* Badge + time */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {badge && (
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{ color: badge.color, background: badge.bg }}
                      >
                        {badge.label}
                      </span>
                    )}
                    <span className="text-xs text-[#a3a3a3]">{item.time}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
