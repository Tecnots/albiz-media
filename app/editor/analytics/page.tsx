"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  CheckCircle, RotateCcw, BookOpen, Send, XCircle,
  FileText, Loader2, StickyNote, Clock, TrendingUp,
} from "lucide-react";

const PERIODS = [
  { label: "1D",  value: "1d"   },
  { label: "7D",  value: "7d"   },
  { label: "30D", value: "30d"  },
  { label: "90D", value: "90d"  },
  { label: "1Y",  value: "365d" },
  { label: "All", value: "all"  },
];

const ACTION_LABELS: Record<string, string> = {
  approved:           "Approved",
  revision_requested: "Revision requested",
  published:          "Published",
  rejected:           "Rejected",
  assigned:           "Assigned",
  note_added:         "Note added",
};

const ACTION_COLORS: Record<string, string> = {
  approved:           "#22c55e",
  revision_requested: "#d97706",
  published:          "#3b82f6",
  rejected:           "#F44444",
  assigned:           "#8b5cf6",
  note_added:         "#0ea5e9",
};

function timeAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (d < 1)  return "just now";
  if (d < 60) return `${d}m ago`;
  const h = Math.floor(d / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface AnalyticsData {
  kpis: {
    periodApproved: number; periodRevisions: number; periodPublished: number;
    periodRejected: number; periodAssigned: number; periodNotes: number;
    allTimeApproved: number; allTimePublished: number; approvalRate: number;
    pendingQueue: number; myQueue: number;
  };
  dailySeries: { date: string; approved: number; revisions: number; published: number; total: number }[];
  actionBreakdown: { action: string; count: number; pct: number }[];
  noteTypes: { type: string; count: number }[];
  recentActivity: { id: number; action: string; createdAt: string; postId: number; postTitle: string; postStatus: string }[];
}

export default function EditorAnalyticsPage() {
  const [period, setPeriod]   = useState("30d");
  const [data, setData]       = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback((p: string) => {
    setLoading(true);
    fetch(`/api/editor/analytics?period=${p}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(period); }, [period, load]);

  const k = data?.kpis;

  const kpiCards = [
    { label: "Approved",    value: k?.periodApproved  ?? 0, sub: `${k?.allTimeApproved  ?? 0} all time`, icon: CheckCircle, color: "#22c55e" },
    { label: "Revisions",   value: k?.periodRevisions ?? 0, sub: "revision requests sent",                icon: RotateCcw,   color: "#d97706" },
    { label: "Published",   value: k?.periodPublished ?? 0, sub: `${k?.allTimePublished ?? 0} all time`, icon: Send,        color: "#3b82f6" },
    { label: "Rejected",    value: k?.periodRejected  ?? 0, sub: "rejected this period",                  icon: XCircle,     color: "#F44444" },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xl font-semibold text-[#0a0a0a]">Analytics</p>
          <p className="text-sm text-[#737373] mt-0.5">Your editorial activity overview</p>
        </div>
        <div className="flex items-center gap-1 bg-[#f5f5f5] rounded-xl p-1">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                period === p.value ? "bg-white text-[#0a0a0a] shadow-sm" : "text-[#737373] hover:text-[#0a0a0a]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-5 h-5 text-[#a3a3a3] animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kpiCards.map(card => (
              <div key={card.label} className="border border-[#f0f0f0] rounded-xl p-4 bg-white">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-[#737373]">{card.label}</p>
                  <card.icon className="w-3.5 h-3.5" style={{ color: card.color }} />
                </div>
                <p className="text-2xl font-bold text-[#0a0a0a]">{card.value}</p>
                <p className="text-[11px] text-[#a3a3a3] mt-1">{card.sub}</p>
              </div>
            ))}
          </div>

          {/* Approval rate + queue health */}
          <div className="grid grid-cols-3 gap-4">
            <div className="border border-[#f0f0f0] rounded-xl p-4 bg-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#f0fdf4" }}>
                <TrendingUp className="w-5 h-5 text-[#22c55e]" />
              </div>
              <div>
                <p className="text-xl font-bold text-[#0a0a0a]">{k?.approvalRate ?? 0}%</p>
                <p className="text-[11px] text-[#a3a3a3]">Approval rate</p>
              </div>
            </div>
            <div className="border border-[#f0f0f0] rounded-xl p-4 bg-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#eff6ff" }}>
                <Clock className="w-5 h-5 text-[#3b82f6]" />
              </div>
              <div>
                <p className="text-xl font-bold text-[#0a0a0a]">{k?.pendingQueue ?? 0}</p>
                <p className="text-[11px] text-[#a3a3a3]">My pending reviews</p>
              </div>
            </div>
            <div className="border border-[#f0f0f0] rounded-xl p-4 bg-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#fefce8" }}>
                <StickyNote className="w-5 h-5 text-[#d97706]" />
              </div>
              <div>
                <p className="text-xl font-bold text-[#0a0a0a]">{k?.periodNotes ?? 0}</p>
                <p className="text-[11px] text-[#a3a3a3]">Notes written</p>
              </div>
            </div>
          </div>

          {/* Daily activity chart + action breakdown */}
          <div className="grid grid-cols-[1fr_220px] gap-4">
            <div className="border border-[#f0f0f0] rounded-xl p-5 bg-white">
              <p className="text-sm font-semibold text-[#0a0a0a] mb-1">Editorial activity</p>
              <div className="flex items-center gap-4 mb-4">
                {[
                  { color: "#22c55e", label: "Approved"  },
                  { color: "#d97706", label: "Revisions" },
                  { color: "#3b82f6", label: "Published" },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
                    <span className="text-[11px] text-[#737373]">{l.label}</span>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={data?.dailySeries ?? []} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                  <defs>
                    {[
                      { id: "gradApproved",  color: "#22c55e" },
                      { id: "gradRevisions", color: "#d97706" },
                      { id: "gradPublished", color: "#3b82f6" },
                    ].map(g => (
                      <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={g.color} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={g.color} stopOpacity={0}    />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#a3a3a3" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#a3a3a3" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid #f0f0f0", borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="approved"  stroke="#22c55e" strokeWidth={2} fill="url(#gradApproved)"  dot={false} />
                  <Area type="monotone" dataKey="revisions" stroke="#d97706" strokeWidth={2} fill="url(#gradRevisions)" dot={false} />
                  <Area type="monotone" dataKey="published" stroke="#3b82f6" strokeWidth={2} fill="url(#gradPublished)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Action breakdown */}
            <div className="border border-[#f0f0f0] rounded-xl p-5 bg-white">
              <p className="text-sm font-semibold text-[#0a0a0a] mb-4">Action breakdown</p>
              {(data?.actionBreakdown?.length ?? 0) === 0 ? (
                <p className="text-xs text-[#a3a3a3] text-center py-6">No activity in this period</p>
              ) : (
                <div className="space-y-3">
                  {data!.actionBreakdown.map(a => (
                    <div key={a.action}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-[#525252]">{ACTION_LABELS[a.action] ?? a.action}</span>
                        <span className="text-xs font-medium tabular-nums" style={{ color: ACTION_COLORS[a.action] ?? "#737373" }}>
                          {a.count}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#f5f5f5] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${a.pct}%`, background: ACTION_COLORS[a.action] ?? "#d5d5d5" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent activity */}
          {(data?.recentActivity?.length ?? 0) > 0 && (
            <div className="border border-[#f0f0f0] rounded-xl bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-[#f0f0f0]">
                <p className="text-sm font-semibold text-[#0a0a0a]">Recent activity</p>
              </div>
              <div className="divide-y divide-[#f5f5f5]">
                {data!.recentActivity.map(a => {
                  const color = ACTION_COLORS[a.action] ?? "#737373";
                  return (
                    <div key={a.id} className="px-5 py-3 flex items-center gap-3 hover:bg-[#fafafa] transition-colors">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#0a0a0a] truncate">{a.postTitle}</p>
                        <p className="text-[11px] mt-0.5" style={{ color }}>
                          {ACTION_LABELS[a.action] ?? a.action}
                        </p>
                      </div>
                      <span className="text-[11px] text-[#a3a3a3] flex-shrink-0 tabular-nums">
                        {timeAgo(a.createdAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(data?.recentActivity?.length ?? 0) === 0 && !loading && (
            <div className="border border-[#f0f0f0] rounded-xl p-12 text-center bg-white">
              <BookOpen className="w-8 h-8 text-[#d5d5d5] mx-auto mb-3" />
              <p className="text-sm text-[#a3a3a3]">No editorial activity in this period yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}