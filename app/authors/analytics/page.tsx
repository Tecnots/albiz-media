"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuthorContext } from "../context";
import {
  AreaChart, Area, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { FileText, Eye, Heart, MessageSquare, TrendingUp, Loader2, Check, Clock, X as XIcon, FilePen } from "lucide-react";

const PERIODS = [
  { label: "1D",  value: "1d"   },
  { label: "7D",  value: "7d"   },
  { label: "30D", value: "30d"  },
  { label: "90D", value: "90d"  },
  { label: "1Y",  value: "365d" },
  { label: "All", value: "all"  },
];

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}


const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  published: { label: "Published", color: "#22c55e", bg: "#f0fdf4", icon: Check   },
  draft:     { label: "Draft",     color: "#737373", bg: "#f5f5f5", icon: FilePen },
  submitted: { label: "Submitted", color: "#3b82f6", bg: "#eff6ff", icon: Clock   },
  in_review: { label: "In Review", color: "#d97706", bg: "#fffbeb", icon: Clock   },
  rejected:  { label: "Rejected",  color: "#F44444", bg: "#fff0f0", icon: XIcon   },
};

interface AnalyticsData {
  kpis: {
    total: number; published: number; drafts: number; submitted: number;
    inReview: number; rejected: number; totalViews: number; totalLikes: number;
    totalComments: number; approvalRate: number;
    periodArticles: number; periodViews: number; periodLikes: number; periodComments: number;
  };
  statusBreakdown: { status: string; count: number; color: string }[];
  dailySeries: { date: string; articles: number }[];
  topArticles: { id: number; title: string; status: string; views: number; likes: number; comments: number }[];
}

export default function AuthorAnalyticsPage() {
  useAuthorContext();
  const [period, setPeriod]   = useState("30d");
  const [data, setData]       = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback((p: string) => {
    setLoading(true);
    fetch(`/api/author/analytics?period=${p}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(period); }, [period, load]);

  const kpis = data?.kpis;

  const kpiCards = [
    { label: "Total articles",  value: fmt(kpis?.total ?? 0),         sub: `${kpis?.periodArticles ?? 0} this period`, icon: FileText,     color: "#3b82f6" },
    { label: "Total views",     value: fmt(kpis?.totalViews ?? 0),    sub: `${fmt(kpis?.periodViews ?? 0)} this period`, icon: Eye,        color: "#8b5cf6" },
    { label: "Total likes",     value: fmt(kpis?.totalLikes ?? 0),    sub: `${fmt(kpis?.periodLikes ?? 0)} this period`, icon: Heart,      color: "#F44444" },
    { label: "Approval rate",   value: `${kpis?.approvalRate ?? 0}%`, sub: `${kpis?.published ?? 0} published`,          icon: TrendingUp, color: "#22c55e" },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xl font-semibold text-[#0a0a0a]">Analytics</p>
          <p className="text-sm text-[#737373] mt-0.5">Your content performance at a glance</p>
        </div>
        {/* Period filter */}
        <div className="flex items-center gap-1 bg-[#f5f5f5] rounded-xl p-1">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                period === p.value
                  ? "bg-white text-[#0a0a0a] shadow-sm"
                  : "text-[#737373] hover:text-[#0a0a0a]"
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

          {/* Chart + status breakdown */}
          <div className="grid grid-cols-[1fr_220px] gap-4">
            {/* Articles over time */}
            <div className="border border-[#f0f0f0] rounded-xl p-5 bg-white">
              <p className="text-sm font-semibold text-[#0a0a0a] mb-4">Articles created</p>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={data?.dailySeries ?? []} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="authorGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#F44444" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#F44444" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#a3a3a3" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#a3a3a3" }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#fff", border: "1px solid #f0f0f0", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: any) => [v, "Articles"]}
                  />
                  <Area type="monotone" dataKey="articles" stroke="#F44444" strokeWidth={2} fill="url(#authorGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Status breakdown */}
            <div className="border border-[#f0f0f0] rounded-xl p-5 bg-white">
              <p className="text-sm font-semibold text-[#0a0a0a] mb-4">Status breakdown</p>
              <div className="space-y-3">
                {data?.statusBreakdown.map(s => {
                  const total = data.kpis.total || 1;
                  const pct = Math.round((s.count / total) * 100);
                  return (
                    <div key={s.status}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-[#525252]">{s.status}</span>
                        <span className="text-xs font-medium tabular-nums" style={{ color: s.color }}>{s.count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#f5f5f5] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: s.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quick stats row */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total comments", value: fmt(kpis?.totalComments ?? 0), icon: MessageSquare, color: "#0ea5e9" },
              { label: "In review",      value: String(kpis?.inReview ?? 0),   icon: Clock,         color: "#d97706" },
              { label: "Rejected",       value: String(kpis?.rejected ?? 0),   icon: XIcon,         color: "#F44444" },
            ].map(s => (
              <div key={s.label} className="border border-[#f0f0f0] rounded-xl p-4 bg-white flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${s.color}14` }}>
                  <s.icon className="w-4 h-4" style={{ color: s.color }} />
                </div>
                <div>
                  <p className="text-lg font-bold text-[#0a0a0a]">{s.value}</p>
                  <p className="text-[11px] text-[#a3a3a3]">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Top articles */}
          {(data?.topArticles?.length ?? 0) > 0 && (
            <div className="border border-[#f0f0f0] rounded-xl bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-[#f0f0f0]">
                <p className="text-sm font-semibold text-[#0a0a0a]">Top articles by views</p>
              </div>
              <div className="divide-y divide-[#f5f5f5]">
                {data!.topArticles.map((a, i) => {
                  const cfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.draft;
                  return (
                    <div key={a.id} className="px-5 py-3 flex items-center gap-3 hover:bg-[#fafafa] transition-colors">
                      <span className="text-xs text-[#d5d5d5] w-4 tabular-nums flex-shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#0a0a0a] truncate">{a.title || "Untitled"}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="flex items-center gap-1 text-[11px] text-[#a3a3a3]">
                            <Eye className="w-3 h-3" />{fmt(a.views)}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-[#a3a3a3]">
                            <Heart className="w-3 h-3" />{fmt(a.likes)}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-[#a3a3a3]">
                            <MessageSquare className="w-3 h-3" />{fmt(a.comments)}
                          </span>
                        </div>
                      </div>
                      <span
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ color: cfg.color, background: cfg.bg }}
                      >
                        {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(data?.topArticles?.length ?? 0) === 0 && !loading && (
            <div className="border border-[#f0f0f0] rounded-xl p-12 text-center bg-white">
              <FileText className="w-8 h-8 text-[#d5d5d5] mx-auto mb-3" />
              <p className="text-sm text-[#a3a3a3]">No articles yet. Start writing to see your analytics.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}