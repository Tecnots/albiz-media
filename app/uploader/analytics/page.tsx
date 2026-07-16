"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Video, Eye, Heart, Share2, TrendingUp,
  Loader2, CheckCircle,
} from "lucide-react";

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

const STATUS_COLORS: Record<string, string> = {
  Published: "#2563eb",
  Approved:  "#16a34a",
  "In Review":"#d97706",
  Draft:     "#525252",
  Rejected:  "#F44444",
};

interface AnalyticsData {
  kpis: {
    total: number; published: number; drafts: number; inReview: number;
    approved: number; rejected: number; totalViews: number; totalLikes: number;
    totalShares: number; avgViews: number; approvalRate: number;
    periodCount: number; periodViews: number; periodLikes: number; periodShares: number;
  };
  statusBreakdown: { status: string; count: number; color: string }[];
  dailySeries: { date: string; created: number; views: number }[];
  topShorts: { id: number; title: string; status: string; views: number; likes: number; shares: number; thumbnailUrl: string | null; createdAt: string }[];
  reachFunnel: { label: string; value: number }[];
}

export default function UploaderAnalyticsPage() {
  const [period, setPeriod]   = useState("30d");
  const [data, setData]       = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartMode, setChartMode] = useState<"created" | "views">("views");

  const load = useCallback((p: string) => {
    setLoading(true);
    fetch(`/api/uploader/analytics?period=${p}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(period); }, [period, load]);

  const k = data?.kpis;

  const kpiCards = [
    { label: "Total shorts",  value: fmt(k?.total      ?? 0), sub: `${k?.periodCount   ?? 0} this period`, icon: Video,       color: "#8b5cf6" },
    { label: "Total views",   value: fmt(k?.totalViews ?? 0), sub: `${fmt(k?.periodViews ?? 0)} this period`, icon: Eye,      color: "#3b82f6" },
    { label: "Total likes",   value: fmt(k?.totalLikes ?? 0), sub: `${fmt(k?.periodLikes ?? 0)} this period`, icon: Heart,    color: "#F44444" },
    { label: "Avg views",     value: fmt(k?.avgViews   ?? 0), sub: "per short (all time)",                    icon: TrendingUp, color: "#22c55e" },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xl font-semibold text-[#0a0a0a]">Analytics</p>
          <p className="text-sm text-[#737373] mt-0.5">Your shorts performance</p>
        </div>
        <div className="flex items-center gap-1 bg-[#f5f5f5] rounded-xl p-1 border border-[#f0f0f0]">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                period === p.value
                  ? "bg-[#0a0a0a] text-white shadow-sm"
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
              <div key={card.label} className="bg-white border border-[#f0f0f0] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-[#737373]">{card.label}</p>
                  <card.icon className="w-3.5 h-3.5" style={{ color: card.color }} />
                </div>
                <p className="text-2xl font-bold text-[#0a0a0a]">{card.value}</p>
                <p className="text-[11px] text-[#a3a3a3] mt-1">{card.sub}</p>
              </div>
            ))}
          </div>

          {/* Reach funnel */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Published",     value: fmt(k?.published   ?? 0), icon: CheckCircle, color: "#2563eb" },
              { label: "Total shares",  value: fmt(k?.totalShares ?? 0), icon: Share2,      color: "#8b5cf6" },
              { label: "Approval rate", value: `${k?.approvalRate ?? 0}%`, icon: TrendingUp, color: "#22c55e" },
            ].map(s => (
              <div key={s.label} className="bg-white border border-[#f0f0f0] rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${s.color}18` }}>
                  <s.icon className="w-5 h-5" style={{ color: s.color }} />
                </div>
                <div>
                  <p className="text-xl font-bold text-[#0a0a0a]">{s.value}</p>
                  <p className="text-[11px] text-[#737373]">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Chart + status breakdown */}
          <div className="grid grid-cols-[1fr_220px] gap-4">
            <div className="bg-white border border-[#f0f0f0] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-[#0a0a0a]">
                  {chartMode === "views" ? "Views over time" : "Shorts created"}
                </p>
                <div className="flex items-center gap-1 bg-[#f5f5f5] border border-[#f0f0f0] rounded-lg p-0.5">
                  {(["views", "created"] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setChartMode(m)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors capitalize ${
                        chartMode === m ? "bg-white text-[#0a0a0a] font-semibold shadow-sm" : "text-[#737373] hover:text-[#0a0a0a]"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={data?.dailySeries ?? []} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="shortsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#a3a3a3" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#a3a3a3" }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#ffffff", border: "1px solid #f0f0f0", borderRadius: 8, fontSize: 12, color: "#0a0a0a" }}
                    formatter={(v) => [fmt(Number(v)), chartMode === "views" ? "Views" : "Created"]}
                  />
                  <Area
                    type="monotone"
                    dataKey={chartMode}
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#shortsGrad)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Status breakdown */}
            <div className="bg-white border border-[#f0f0f0] rounded-xl p-5">
              <p className="text-sm font-semibold text-[#0a0a0a] mb-4">Status breakdown</p>
              <div className="space-y-3">
                {data?.statusBreakdown.map(s => {
                  const total = Math.max(data.kpis.total, 1);
                  const pct = Math.round((s.count / total) * 100);
                  return (
                    <div key={s.status}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-[#737373]">{s.status}</span>
                        <span className="text-xs font-medium tabular-nums" style={{ color: s.color }}>{s.count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#f0f0f0] overflow-hidden">
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

          {/* Top shorts */}
          {(data?.topShorts?.length ?? 0) > 0 && (
            <div className="bg-white border border-[#f0f0f0] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#f0f0f0]">
                <p className="text-sm font-semibold text-[#0a0a0a]">Top shorts by views</p>
              </div>
              <div className="divide-y divide-[#f0f0f0]">
                {data!.topShorts.map((s, i) => (
                  <div key={s.id} className="px-5 py-3 flex items-center gap-3 hover:bg-[#fafafa] transition-colors">
                    <span className="text-xs text-[#a3a3a3] w-4 tabular-nums flex-shrink-0">{i + 1}</span>
                    <div className="w-8 h-11 rounded-lg overflow-hidden bg-[#f5f5f5] border border-[#f0f0f0] flex-shrink-0">
                      {s.thumbnailUrl ? (
                        <img src={s.thumbnailUrl} alt={s.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Video className="w-3 h-3 text-[#a3a3a3]" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#0a0a0a] truncate">{s.title}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1 text-[11px] text-[#a3a3a3]">
                          <Eye className="w-3 h-3" />{fmt(s.views)}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-[#a3a3a3]">
                          <Heart className="w-3 h-3" />{fmt(s.likes)}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-[#a3a3a3]">
                          <Share2 className="w-3 h-3" />{fmt(s.shares)}
                        </span>
                      </div>
                    </div>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[#f0f0f0] flex-shrink-0 bg-[#f5f5f5]"
                      style={{
                        color: STATUS_COLORS[s.status.charAt(0).toUpperCase() + s.status.slice(1)] ?? "#737373",
                      }}
                    >
                      {s.status.charAt(0).toUpperCase() + s.status.slice(1).replace("_", " ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(data?.topShorts?.length ?? 0) === 0 && !loading && (
            <div className="bg-white border border-[#f0f0f0] rounded-xl p-12 text-center">
              <Video className="w-8 h-8 text-[#d4d4d4] mx-auto mb-3" />
              <p className="text-sm text-[#a3a3a3]">No shorts yet. Upload your first short to see analytics.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}