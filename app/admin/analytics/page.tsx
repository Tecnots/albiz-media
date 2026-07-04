"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import {
  Monitor, Smartphone, Tablet, Loader2, RotateCcw, Globe, Users, Activity,
  Eye, FileText, TrendingUp, Gauge, Clock, MousePointerClick, UserPlus, Flag,
  Search, ArrowLeft, ChevronLeft, ChevronRight,
} from "lucide-react";
import { AdminChart, Sparkline, AdminPillTabs, UserGrowthChart } from "../admin-components";
import { api } from "@/app/lib/api";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, BarChart, Bar, Cell,
} from "recharts";

const GlobeComponent = dynamic(() => import("./GlobeComponent"), { ssr: false, loading: () => (
  <div className="flex items-center justify-center h-full">
    <Loader2 className="w-6 h-6 text-[#F44444] animate-spin" />
  </div>
) });

const DEVICE_ICONS: Record<string, typeof Monitor> = { Mobile: Smartphone, Desktop: Monitor, Tablet: Tablet };
const RANGES: { label: string; days: number | null }[] = [
  { label: "1D", days: 1 }, { label: "7D", days: 7 }, { label: "30D", days: 30 },
  { label: "90D", days: 90 }, { label: "1Y", days: 365 }, { label: "All", days: null },
];

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}
function flagEmoji(code: string) {
  return code.toUpperCase().split("").map(c => String.fromCodePoint(0x1F1E6 - 65 + c.charCodeAt(0))).join("");
}

const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const date = new Date(iso);
  return `${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

const EVENT_LABELS: Record<string, string> = {
  SIGNUP: "Signup", SIGNIN: "Sign in", DEACTIVATE: "Deactivate", REACTIVATE: "Reactivate",
  DELETE_ACCOUNT: "Deleted", CIRCLE_REQUEST: "Circle request", CIRCLE_APPROVED: "Circle approved",
  CIRCLE_REJECTED: "Circle rejected", BAN: "Banned", UNBAN: "Unbanned",
  VERIFICATION_APPROVED: "Verified", VERIFICATION_REJECTED: "Verify rejected",
  CONTENT_REPORTED: "Reported", CONTENT_MODERATED: "Moderated",
};

const EVENT_COLORS: Record<string, string> = {
  SIGNUP: "#22c55e", REACTIVATE: "#22c55e", CIRCLE_APPROVED: "#22c55e",
  VERIFICATION_APPROVED: "#22c55e", UNBAN: "#22c55e",
  BAN: "#F44444", DELETE_ACCOUNT: "#F44444", CIRCLE_REJECTED: "#F44444",
  VERIFICATION_REJECTED: "#F44444",
  SIGNIN: "#3B82F6",
  CIRCLE_REQUEST: "#8B5CF6",
  CONTENT_REPORTED: "#F59E0B", CONTENT_MODERATED: "#F59E0B",
  DEACTIVATE: "#a3a3a3",
};

const ALL_EVENT_TYPES = [
  "SIGNUP", "SIGNIN", "DEACTIVATE", "REACTIVATE", "DELETE_ACCOUNT",
  "CIRCLE_REQUEST", "CIRCLE_APPROVED", "CIRCLE_REJECTED",
  "BAN", "UNBAN", "VERIFICATION_APPROVED", "VERIFICATION_REJECTED",
  "CONTENT_REPORTED", "CONTENT_MODERATED",
] as const;

// ─── Shared presentational ───
function RangeTabs({ value, onChange }: { value: number | null; onChange: (d: number | null) => void }) {
  return (
    <div className="flex gap-1">
      {RANGES.map(r => (
        <button key={r.label} onClick={() => onChange(r.days)}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${value === r.days ? "text-white" : "text-[#737373] hover:bg-[#f5f5f5]"}`}
          style={value === r.days ? { backgroundColor: "#F44444" } : {}}>
          {r.label}
        </button>
      ))}
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, accent, change }: { label: string; value: string | number; sub?: string; icon: typeof Globe; accent?: string; change?: number }) {
  const up = (change ?? 0) >= 0;
  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white p-4">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs text-[#737373]">{label}</p>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: (accent ?? "#F44444") + "15" }}>
          <Icon className="w-3.5 h-3.5" style={{ color: accent ?? "#F44444" }} />
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-bold text-[#0a0a0a]">{value}</p>
        {change !== undefined && (
          <span className={`text-[11px] font-medium ${up ? "text-[#22c55e]" : "text-[#F44444]"}`}>{up ? "▲" : "▼"} {Math.abs(change)}%</span>
        )}
      </div>
      {sub && <p className="text-xs text-[#a3a3a3] mt-1">{sub}</p>}
    </div>
  );
}

function HBar({ label, count, max, flag }: { label: string; count: number | string; max: number; flag?: string }) {
  const n = typeof count === "number" ? count : 0;
  const pct = max > 0 ? Math.round((n / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-2">
      {flag && <span className="text-base w-6 flex-shrink-0">{flag}</span>}
      <span className="text-xs text-[#0a0a0a] flex-1 truncate">{label}</span>
      <div className="w-24 h-1.5 bg-[#f5f5f5] rounded-full overflow-hidden flex-shrink-0">
        <motion.div className="h-full rounded-full bg-[#F44444]"
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true, margin: "-20px" }}
          transition={{ type: "spring", stiffness: 280, damping: 28 }} />
      </div>
      <span className="text-xs font-semibold text-[#0a0a0a] w-12 text-right flex-shrink-0">{count}</span>
    </div>
  );
}

function Panel({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white p-5">
      <p className="text-sm font-semibold text-[#0a0a0a] mb-0.5">{title}</p>
      {sub && <p className="text-xs text-[#a3a3a3] mb-4">{sub}</p>}
      {!sub && <div className="mb-4" />}
      {children}
    </div>
  );
}

function DistBars({ items }: { items: { label: string; count: number }[] }) {
  const max = Math.max(1, ...items.map(i => i.count));
  if (!items.some(i => i.count > 0)) return <p className="text-xs text-[#a3a3a3] text-center py-6">No data yet</p>;
  return <div className="divide-y divide-[#f5f5f5]">{items.map(i => <HBar key={i.label} label={i.label} count={i.count} max={max} />)}</div>;
}

function Skeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-[#e5e5e5] bg-white p-4 animate-pulse">
          <div className="h-3 bg-[#ebebeb] rounded w-20 mb-3" />
          <div className="h-7 bg-[#ebebeb] rounded w-16" />
        </div>
      ))}
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? "#22c55e" : score >= 40 ? "#F59E0B" : "#a3a3a3";
  return <span className="text-xs font-bold tabular-nums" style={{ color }}>{score}</span>;
}

function useTab<T>(loader: (days: number | null) => Promise<T>, days: number | null) {
  const [data, setData]     = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    loader(days)
      .then(d => {
        if (!alive) return;
        // Route returned an error object instead of real data
        if (d && typeof d === "object" && "error" in (d as any)) {
          setError((d as any).error as string);
        } else {
          setData(d);
        }
      })
      .catch(err => { if (alive) setError(err?.message ?? "Failed to load"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
     
  }, [days]);
  return { data, loading, error };
}

// ─── OverviewMetricChart (with comparison mode) ───
const OVERVIEW_METRICS = [
  { key: "impressions", label: "Impressions",    color: "#F44444" },
  { key: "signups",     label: "Signups",         color: "#22c55e" },
  { key: "engagements", label: "Engagements",     color: "#8B5CF6" },
  { key: "posts",       label: "Posts published", color: "#F59E0B" },
] as const;
type OverviewMetricKey = typeof OVERVIEW_METRICS[number]["key"];

function OverviewTooltip({ active, payload, label, color, compare }: any) {
  if (!active || !payload?.length || !label) return null;
  const curr = payload.find((p: any) => p.dataKey === "value")?.value ?? 0;
  const prev = payload.find((p: any) => p.dataKey === "prevValue")?.value ?? 0;
  return (
    <div className="rounded-xl overflow-hidden" style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.14)" }}>
      <div className="px-3.5 py-2.5" style={{ background: color }}>
        <p className="text-[10px] text-white/60 mb-1 uppercase tracking-wider">{label}</p>
        <p className="text-xl font-bold text-white leading-none">{curr.toLocaleString()}</p>
      </div>
      {compare && (
        <div className="px-3.5 py-2 bg-white">
          <p className="text-[10px] text-[#a3a3a3] mb-0.5">Prior period</p>
          <p className="text-sm font-semibold text-[#525252]">{prev.toLocaleString()}</p>
          {prev > 0 && (
            <p className={`text-[10px] font-medium mt-0.5 ${curr >= prev ? "text-[#22c55e]" : "text-[#F44444]"}`}>
              {curr >= prev ? "+" : ""}{(((curr - prev) / prev) * 100).toFixed(1)}% vs prior
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function OverviewCrosshair({ points, height }: any) {
  if (!points?.length) return null;
  const { x } = points[0];
  if (!isFinite(x)) return null;
  return <line x1={x} y1={0} x2={x} y2={height} stroke="#d4d4d4" strokeWidth={1} />;
}

function OverviewMetricChart({
  timeSeries, prevTimeSeries, stats,
}: { timeSeries: any[]; prevTimeSeries?: any[]; stats: any }) {
  const [metric, setMetric] = useState<OverviewMetricKey>("impressions");
  const [compare, setCompare] = useState(false);

  const metaByKey: Record<OverviewMetricKey, { total: number; change: number; color: string; label: string }> = {
    impressions: { total: stats?.impressions ?? 0,      change: stats?.impressionsChange ?? 0, color: "#F44444", label: "Impressions" },
    signups:     { total: stats?.newSignups ?? 0,       change: stats?.newSignupsChange ?? 0,  color: "#22c55e", label: "Signups" },
    engagements: { total: stats?.totalEngagements ?? 0, change: stats?.engagementsChange ?? 0, color: "#8B5CF6", label: "Engagements" },
    posts:       { total: stats?.newPosts ?? 0,         change: stats?.newPostsChange ?? 0,    color: "#F59E0B", label: "Posts published" },
  };

  const active  = metaByKey[metric];
  const hasPrev = (prevTimeSeries?.length ?? 0) > 0;

  const chartData = (timeSeries ?? []).map((d: any, i: number) => ({
    date:      d.date,
    value:     d[metric] ?? 0,
    prevValue: prevTimeSeries?.[i]?.[metric] ?? 0,
  }));

  const vals = chartData.map(d => d.value);
  const avg  = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  const gradId = `omc-${metric}`;

  const tickFmt = (v: number) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000   ? `${(v / 1_000).toFixed(0)}K`
    : `${v}`;

  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs text-[#a3a3a3] mb-1.5">{active.label}</p>
          <div className="flex items-baseline gap-2.5">
            <span className="text-[32px] font-bold text-[#0a0a0a] tracking-tight leading-none">{fmt(active.total)}</span>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${active.change >= 0 ? "bg-[#22c55e]/10 text-[#22c55e]" : "bg-[#F44444]/10 text-[#F44444]"}`}>
              {active.change >= 0 ? "+" : ""}{active.change}%
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {hasPrev && (
            <button
              onClick={() => setCompare(c => !c)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer"
              style={compare
                ? { borderColor: active.color, color: active.color, backgroundColor: active.color + "12" }
                : { borderColor: "#e5e5e5", color: "#737373" }}>
              Compare
            </button>
          )}
          <div className="flex gap-1">
            {OVERVIEW_METRICS.map(m => (
              <button key={m.key} onClick={() => setMetric(m.key)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                style={metric === m.key ? { backgroundColor: m.color, color: "#fff" } : { color: "#737373" }}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {compare && hasPrev && (
        <div className="px-5 pb-3 flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 rounded-full" style={{ backgroundColor: active.color }} />
            <span className="text-[10px] text-[#525252]">This period</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 border-t border-dashed border-[#a3a3a3]" />
            <span className="text-[10px] text-[#a3a3a3]">Prior period</span>
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={chartData} margin={{ top: 8, right: 20, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={active.color} stopOpacity={0.15} />
              <stop offset="100%" stopColor={active.color} stopOpacity={0}    />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#f0f0f0" />
          <XAxis dataKey="date" axisLine={false} tickLine={false}
            tick={{ fontSize: 11, fill: "#a3a3a3" }} dy={10}
            padding={{ left: 10, right: 10 }} interval="preserveStartEnd" />
          <YAxis axisLine={false} tickLine={false}
            tick={{ fontSize: 11, fill: "#a3a3a3" }}
            tickFormatter={tickFmt} width={44} tickCount={5} domain={[0, "auto"]} />
          <Tooltip
            content={(props: any) => <OverviewTooltip {...props} color={active.color} compare={compare} />}
            cursor={<OverviewCrosshair />}
          />
          {avg > 0 && (
            <ReferenceLine y={avg} stroke="#e5e5e5" strokeDasharray="4 3"
              label={{ value: "avg", position: "insideTopRight", fontSize: 10, fill: "#c5c5c5", dy: -6 }} />
          )}
          {compare && hasPrev && (
            <Area type="monotone" dataKey="prevValue"
              stroke="#c5c5c5" strokeWidth={1.5} strokeDasharray="4 3"
              fill="none" dot={false}
              isAnimationActive={true} animationDuration={700} animationEasing="ease-out"
              activeDot={{ r: 3, fill: "#c5c5c5", stroke: "white", strokeWidth: 2 }} />
          )}
          <Area type="monotone" dataKey="value"
            isAnimationActive={true} animationDuration={700} animationEasing="ease-out"
            stroke={active.color} strokeWidth={2}
            fill={`url(#${gradId})`} dot={false}
            activeDot={{ r: 5, fill: active.color, stroke: "white", strokeWidth: 2.5 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── LiveSignupsCard ───
function LiveSignupsCard({ stats }: { stats: any }) {
  const hourly = stats?.signupsLastHour ?? 0;
  const up     = (stats?.newSignupsChange ?? 0) >= 0;
  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white p-4">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs text-[#737373]">New signups</p>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#22c55e15]">
          <UserPlus className="w-3.5 h-3.5 text-[#22c55e]" />
        </div>
      </div>
      <div className="flex items-baseline gap-2 mb-3">
        <p className="text-2xl font-bold text-[#0a0a0a]">{fmt(stats?.newSignups ?? 0)}</p>
        <span className={`text-[11px] font-medium ${up ? "text-[#22c55e]" : "text-[#F44444]"}`}>
          {up ? "▲" : "▼"} {Math.abs(stats?.newSignupsChange ?? 0)}%
        </span>
      </div>
      <div className="flex items-center gap-1.5 pt-2.5 border-t border-[#f5f5f5]">
        {hourly > 0
          ? <><span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse flex-shrink-0" />
              <p className="text-xs text-[#525252]"><span className="font-semibold text-[#22c55e]">{hourly}</span> this hour</p></>
          : <p className="text-xs text-[#a3a3a3]">None this hour</p>
        }
      </div>
    </div>
  );
}

// ─── ConversionFunnel ───
function ConversionFunnel({ funnel }: { funnel: any }) {
  const imp  = funnel?.impressions ?? 0;
  const eng  = funnel?.engaged     ?? 0;
  const fol  = funnel?.followed    ?? 0;

  const engRate = imp > 0 ? ((eng / imp) * 100).toFixed(1) : "0";
  const folRate = imp > 0 ? ((fol / imp) * 100).toFixed(1) : "0";

  const steps = [
    { label: "Impressions", count: imp, color: "#F44444", pct: 100 },
    { label: "Engagements", count: eng, color: "#8B5CF6", pct: imp > 0 ? (eng / imp) * 100 : 0 },
    { label: "Follows",     count: fol, color: "#22c55e", pct: imp > 0 ? (fol / imp) * 100 : 0 },
  ];
  const drops = [engRate, folRate];

  return (
    <Panel title="Conversion funnel" sub="impressions → engaged → followed">
      <div className="space-y-0">
        {steps.map((step, i) => (
          <div key={step.label}>
            {i > 0 && (
              <div className="flex items-center gap-2 py-1.5 pl-[88px]">
                <span className="text-[10px] text-[#d4d4d4]">▼</span>
                <span className="text-[11px] text-[#a3a3a3]">{drops[i - 1]}% conversion</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#737373] w-20 flex-shrink-0">{step.label}</span>
              <div className="flex-1 h-7 bg-[#f5f5f5] rounded-lg overflow-hidden">
                <motion.div
                  className="h-full rounded-lg"
                  initial={{ width: 0 }}
                  whileInView={{ width: `${Math.max(step.pct, step.count > 0 ? 1.5 : 0)}%` }}
                  viewport={{ once: true, margin: "-20px" }}
                  transition={{ type: "spring", stiffness: 220, damping: 30, delay: i * 0.07 }}
                  style={{ backgroundColor: step.color + "cc" }}
                />
              </div>
              <span className="text-xs font-bold text-[#0a0a0a] w-14 text-right tabular-nums">{fmt(step.count)}</span>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ─── TopPostsMini ───
function TopPostsMini({ posts }: { posts: any[] }) {
  return (
    <Panel title="Top posts this period" sub="by impressions">
      {!posts?.length ? (
        <p className="text-xs text-[#a3a3a3] text-center py-8">No impressions tracked yet</p>
      ) : (
        <div className="space-y-4">
          {posts.map((p: any, i: number) => (
            <div key={p.id} className="flex items-start gap-3">
              <span className="text-xs font-semibold text-[#a3a3a3] w-4 flex-shrink-0 mt-1.5">{i + 1}</span>
              {p.image
                ? <img src={p.image} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                : <div className="w-10 h-10 rounded-lg bg-[#f5f5f5] flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-[#a3a3a3]" />
                  </div>
              }
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#0a0a0a] font-medium truncate leading-snug">{p.title}</p>
                <p className="text-xs text-[#a3a3a3] truncate mt-0.5">@{p.authorHandle}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-[#0a0a0a] tabular-nums">{fmt(p.impressions)}</p>
                <p className="text-[10px] text-[#a3a3a3]">views</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ─── ActivityFeed ───
const EVENT_CFG: Record<string, { label: string; dot: string }> = {
  SIGNUP:          { label: "signed up",            dot: "#22c55e" },
  SIGNIN:          { label: "signed in",            dot: "#3B82F6" },
  CIRCLE_REQUEST:  { label: "requested Circle",     dot: "#F59E0B" },
  CIRCLE_APPROVED: { label: "approved for Circle",  dot: "#22c55e" },
  CIRCLE_REJECTED: { label: "rejected from Circle", dot: "#F44444" },
  BAN:             { label: "was banned",           dot: "#F44444" },
  UNBAN:           { label: "was unbanned",         dot: "#22c55e" },
  DEACTIVATE:      { label: "deactivated account",  dot: "#a3a3a3" },
  REACTIVATE:      { label: "reactivated account",  dot: "#22c55e" },
  DELETE_ACCOUNT:  { label: "deleted account",      dot: "#F44444" },
};

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ActivityFeed({ entries }: { entries: any[] }) {
  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white p-5">
      <p className="text-sm font-semibold text-[#0a0a0a] mb-0.5">Recent activity</p>
      <p className="text-xs text-[#a3a3a3] mb-4">Platform events</p>
      {!entries?.length ? (
        <p className="text-xs text-[#a3a3a3] text-center py-6">No activity recorded yet</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 divide-y lg:divide-y-0 divide-[#f5f5f5]">
          {entries.map((e: any) => {
            const cfg = EVENT_CFG[e.eventType] ?? { label: String(e.eventType).toLowerCase(), dot: "#a3a3a3" };
            const initials = (e.userName || "?").charAt(0).toUpperCase();
            return (
              <div key={e.id} className="flex items-center gap-3 py-2.5 border-b border-[#f5f5f5] last:border-0 lg:border-b lg:last:border-b">
                <div className="w-7 h-7 rounded-full bg-[#f5f5f5] flex items-center justify-center flex-shrink-0 text-xs font-semibold text-[#525252] overflow-hidden">
                  {e.avatar
                    ? <img src={e.avatar} alt="" className="w-7 h-7 object-cover" />
                    : initials
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#0a0a0a] truncate">
                    <span className="font-medium">{e.userName}</span>{" "}
                    <span className="text-[#525252]">{cfg.label}</span>
                  </p>
                  {e.handle && <p className="text-[10px] text-[#a3a3a3]">@{e.handle}</p>}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.dot }} />
                  <span className="text-[10px] text-[#a3a3a3] whitespace-nowrap">{relTime(e.createdAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── User roles breakdown ───
const ROLE_META: Record<string, { label: string; color: string; sub: string }> = {
  NORMAL: { label: "Members",  color: "#3B82F6", sub: "Standard registered users" },
  CIRCLE: { label: "Circle",   color: "#F44444", sub: "Paid subscription members" },
  AUTHOR: { label: "Authors",  color: "#F59E0B", sub: "Content creators" },
  EDITOR: { label: "Editors",  color: "#8B5CF6", sub: "Editorial team" },
  ADMIN:  { label: "Admins",   color: "#525252", sub: "Platform administrators" },
};

function UserRolesPanel({ roleBreakdown, totalUsers }: { roleBreakdown: any[]; totalUsers: number }) {
  const maxCount = Math.max(1, ...roleBreakdown.map(r => r.total));
  const hasData  = roleBreakdown.some(r => r.total > 0);

  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-[#0a0a0a]">Users by role</p>
          <p className="text-xs text-[#a3a3a3] mt-0.5">{fmt(totalUsers)} total registered</p>
        </div>
      </div>

      {!hasData ? (
        <p className="text-xs text-[#a3a3a3] text-center py-8">No users yet</p>
      ) : (
        <div className="px-5 pb-5">
          {roleBreakdown.map((r, idx) => {
            const meta   = ROLE_META[r.role] ?? { label: r.role, color: "#737373", sub: "" };
            const pct    = totalUsers > 0 ? ((r.total / totalUsers) * 100).toFixed(1) : "0";
            const barPct = (r.total / maxCount) * 100;
            const activeRate = r.total > 0 ? Math.round((r.active7d / r.total) * 100) : 0;

            return (
              <div key={r.role} className="flex items-center gap-4 py-3 border-b border-[#f5f5f5] last:border-0">
                {/* color dot + name */}
                <div className="w-[120px] flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
                    <span className="text-xs font-medium text-[#0a0a0a]">{meta.label}</span>
                  </div>
                  <p className="text-[10px] text-[#a3a3a3] mt-0.5 pl-4">{meta.sub}</p>
                </div>

                {/* proportional bar */}
                <div className="flex-1 h-1.5 bg-[#f5f5f5] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${barPct}%` }}
                    viewport={{ once: true, margin: "-20px" }}
                    transition={{ type: "spring", stiffness: 260, damping: 28, delay: idx * 0.06 }}
                    style={{ backgroundColor: meta.color }}
                  />
                </div>

                {/* count + pct */}
                <div className="flex items-center gap-5 flex-shrink-0 text-right">
                  <div className="w-12">
                    <p className="text-sm font-semibold text-[#0a0a0a]">{fmt(r.total)}</p>
                    <p className="text-[10px] text-[#a3a3a3]">{pct}%</p>
                  </div>

                  {/* active 7d */}
                  <div className="w-16 hidden lg:block">
                    {r.total > 0 ? (
                      <>
                        <p className="text-xs font-medium text-[#0a0a0a]">{fmt(r.active7d)}</p>
                        <p className="text-[10px] text-[#a3a3a3]">{activeRate}% active</p>
                      </>
                    ) : (
                      <p className="text-[10px] text-[#d4d4d4]">—</p>
                    )}
                  </div>

                  {/* new in period */}
                  <div className="w-14 text-center">
                    {r.newInPeriod > 0 ? (
                      <span className="inline-block text-[10px] font-semibold text-[#22c55e] bg-[#22c55e]/10 px-2 py-0.5 rounded-full">
                        +{r.newInPeriod}
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#d4d4d4]">—</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* legend row */}
          <div className="flex items-center gap-5 justify-end mt-3 pt-3 border-t border-[#f5f5f5]">
            <p className="text-[10px] text-[#a3a3a3] hidden lg:block w-16 text-right">Active 7d</p>
            <p className="text-[10px] text-[#a3a3a3] w-14 text-center">New this period</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Overview ───
function OverviewTab({ days }: { days: number | null }) {
  const { data, loading, error } = useTab(api.getAdminOverview, days);
  if (loading && !data) return <Skeleton />;
  if (error) return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white p-6 text-center">
      <p className="text-sm font-medium text-[#0a0a0a] mb-1">Failed to load analytics</p>
      <p className="text-xs text-[#a3a3a3] font-mono">{error}</p>
    </div>
  );
  const s = data?.stats;

  const fadeUp = (delay: number) => ({
    initial: { opacity: 0, y: 14 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-40px" },
    transition: { type: "spring" as const, stiffness: 380, damping: 32, delay },
  });

  return (
    <div className="space-y-5">
      {/* Primary KPIs */}
      <motion.div className="grid grid-cols-2 lg:grid-cols-4 gap-4" {...fadeUp(0)}>
        <StatCard label="Total users"     value={fmt(s?.totalUsers ?? 0)}      sub={`${s?.activeUsers24h ?? 0} active today`}                      icon={Users}     accent="#3B82F6" />
        <LiveSignupsCard stats={s} />
        <StatCard label="Impressions"     value={fmt(s?.impressions ?? 0)}     change={s?.impressionsChange}  sub="post views in period"            icon={Eye}       accent="#F44444" />
        <StatCard label="Engagement rate" value={`${s?.engagementRate ?? 0}%`} sub={`${fmt(s?.totalEngagements ?? 0)} total interactions`}          icon={Gauge}     accent="#8B5CF6" />
      </motion.div>

      {/* Multi-metric chart with comparison */}
      <motion.div {...fadeUp(0.06)}>
        <OverviewMetricChart
          timeSeries={data?.timeSeries ?? []}
          prevTimeSeries={data?.prevTimeSeries}
          stats={s}
        />
      </motion.div>

      {/* Funnel + Top Posts */}
      <motion.div className="grid grid-cols-1 lg:grid-cols-2 gap-4" {...fadeUp(0.12)}>
        <ConversionFunnel funnel={data?.funnel} />
        <TopPostsMini posts={data?.topPosts ?? []} />
      </motion.div>

      {/* Activity feed */}
      <motion.div {...fadeUp(0.18)}>
        <ActivityFeed entries={data?.recentActivity ?? []} />
      </motion.div>

      {/* User role breakdown */}
      <motion.div {...fadeUp(0.22)}>
        <UserRolesPanel
          roleBreakdown={data?.roleBreakdown ?? []}
          totalUsers={s?.totalUsers ?? 0}
        />
      </motion.div>

      {/* Secondary KPIs */}
      <motion.div className="grid grid-cols-2 lg:grid-cols-3 gap-4" {...fadeUp(0.26)}>
        <StatCard label="New posts"        value={fmt(s?.newPosts ?? 0)}        change={s?.newPostsChange}     sub="published in period"        icon={FileText}   accent="#F59E0B" />
        <StatCard label="Active this week" value={fmt(s?.activeUsers7d ?? 0)}   sub="users in last 7 days"                                      icon={Activity}   accent="#22c55e" />
        <StatCard label="Engagements"      value={fmt(s?.totalEngagements ?? 0)} change={s?.engagementsChange} sub="likes + comments + shares"  icon={TrendingUp} accent="#8B5CF6" />
      </motion.div>
    </div>
  );
}

// ─── Engagement sub-components ───

function EngagementTrendChart({ timeSeries }: { timeSeries: any[] }) {
  const [metric, setMetric] = useState<"total" | "rate">("total");
  const isEmpty = !timeSeries?.some((d: any) => d.total > 0 || d.engagementRate > 0);

  const tickFmt = (v: number) => metric === "rate" ? `${v}%` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`;

  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#0a0a0a]">Engagement over time</p>
          <p className="text-xs text-[#a3a3a3] mt-0.5">Likes, comments and shares per day</p>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {(["total", "rate"] as const).map(m => (
            <button key={m} onClick={() => setMetric(m)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              style={metric === m ? { backgroundColor: "#F44444", color: "#fff" } : { color: "#737373" }}>
              {m === "total" ? "Volume" : "Rate"}
            </button>
          ))}
        </div>
      </div>
      {isEmpty ? (
        <p className="text-xs text-[#a3a3a3] text-center py-10">No engagement in this period — try a longer range</p>
      ) : metric === "total" ? (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={timeSeries} margin={{ top: 4, right: 20, bottom: 0, left: 4 }} barSize={8}>
            <CartesianGrid vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="date" axisLine={false} tickLine={false}
              tick={{ fontSize: 11, fill: "#a3a3a3" }} dy={8} interval="preserveStartEnd" />
            <YAxis axisLine={false} tickLine={false}
              tick={{ fontSize: 11, fill: "#a3a3a3" }} width={36} tickFormatter={tickFmt} />
            <Tooltip
              contentStyle={{ borderRadius: 10, border: "1px solid #e5e5e5", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}
              labelStyle={{ fontSize: 11, color: "#0a0a0a", fontWeight: 600, marginBottom: 4 }}
              itemStyle={{ fontSize: 11 }}
              cursor={{ fill: "#f5f5f5" }}
            />
            <Bar dataKey="likes"    name="Likes"    stackId="a" fill="#F44444" radius={[0, 0, 0, 0]} />
            <Bar dataKey="comments" name="Comments" stackId="a" fill="#8B5CF6" radius={[0, 0, 0, 0]} />
            <Bar dataKey="shares"   name="Shares"   stackId="a" fill="#F59E0B" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={timeSeries} margin={{ top: 4, right: 20, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id="engRate" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#22c55e" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="date" axisLine={false} tickLine={false}
              tick={{ fontSize: 11, fill: "#a3a3a3" }} dy={8} interval="preserveStartEnd" />
            <YAxis axisLine={false} tickLine={false}
              tick={{ fontSize: 11, fill: "#a3a3a3" }} width={36} tickFormatter={tickFmt} />
            <Tooltip
              formatter={(v: any) => [`${v}%`, "Engagement rate"]}
              contentStyle={{ borderRadius: 10, border: "1px solid #e5e5e5", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}
              labelStyle={{ fontSize: 11, color: "#0a0a0a", fontWeight: 600 }}
              itemStyle={{ fontSize: 11 }}
              cursor={false}
            />
            <Area type="monotone" dataKey="engagementRate" name="Engagement rate"
              stroke="#22c55e" strokeWidth={2} fill="url(#engRate)" dot={false}
              activeDot={{ r: 4, fill: "#22c55e", stroke: "white", strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      )}
      {metric === "total" && (
        <div className="px-5 pb-4 flex items-center gap-5">
          {[{ color: "#F44444", label: "Likes" }, { color: "#8B5CF6", label: "Comments" }, { color: "#F59E0B", label: "Shares" }].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: l.color }} />
              <span className="text-[11px] text-[#525252]">{l.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PeakHoursPanel({ heatmapData }: { heatmapData: { day: number; hour: number; count: number }[] }) {
  const maxCount  = Math.max(1, ...heatmapData.map(d => d.count));
  const isEmpty   = !heatmapData.some(d => d.count > 0);
  const total     = heatmapData.reduce((a, d) => a + d.count, 0);

  const fmtHour = (h: number) => {
    if (h === 0)  return "12am";
    if (h === 12) return "12pm";
    return h < 12 ? `${h}am` : `${h - 12}pm`;
  };

  const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const cellMap    = new Map(heatmapData.map(d => [`${d.day}-${d.hour}`, d.count]));

  // Derive summary stats
  const hourlyTotals = Array.from({ length: 24 }, (_, h) =>
    DAY_LABELS.reduce((s, _, day) => s + (cellMap.get(`${day}-${h}`) ?? 0), 0)
  );
  const dailyTotals = Array.from({ length: 7 }, (_, day) =>
    Array.from({ length: 24 }, (_, h) => cellMap.get(`${day}-${h}`) ?? 0).reduce((a, b) => a + b, 0)
  );
  const peakHourIdx  = hourlyTotals.indexOf(Math.max(...hourlyTotals));
  const peakDayIdx   = dailyTotals.indexOf(Math.max(...dailyTotals));
  const activeHrs    = hourlyTotals.filter(c => c > 0).length;

  const rows = DAY_LABELS.map((label, day) => ({
    label,
    cells: Array.from({ length: 24 }, (_, hour) => ({ hour, count: cellMap.get(`${day}-${hour}`) ?? 0 })),
  }));

  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-sm font-semibold text-[#0a0a0a]">Peak hours</p>
          <p className="text-xs text-[#a3a3a3] mt-0.5">When users engage most (local time)</p>
        </div>
        {!isEmpty && (
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-xl font-bold text-[#0a0a0a]">{fmtHour(peakHourIdx)}</p>
              <p className="text-[10px] text-[#a3a3a3]">peak hour · {hourlyTotals[peakHourIdx]} actions</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-[#0a0a0a]">{DAY_LABELS[peakDayIdx]}</p>
              <p className="text-[10px] text-[#a3a3a3]">busiest day · {dailyTotals[peakDayIdx]} actions</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-[#0a0a0a]">{activeHrs}</p>
              <p className="text-[10px] text-[#a3a3a3]">active hours</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-[#0a0a0a]">{fmt(total)}</p>
              <p className="text-[10px] text-[#a3a3a3]">total actions</p>
            </div>
          </div>
        )}
      </div>

      {isEmpty ? (
        <p className="text-xs text-[#a3a3a3] text-center py-8">No engagement data yet</p>
      ) : (
        <>
          {/* Hour axis */}
          <div className="flex ml-10 mb-1.5 gap-0.5">
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="flex-1 text-center overflow-hidden">
                {h % 6 === 0 || h === 23
                  ? <span className="text-[9px] text-[#a3a3a3]">{fmtHour(h)}</span>
                  : null}
              </div>
            ))}
          </div>

          {/* Heatmap rows */}
          <div className="space-y-0.5">
            {rows.map(({ label, cells }, rowIdx) => (
              <motion.div
                key={label}
                className="flex items-center gap-2"
                initial={{ opacity: 0, x: -6 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-20px" }}
                transition={{ type: "spring", stiffness: 380, damping: 32, delay: rowIdx * 0.05 }}
              >
                <span className="text-[10px] text-[#a3a3a3] w-8 flex-shrink-0 text-right">{label}</span>
                <div className="flex flex-1 gap-0.5">
                  {cells.map(({ hour, count }) => {
                    const intensity = count === 0 ? 0 : (count / maxCount) * 0.82 + 0.18;
                    const bg = count === 0 ? "#f0f0f0" : `rgba(244,68,68,${intensity.toFixed(2)})`;
                    return (
                      <div
                        key={hour}
                        className="flex-1 rounded-[2px] cursor-default"
                        style={{ height: 20, backgroundColor: bg }}
                        title={`${label} ${fmtHour(hour)}: ${count}`}
                      />
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-1.5 mt-4 ml-10">
            <span className="text-[9px] text-[#a3a3a3] mr-0.5">Less</span>
            {[0, 0.2, 0.42, 0.64, 0.82].map((v, i) => (
              <div
                key={i}
                className="w-3.5 h-3.5 rounded-[2px]"
                style={{ backgroundColor: v === 0 ? "#f0f0f0" : `rgba(244,68,68,${v + 0.18})` }}
              />
            ))}
            <span className="text-[9px] text-[#a3a3a3] ml-0.5">More</span>
          </div>
        </>
      )}
    </div>
  );
}

function ActionComparison({ rows }: { rows: { action: string; current: number; prev: number; change: number }[] }) {
  const maxVal = Math.max(1, ...rows.map(r => Math.max(r.current, r.prev)));
  const COLOR: Record<string, string> = { Likes: "#F44444", Comments: "#8B5CF6", Shares: "#F59E0B" };
  const isEmpty = !rows.some(r => r.current > 0 || r.prev > 0);
  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white p-5">
      <p className="text-sm font-semibold text-[#0a0a0a] mb-0.5">vs prior period</p>
      <p className="text-xs text-[#a3a3a3] mb-4">Same length window before this one</p>
      {isEmpty ? (
        <p className="text-xs text-[#a3a3a3] text-center py-6">No data yet</p>
      ) : (
        <div className="space-y-4">
          {rows.map(r => {
            const color   = COLOR[r.action] ?? "#737373";
            const currPct = (r.current / maxVal) * 100;
            const prevPct = (r.prev / maxVal) * 100;
            const up      = r.change >= 0;
            return (
              <div key={r.action}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-[#0a0a0a]">{r.action}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#0a0a0a]">{fmt(r.current)}</span>
                    {r.prev > 0 && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${up ? "bg-[#22c55e]/10 text-[#22c55e]" : "bg-[#F44444]/10 text-[#F44444]"}`}>
                        {up ? "+" : ""}{r.change}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="relative h-3 bg-[#f5f5f5] rounded-full overflow-hidden">
                  {r.prev > 0 && (
                    <motion.div className="absolute inset-y-0 left-0 rounded-full opacity-30"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${prevPct}%` }}
                      viewport={{ once: true, margin: "-20px" }}
                      transition={{ type: "spring", stiffness: 220, damping: 30 }}
                      style={{ backgroundColor: color }} />
                  )}
                  <motion.div className="absolute inset-y-0 left-0 rounded-full"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${currPct}%` }}
                    viewport={{ once: true, margin: "-20px" }}
                    transition={{ type: "spring", stiffness: 220, damping: 30, delay: 0.05 }}
                    style={{ backgroundColor: color }} />
                </div>
                {r.prev > 0 && (
                  <p className="text-[10px] text-[#a3a3a3] mt-1">Prior: {fmt(r.prev)}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TypePerformance({ rows }: { rows: { type: string; impressions: number; engagements: number; rate: number }[] }) {
  const maxImp = Math.max(1, ...rows.map(r => r.impressions));
  const isEmpty = rows.length === 0;
  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white p-5">
      <p className="text-sm font-semibold text-[#0a0a0a] mb-0.5">Post type performance</p>
      <p className="text-xs text-[#a3a3a3] mb-4">Impressions and engagement rate by type</p>
      {isEmpty ? (
        <p className="text-xs text-[#a3a3a3] text-center py-6">No data yet</p>
      ) : (
        <div className="divide-y divide-[#f5f5f5]">
          {rows.map(r => {
            const barPct = (r.impressions / maxImp) * 100;
            return (
              <div key={r.type} className="py-3 first:pt-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-[#0a0a0a]">{r.type}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[#a3a3a3]">{fmt(r.impressions)} views</span>
                    <span className="text-xs font-semibold" style={{ color: r.rate > 5 ? "#22c55e" : r.rate > 2 ? "#F59E0B" : "#737373" }}>
                      {r.rate}% eng
                    </span>
                  </div>
                </div>
                <div className="h-1.5 bg-[#f5f5f5] rounded-full overflow-hidden">
                  <motion.div className="h-full rounded-full bg-[#3B82F6]"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${barPct}%` }}
                    viewport={{ once: true, margin: "-20px" }}
                    transition={{ type: "spring", stiffness: 260, damping: 28 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Role engagement breakdown (consumer + creator) ───
function RoleEngagementPanel({
  roleEngagement,
  roleContentPerformance,
}: {
  roleEngagement: any[];
  roleContentPerformance: any[];
}) {
  const maxConsumer = Math.max(1, ...roleEngagement.map((r: any) => r.total));
  const maxCreator  = Math.max(1, ...roleContentPerformance.map((r: any) => r.impressions));

  const springBar = (pct: number, idx: number) => ({
    initial: { width: 0 },
    whileInView: { width: `${pct}%` },
    viewport: { once: true, margin: "-20px" },
    transition: { type: "spring" as const, stiffness: 260, damping: 28, delay: idx * 0.05 },
  });

  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
      <div className="px-6 pt-6 pb-5 border-b border-[#f5f5f5]">
        <p className="text-base font-semibold text-[#0a0a0a]">Engagement by role</p>
        <p className="text-sm text-[#a3a3a3] mt-0.5">who engages and whose content performs</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#f5f5f5]">
        {/* Consumer side */}
        <div className="p-6">
          <p className="text-[11px] uppercase tracking-wider text-[#a3a3a3] mb-5">Who engages</p>
          {roleEngagement.map((r: any, idx: number) => {
            const meta   = ROLE_META[r.role as string] ?? { label: r.role, color: "#737373", sub: "" };
            const barPct = maxConsumer > 0 ? (r.total / maxConsumer) * 100 : 0;
            return (
              <div key={r.role} className="flex items-center gap-4 py-4 border-b border-[#f5f5f5] last:border-0">
                <div className="w-[110px] flex-shrink-0 flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
                  <span className="text-sm font-medium text-[#0a0a0a] truncate">{meta.label}</span>
                </div>
                <div className="flex-1 h-1.5 bg-[#f5f5f5] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: meta.color }}
                    {...springBar(barPct, idx)}
                  />
                </div>
                <div className="flex items-center gap-5 flex-shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold text-[#0a0a0a]">{fmt(r.likes)}</p>
                    <p className="text-[10px] text-[#a3a3a3]">likes</p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold text-[#0a0a0a]">{fmt(r.comments)}</p>
                    <p className="text-[10px] text-[#a3a3a3]">cmts</p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold text-[#0a0a0a]">{fmt(r.shares)}</p>
                    <p className="text-[10px] text-[#a3a3a3]">shrs</p>
                  </div>
                  <div className="text-right w-16">
                    <p className="text-sm font-bold text-[#0a0a0a]">{fmt(r.total)}</p>
                    <p className="text-[10px] text-[#a3a3a3]">{r.rate}% rate</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Creator side */}
        <div className="p-6">
          <p className="text-[11px] uppercase tracking-wider text-[#a3a3a3] mb-5">Whose content performs</p>
          {roleContentPerformance.map((r: any, idx: number) => {
            const meta   = ROLE_META[r.role as string] ?? { label: r.role, color: "#737373", sub: "" };
            const barPct = maxCreator > 0 ? (r.impressions / maxCreator) * 100 : 0;
            return (
              <div key={r.role} className="flex items-center gap-4 py-4 border-b border-[#f5f5f5] last:border-0">
                <div className="w-[110px] flex-shrink-0 flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
                  <span className="text-sm font-medium text-[#0a0a0a] truncate">{meta.label}</span>
                </div>
                <div className="flex-1 h-1.5 bg-[#f5f5f5] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: meta.color + "cc" }}
                    {...springBar(barPct, idx)}
                  />
                </div>
                <div className="flex items-center gap-5 flex-shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold text-[#0a0a0a]">{fmt(r.posts)}</p>
                    <p className="text-[10px] text-[#a3a3a3]">posts</p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold text-[#0a0a0a]">{fmt(r.impressions)}</p>
                    <p className="text-[10px] text-[#a3a3a3]">imps</p>
                  </div>
                  <div className="text-right w-16">
                    <p className="text-sm font-semibold text-[#0a0a0a]">{r.avgImpressions}</p>
                    <p className="text-[10px] text-[#a3a3a3]">avg/post</p>
                  </div>
                  <div className="text-right w-12">
                    <p className="text-sm font-bold text-[#0a0a0a]">{r.rate}%</p>
                    <p className="text-[10px] text-[#a3a3a3]">eng rate</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Engagement tab ───
function EngagementTab({ days }: { days: number | null }) {
  const { data, loading, error } = useTab(api.getAdminEngagement, days);
  if (loading && !data) return <Skeleton />;
  if (error) return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white p-6 text-center">
      <p className="text-sm font-medium text-[#0a0a0a] mb-1">Failed to load engagement data</p>
      <p className="text-xs text-[#a3a3a3] font-mono">{error}</p>
    </div>
  );
  const g = data?.signals;

  const fadeUp = (delay: number) => ({
    initial: { opacity: 0, y: 14 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-40px" },
    transition: { type: "spring" as const, stiffness: 380, damping: 32, delay },
  });

  return (
    <div className="space-y-5">
      {/* KPI row 1: raw action counts */}
      <motion.div className="grid grid-cols-2 lg:grid-cols-4 gap-4" {...fadeUp(0)}>
        <StatCard label="Likes"          value={fmt(g?.totalLikes    ?? 0)} sub={`of ${fmt(data?.totalImpressions ?? 0)} impressions`} icon={TrendingUp}        accent="#F44444" />
        <StatCard label="Comments"       value={fmt(g?.totalComments ?? 0)} sub="replies in period"                                   icon={FileText}          accent="#8B5CF6" />
        <StatCard label="Shares"         value={fmt(g?.totalShares   ?? 0)} sub="shares in period"                                   icon={Users}             accent="#F59E0B" />
        <StatCard label="Follow-through" value={`${g?.followThroughRate ?? 0}%`} sub="author follows / impression"                  icon={UserPlus}          accent="#22c55e" />
      </motion.div>

      {/* KPI row 2: quality signals */}
      <motion.div className="grid grid-cols-2 lg:grid-cols-4 gap-4" {...fadeUp(0.05)}>
        <StatCard label="Engagement rate" value={`${g?.engagementRate ?? 0}%`}  sub="(likes+comments+shares) / impressions" icon={Gauge}            accent="#22c55e" />
        <StatCard label="Avg dwell"       value={`${g?.avgDwellSeconds ?? 0}s`} sub="avg time spent on post"                icon={Clock}            accent="#3B82F6" />
        <StatCard label="Scroll-past"     value={fmt(g?.totalScrollPast ?? 0)}  sub="users who scrolled past"              icon={MousePointerClick} accent="#F44444" />
        <StatCard label="Avg Albiz score" value={g?.avgScore ?? 0}              sub={`${fmt(g?.scoredPosts ?? 0)} posts scored`} icon={TrendingUp}  accent="#F59E0B" />
      </motion.div>

      {/* Trend chart */}
      <motion.div {...fadeUp(0.1)}>
        <EngagementTrendChart timeSeries={data?.timeSeries ?? []} />
      </motion.div>

      {/* Peak hours — full width */}
      <motion.div {...fadeUp(0.13)}>
        <PeakHoursPanel heatmapData={data?.heatmapData ?? []} />
      </motion.div>

      {/* Row: action comparison + dwell distribution */}
      <motion.div className="grid grid-cols-1 lg:grid-cols-2 gap-4" {...fadeUp(0.17)}>
        <ActionComparison rows={data?.actionComparison ?? []} />
        <Panel title="Reading depth" sub="dwell time distribution">
          <DistBars items={data?.dwellDistribution ?? []} />
        </Panel>
      </motion.div>

      {/* Row: post type + Albiz score distribution + feed position */}
      <motion.div className="grid grid-cols-1 lg:grid-cols-3 gap-4" {...fadeUp(0.21)}>
        <TypePerformance rows={data?.typeBreakdown ?? []} />
        <Panel title="Albiz score distribution" sub="posts grouped by score">
          <DistBars items={data?.scoreDistribution ?? []} />
        </Panel>
        <Panel title="Feed position" sub="where impressions land">
          <DistBars items={data?.positionBuckets ?? []} />
        </Panel>
      </motion.div>

      {/* Role engagement breakdown */}
      <motion.div {...fadeUp(0.25)}>
        <RoleEngagementPanel
          roleEngagement={data?.roleEngagement ?? []}
          roleContentPerformance={data?.roleContentPerformance ?? []}
        />
      </motion.div>
    </div>
  );
}

// ─── Publish volume chart (plain counts, no dollar formatting) ───
function PublishVolumeChart({ data }: { data: { date: string; value: number }[] }) {
  const total   = data.reduce((s, d) => s + d.value, 0);
  const vals    = data.map(d => d.value);
  const avg     = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  const hasData = data.some(d => d.value > 0);

  const tickFmt = (v: number) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000   ? `${(v / 1_000).toFixed(0)}k`
    : `${v}`;

  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <p className="text-xs text-[#a3a3a3] mb-1">Posts published</p>
        <div className="flex items-baseline gap-2">
          <p className="text-[30px] font-bold text-[#0a0a0a] tracking-tight leading-none">{fmt(total)}</p>
          <p className="text-sm text-[#a3a3a3]">in period</p>
        </div>
      </div>

      {!hasData ? (
        <div className="h-[200px] flex items-center justify-center">
          <p className="text-sm text-[#a3a3a3]">No posts published in this period</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 8, right: 20, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id="pvol-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#8B5CF6" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="date" axisLine={false} tickLine={false}
              tick={{ fontSize: 11, fill: "#a3a3a3" }} dy={8} interval="preserveStartEnd" />
            <YAxis axisLine={false} tickLine={false}
              tick={{ fontSize: 11, fill: "#a3a3a3" }} width={36} tickFormatter={tickFmt}
              allowDecimals={false} tickCount={5} />
            <Tooltip
              formatter={(v: any) => [`${v}`, "posts"]}
              contentStyle={{ borderRadius: 10, border: "1px solid #e5e5e5", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}
              labelStyle={{ fontSize: 11, color: "#0a0a0a", fontWeight: 600 }}
              itemStyle={{ fontSize: 11, color: "#8B5CF6" }}
              cursor={false}
            />
            {avg > 0 && (
              <ReferenceLine y={avg} stroke="#e5e5e5" strokeDasharray="4 3"
                label={{ value: "avg", position: "insideTopRight", fontSize: 10, fill: "#c5c5c5", dy: -6 }} />
            )}
            <Area type="monotone" dataKey="value" name="Posts"
              stroke="#8B5CF6" strokeWidth={2} fill="url(#pvol-grad)" dot={false}
              activeDot={{ r: 4, fill: "#8B5CF6", stroke: "white", strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ─── Content ───
function ContentTab({ days }: { days: number | null }) {
  const { data, loading, error } = useTab(api.getAdminContent, days);
  if (loading && !data) return <Skeleton />;
  if (error) return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white p-6 text-center">
      <p className="text-sm font-medium text-[#0a0a0a] mb-1">Failed to load content data</p>
      <p className="text-xs text-[#a3a3a3] font-mono">{error}</p>
    </div>
  );

  const vol        = (data?.publishVolume ?? []).map((d: any) => ({ date: d.date, value: d.count }));
  const maxTagCount = Math.max(1, ...(data?.tagBreakdown ?? []).map((t: any) => t.count));
  const maxAuthorImp = Math.max(1, ...(data?.topAuthors ?? []).map((a: any) => a.impressions));

  const fadeUp = (delay: number) => ({
    initial: { opacity: 0, y: 14 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-40px" },
    transition: { type: "spring" as const, stiffness: 380, damping: 32, delay },
  });

  return (
    <div className="space-y-5">
      {/* Row 1: volume + engagement KPIs */}
      <motion.div className="grid grid-cols-2 lg:grid-cols-4 gap-4" {...fadeUp(0)}>
        <StatCard label="Total posts"    value={fmt(data?.totalPosts ?? 0)}       sub={`${fmt(data?.postsInPeriod ?? 0)} in this period`}            icon={FileText}  accent="#3B82F6" />
        <StatCard label="Impressions"    value={fmt(data?.totalImpressions ?? 0)} sub="post views in period"                                          icon={Eye}       accent="#F44444" />
        <StatCard label="Engagement"     value={`${data?.avgEngagementRate ?? 0}%`} sub={`${fmt((data?.totalLikes ?? 0) + (data?.totalComments ?? 0) + (data?.totalShares ?? 0))} interactions`} icon={TrendingUp} accent="#8B5CF6" />
        <StatCard label="Flagged"        value={fmt(data?.flaggedCount ?? 0)}     sub={`${data?.flaggedRate ?? 0}% of all posts`}                     icon={Flag}      accent="#F44444" />
      </motion.div>

      {/* Row 2: content health */}
      <motion.div className="grid grid-cols-2 lg:grid-cols-4 gap-4" {...fadeUp(0.05)}>
        <StatCard label="New this period"   value={fmt(data?.postsInPeriod ?? 0)}   change={data?.postsInPeriodChange}  sub="posts published"          icon={FileText}  accent="#22c55e" />
        <StatCard label="Avg views / post"  value={fmt(data?.avgViewsPerPost ?? 0)} sub="across posts with impressions"                                icon={Eye}       accent="#3B82F6" />
        <StatCard label="Avg dwell"         value={`${data?.avgDwell ?? 0}s`}       sub="time spent per view"                                         icon={Clock}     accent="#F59E0B" />
        <StatCard label="Zero views"        value={fmt(data?.postsWithZeroViews ?? 0)} sub="posts in period with no impressions"                      icon={FileText}  accent="#a3a3a3" />
      </motion.div>

      {/* Publish volume chart */}
      <motion.div {...fadeUp(0.1)}>
        <PublishVolumeChart data={vol} />
      </motion.div>

      {/* Row 3: type breakdown + tag breakdown */}
      <motion.div className="grid grid-cols-1 lg:grid-cols-2 gap-4" {...fadeUp(0.14)}>
        {/* Type performance */}
        <div className="rounded-xl border border-[#e5e5e5] bg-white p-5">
          <p className="text-sm font-semibold text-[#0a0a0a] mb-0.5">By type</p>
          <p className="text-xs text-[#a3a3a3] mb-4">posts published in period</p>
          {!(data?.typeBreakdown?.length) ? (
            <p className="text-xs text-[#a3a3a3] text-center py-6">No posts in this period</p>
          ) : (
            <div className="divide-y divide-[#f5f5f5]">
              {(data.typeBreakdown as any[]).map((t: any, idx: number) => {
                const maxImp = Math.max(1, ...(data.typeBreakdown as any[]).map((x: any) => x.impressions));
                const barPct = (t.impressions / maxImp) * 100;
                return (
                  <div key={t.type} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-[#0a0a0a]">{t.type}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-[#a3a3a3] tabular-nums">{fmt(t.count)} posts</span>
                        <span className="text-xs text-[#a3a3a3] tabular-nums">{fmt(t.impressions)} views</span>
                        <span className="text-xs font-semibold tabular-nums"
                          style={{ color: t.engRate > 5 ? "#22c55e" : t.engRate > 2 ? "#F59E0B" : "#737373" }}>
                          {t.engRate}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-[#f5f5f5] rounded-full overflow-hidden">
                      <motion.div className="h-full rounded-full bg-[#3B82F6]"
                        initial={{ width: 0 }}
                        whileInView={{ width: `${barPct}%` }}
                        viewport={{ once: true, margin: "-20px" }}
                        transition={{ type: "spring", stiffness: 260, damping: 28, delay: idx * 0.06 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tag breakdown */}
        <div className="rounded-xl border border-[#e5e5e5] bg-white p-5">
          <p className="text-sm font-semibold text-[#0a0a0a] mb-0.5">Top tags</p>
          <p className="text-xs text-[#a3a3a3] mb-4">from posts published in period</p>
          {!(data?.tagBreakdown?.length) ? (
            <p className="text-xs text-[#a3a3a3] text-center py-6">No tagged posts in this period</p>
          ) : (
            <div className="divide-y divide-[#f5f5f5]">
              {(data.tagBreakdown as any[]).map((t: any) => (
                <HBar key={t.tag} label={`#${t.tag}`} count={t.count} max={maxTagCount} />
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Top authors */}
      <motion.div {...fadeUp(0.18)}>
        <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-[#f5f5f5] flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#0a0a0a]">Top authors</p>
              <p className="text-xs text-[#a3a3a3] mt-0.5">by views in period — all posts</p>
            </div>
            <span className="text-xs text-[#a3a3a3] tabular-nums">{(data?.topAuthors ?? []).length} authors</span>
          </div>
          {!(data?.topAuthors?.length) ? (
            <p className="text-xs text-[#a3a3a3] text-center py-10">No author data in this period</p>
          ) : (
            <>
              <div className="flex items-center gap-4 px-5 py-2.5 bg-[#fafafa] border-b border-[#f5f5f5]">
                <span className="w-5 flex-shrink-0" />
                <span className="flex-1 text-[10px] text-[#a3a3a3] uppercase tracking-wider">Author</span>
                <span className="w-14 text-right text-[10px] text-[#a3a3a3] uppercase tracking-wider hidden sm:block">Posts</span>
                <span className="w-16 text-right text-[10px] text-[#a3a3a3] uppercase tracking-wider hidden sm:block">Views</span>
                <span className="w-12 text-right text-[10px] text-[#a3a3a3] uppercase tracking-wider">Score</span>
              </div>
              <div className="divide-y divide-[#f5f5f5]">
                {(data.topAuthors as any[]).map((a: any, i: number) => {
                  const barPct = (a.impressions / maxAuthorImp) * 100;
                  const roleLabel = a.role === "CIRCLE" ? "Circle" : a.role === "AUTHOR" ? "Author" : a.role === "ADMIN" ? "Admin" : null;
                  const roleColor = a.role === "CIRCLE" ? { bg: "#FFF0F0", text: "#F44444" } : a.role === "AUTHOR" ? { bg: "#F5F3FF", text: "#8B5CF6" } : { bg: "#EEF2FF", text: "#4F46E5" };
                  return (
                    <div key={a.handle} className="flex items-center gap-4 px-5 py-3.5">
                      <span className="text-xs text-[#a3a3a3] w-5 flex-shrink-0 tabular-nums">{i + 1}</span>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-[#f5f5f5] flex items-center justify-center flex-shrink-0 overflow-hidden text-xs font-semibold text-[#525252]">
                          {a.avatar
                            ? <img src={a.avatar} alt="" className="w-8 h-8 object-cover" />
                            : (a.name || "?").charAt(0).toUpperCase()
                          }
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm text-[#0a0a0a] truncate">{a.name || "Unknown"}</p>
                            <span className="text-[10px] text-[#a3a3a3] flex-shrink-0">@{a.handle}</span>
                            {roleLabel && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                                style={{ background: roleColor.bg, color: roleColor.text }}>
                                {roleLabel}
                              </span>
                            )}
                          </div>
                          <div className="h-1 bg-[#f5f5f5] rounded-full overflow-hidden">
                            <motion.div className="h-full rounded-full bg-[#F44444]"
                              initial={{ width: 0 }}
                              whileInView={{ width: `${barPct}%` }}
                              viewport={{ once: true, margin: "-20px" }}
                              transition={{ type: "spring", stiffness: 260, damping: 28, delay: i * 0.04 }} />
                          </div>
                        </div>
                      </div>
                      <span className="w-14 text-right text-xs text-[#525252] tabular-nums hidden sm:block">{a.posts}</span>
                      <span className="w-16 text-right text-xs font-semibold text-[#0a0a0a] tabular-nums hidden sm:block">{fmt(a.impressions)}</span>
                      <span className="w-12 text-right"><ScoreBadge score={a.avgScore} /></span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* Top Circle members */}
      <motion.div {...fadeUp(0.2)}>
        <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-[#f5f5f5] flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#0a0a0a]">Top Circle members</p>
              <p className="text-xs text-[#a3a3a3] mt-0.5">{fmt(data?.totalCircleMembers ?? 0)} members · sorted by activity</p>
            </div>
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-[#F44444]/10 text-[#F44444]">Circle</span>
          </div>
          {!(data?.topCircleMembers?.length) ? (
            <p className="text-xs text-[#a3a3a3] text-center py-10">No Circle members yet</p>
          ) : (
            <>
              <div className="flex items-center gap-4 px-5 py-2.5 bg-[#fafafa] border-b border-[#f5f5f5]">
                <span className="w-5 flex-shrink-0" />
                <span className="flex-1 text-[10px] text-[#a3a3a3] uppercase tracking-wider">Member</span>
                <span className="w-14 text-right text-[10px] text-[#a3a3a3] uppercase tracking-wider hidden sm:block">Posts</span>
                <span className="w-16 text-right text-[10px] text-[#a3a3a3] uppercase tracking-wider hidden sm:block">Views</span>
                <span className="w-12 text-right text-[10px] text-[#a3a3a3] uppercase tracking-wider">Score</span>
              </div>
              <div className="divide-y divide-[#f5f5f5]">
                {(data.topCircleMembers as any[]).map((m: any, i: number) => {
                  const maxImp = Math.max(1, ...(data.topCircleMembers as any[]).map((x: any) => x.impressions));
                  const barPct = (m.impressions / maxImp) * 100;
                  return (
                    <div key={m.id ?? m.handle} className="flex items-center gap-4 px-5 py-3.5">
                      <span className="text-xs text-[#a3a3a3] w-5 flex-shrink-0 tabular-nums">{i + 1}</span>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-[#f5f5f5] flex items-center justify-center flex-shrink-0 overflow-hidden text-xs font-semibold text-[#525252]">
                          {m.avatar
                            ? <img src={m.avatar} alt="" className="w-8 h-8 object-cover" />
                            : (m.name || "?").charAt(0).toUpperCase()
                          }
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm text-[#0a0a0a] truncate">{m.name || "Unknown"}</p>
                            <span className="text-[10px] text-[#a3a3a3] flex-shrink-0">@{m.handle}</span>
                          </div>
                          <div className="h-1 bg-[#f5f5f5] rounded-full overflow-hidden">
                            <motion.div className="h-full rounded-full bg-[#F44444]"
                              initial={{ width: 0 }}
                              whileInView={{ width: `${barPct}%` }}
                              viewport={{ once: true, margin: "-20px" }}
                              transition={{ type: "spring", stiffness: 260, damping: 28, delay: i * 0.04 }} />
                          </div>
                        </div>
                      </div>
                      <span className="w-14 text-right text-xs text-[#525252] tabular-nums hidden sm:block">{m.posts}</span>
                      <span className="w-16 text-right text-xs font-semibold text-[#0a0a0a] tabular-nums hidden sm:block">{fmt(m.impressions)}</span>
                      <span className="w-12 text-right"><ScoreBadge score={m.avgScore} /></span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* Top posts by Albiz score */}
      <motion.div {...fadeUp(0.25)}>
        <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-[#f5f5f5]">
            <p className="text-sm font-semibold text-[#0a0a0a]">Top posts by Albiz score</p>
            <p className="text-xs text-[#a3a3a3] mt-0.5">ranked across the whole platform</p>
          </div>
          {!data?.topPosts?.length ? (
            <p className="text-xs text-[#a3a3a3] text-center py-10">No scored posts in this period</p>
          ) : (
            <div className="divide-y divide-[#f5f5f5]">
              {/* Column headers */}
              <div className="flex items-center gap-4 px-5 py-2.5 bg-[#fafafa]">
                <span className="w-5 flex-shrink-0" />
                <span className="flex-1 text-[10px] text-[#a3a3a3] uppercase tracking-wider">Post</span>
                <span className="w-16 text-right text-[10px] text-[#a3a3a3] uppercase tracking-wider hidden lg:block">Views</span>
                <span className="w-14 text-right text-[10px] text-[#a3a3a3] uppercase tracking-wider hidden lg:block">Dwell</span>
                <span className="w-14 text-right text-[10px] text-[#a3a3a3] uppercase tracking-wider hidden lg:block">Eng %</span>
                <span className="w-12 text-right text-[10px] text-[#a3a3a3] uppercase tracking-wider">Score</span>
              </div>
              {(data.topPosts as any[]).map((p: any, i: number) => (
                <div key={p.id} className="flex items-center gap-4 px-5 py-3.5">
                  <span className="text-xs text-[#a3a3a3] w-5 flex-shrink-0 tabular-nums">{i + 1}</span>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {p.image
                      ? <img src={p.image} alt="" className="w-8 h-8 rounded-md object-cover flex-shrink-0" />
                      : <div className="w-8 h-8 rounded-md bg-[#f5f5f5] flex items-center justify-center flex-shrink-0">
                          <FileText className="w-3.5 h-3.5 text-[#a3a3a3]" />
                        </div>
                    }
                    <div className="min-w-0">
                      <p className="text-sm text-[#0a0a0a] truncate">{p.title}</p>
                      <p className="text-[11px] text-[#a3a3a3] truncate">@{p.authorHandle}</p>
                    </div>
                  </div>
                  <span className="w-16 text-right text-xs text-[#525252] tabular-nums hidden lg:block">{fmt(p.impressions)}</span>
                  <span className="w-14 text-right text-xs text-[#525252] tabular-nums hidden lg:block">{p.avgDwell}s</span>
                  <span className="w-14 text-right text-xs text-[#525252] tabular-nums hidden lg:block">{p.engagementRate}%</span>
                  <span className="w-12 text-right"><ScoreBadge score={p.xScore} /></span>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Audience ───
function SignupTrendChart({ data }: { data: { date: string; count: number }[] }) {
  const total   = data.reduce((s, d) => s + d.count, 0);
  const vals    = data.map(d => d.count);
  const avg     = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  const hasData = data.some(d => d.count > 0);
  const tickFmt = (v: number) => v >= 1_000 ? `${(v / 1_000).toFixed(0)}k` : `${v}`;
  const chartData = data.map(d => ({ ...d, value: d.count }));
  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <p className="text-xs text-[#a3a3a3] mb-1">New signups</p>
        <div className="flex items-baseline gap-2">
          <p className="text-[30px] font-bold text-[#0a0a0a] tracking-tight leading-none">{fmt(total)}</p>
          <p className="text-sm text-[#a3a3a3]">in period</p>
        </div>
      </div>
      {!hasData ? (
        <div className="h-[200px] flex items-center justify-center">
          <p className="text-sm text-[#a3a3a3]">No signups in this period</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 8, right: 20, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id="st-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#22c55e" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="date" axisLine={false} tickLine={false}
              tick={{ fontSize: 11, fill: "#a3a3a3" }} dy={8} interval="preserveStartEnd" />
            <YAxis axisLine={false} tickLine={false}
              tick={{ fontSize: 11, fill: "#a3a3a3" }} width={36} tickFormatter={tickFmt}
              allowDecimals={false} tickCount={5} />
            <Tooltip
              formatter={(v: any) => [`${v}`, "signups"]}
              contentStyle={{ borderRadius: 10, border: "1px solid #e5e5e5", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}
              labelStyle={{ fontSize: 11, color: "#0a0a0a", fontWeight: 600 }}
              itemStyle={{ fontSize: 11, color: "#22c55e" }}
              cursor={false}
            />
            {avg > 0 && (
              <ReferenceLine y={avg} stroke="#e5e5e5" strokeDasharray="4 3"
                label={{ value: "avg", position: "insideTopRight", fontSize: 10, fill: "#c5c5c5", dy: -6 }} />
            )}
            <Area type="monotone" dataKey="value" name="Signups"
              stroke="#22c55e" strokeWidth={2} fill="url(#st-grad)" dot={false}
              activeDot={{ r: 4, fill: "#22c55e", stroke: "white", strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function AudienceTab({ days }: { days: number | null }) {
  const { data, loading, error } = useTab(api.getAdminAudience, days);
  if (loading && !data) return <Skeleton />;
  if (error) return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white p-6 text-center">
      <p className="text-sm font-medium text-[#0a0a0a] mb-1">Failed to load audience data</p>
      <p className="text-xs text-[#a3a3a3] font-mono">{error}</p>
    </div>
  );

  const growthData  = (data?.userGrowth ?? []).map((m: any) => ({ date: m.month, value: m.cumulative }));
  const trendData   = (data?.signupTrend ?? []).map((d: any) => ({ date: d.date, count: d.count }));
  const maxCountry  = data?.topCountries?.[0]?.count ?? 1;
  const maxRole     = Math.max(1, ...(data?.newByRole ?? []).map((r: any) => r.count));

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Total users"  value={fmt(data?.totalUsers ?? 0)}           icon={Users}   accent="#3B82F6" />
        <StatCard label="New users"    value={fmt(data?.newUsers ?? 0)} change={data?.newUsersChange} sub="in period" icon={UserPlus} accent="#22c55e" />
        <StatCard label="Daily Active Users"   value={fmt(data?.dau ?? 0)} sub="active last 24h" icon={Activity} accent="#F44444" />
        <StatCard label="Monthly Active Users" value={fmt(data?.mau ?? 0)} sub="active last 30d" icon={Activity} accent="#F59E0B" />
        <StatCard label="Stickiness"   value={`${data?.stickiness ?? 0}%`} sub="DAU / MAU"    icon={Gauge}   accent="#8B5CF6" />
      </div>

      {/* Daily signup trend chart */}
      <SignupTrendChart data={trendData} />

      {/* New users by role breakdown */}
      {(data?.newByRole?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-[#e5e5e5] bg-white p-5">
          <p className="text-sm font-semibold text-[#0a0a0a] mb-0.5">New users by role</p>
          <p className="text-xs text-[#a3a3a3] mb-4">Accounts created in period</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {(data?.newByRole ?? []).map((r: any) => (
              <div key={r.role} className="rounded-lg bg-[#fafafa] border border-[#f0f0f0] px-4 py-3">
                <p className="text-[10px] text-[#a3a3a3] uppercase tracking-wide mb-1">{r.role}</p>
                <p className="text-xl font-bold text-[#0a0a0a]">{fmt(r.count)}</p>
                <div className="mt-2 h-1 bg-[#ebebeb] rounded-full overflow-hidden">
                  <div className="h-full bg-[#22c55e] rounded-full" style={{ width: `${Math.round((r.count / maxRole) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User growth chart — cumulative 6 months */}
      <UserGrowthChart
        data={growthData}
        currentTotal={data?.totalUsers}
        granularity="day"
      />

      {/* Distribution panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="By role" sub="all accounts">
          <DistBars items={(data?.roleBreakdown ?? []).map((r: any) => ({ label: r.role, count: r.count }))} />
        </Panel>
        <Panel title="Top countries" sub="by user count">
          {!data?.topCountries?.length ? <p className="text-xs text-[#a3a3a3] text-center py-6">No data yet</p> : (
            <div className="divide-y divide-[#f5f5f5]">
              {data.topCountries.map((c: any) => <HBar key={c.code} label={c.name} count={c.count} max={maxCountry} flag={flagEmoji(c.code)} />)}
            </div>
          )}
        </Panel>
        <Panel title="Devices" sub="visitor sessions, last 30d">
          {!data?.devices?.length ? <p className="text-xs text-[#a3a3a3] text-center py-6">No data yet</p> : (
            <div>
              {data.devices.map((d: any) => {
                const Icon = DEVICE_ICONS[d.label] ?? Monitor;
                return (
                  <div key={d.label} className="flex items-center gap-3 py-2.5 border-b border-[#f5f5f5] last:border-0">
                    <div className="w-7 h-7 rounded-lg bg-[#f5f5f5] flex items-center justify-center flex-shrink-0">
                      <Icon className="w-3.5 h-3.5 text-[#525252]" />
                    </div>
                    <span className="text-sm text-[#0a0a0a] flex-1">{d.label}</span>
                    <span className="text-xs font-semibold text-[#0a0a0a]">{d.pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Gender" sub="of users who provided it">
          <DistBars items={(data?.genderSplit ?? []).map((x: any) => ({ label: x.label, count: x.count }))} />
        </Panel>
        <Panel title="Age" sub="of users who provided it">
          <DistBars items={(data?.ageRanges ?? []).map((x: any) => ({ label: x.range, count: x.count }))} />
        </Panel>
      </div>
    </div>
  );
}

// ─── Traffic (live visitors — original dashboard) ───
interface AnalyticsData {
  live: number; total24h: number; total7d: number; total30d: number;
  countries: { country: string; countryCode: string; count: number; lat: number; lon: number }[];
  devices: { device: string; count: number }[];
  pages: { page: string; count: number }[];
  hourlyData: { hour: string; count: number }[];
  globePoints: { lat: number; lng: number; size: number; color: string; label: string }[];
  liveRings: { lat: number; lng: number; recency: "hot" | "warm"; count: number; label: string }[];
  liveArcs: { startLat: number; startLng: number; endLat: number; endLng: number; color: string[] }[];
}

function TrafficTab() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/analytics/visitors")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); setLastRefreshed(new Date()); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const maxCountry = data?.countries[0]?.count ?? 1;
  const hourlyChartData = (data?.hourlyData ?? []).map(h => ({ date: h.hour, value: h.count }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#a3a3a3]">Auto-refreshes every 30s · Last updated {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e5e5e5] text-xs text-[#525252] hover:bg-[#fafafa] transition-colors cursor-pointer disabled:opacity-40">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
          Refresh
        </button>
      </div>

      {loading && !data ? <Skeleton /> : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Live now" value={data?.live ?? "—"} sub="visitors in last 30 min" icon={Activity} accent="#22c55e" />
          <StatCard label="Last 24 hours" value={data?.total24h ?? "—"} sub="page views" icon={Users} accent="#3B82F6" />
          <StatCard label="Last 7 days" value={data?.total7d ?? "—"} sub="total visits" icon={Globe} accent="#F59E0B" />
          <StatCard label="Last 30 days" value={data?.total30d ?? "—"} sub="total visits" icon={Monitor} accent="#8B5CF6" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div className="rounded-2xl border border-[#e5e5e5] bg-[#0a0a0a] overflow-hidden relative" style={{ height: 500 }}>
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
            <span className="text-white text-xs font-medium">{data?.live ?? 0} live</span>
          </div>
          <div className="absolute bottom-4 left-4 z-10 flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-[#F44444]" />
              <span className="text-[10px] text-white/70">last 5 min</span>
            </div>
            <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
              <span className="text-[10px] text-white/70">5-30 min</span>
            </div>
          </div>
          <GlobeComponent
            points={data?.globePoints ?? []}
            hotRings={(data?.liveRings ?? []).filter(r => r.recency === "hot") as unknown as {lat:number;lng:number;label:string;color:string;maxR:number;speed:number}[]}
            warmRings={(data?.liveRings ?? []).filter(r => r.recency === "warm") as unknown as {lat:number;lng:number;label:string;color:string;maxR:number;speed:number}[]}
            arcs={data?.liveArcs ?? []}
          />
        </div>

        <div className="rounded-xl border border-[#e5e5e5] bg-white p-5 overflow-y-auto" style={{ maxHeight: 500 }}>
          <p className="text-sm font-semibold text-[#0a0a0a] mb-0.5">Top countries</p>
          <p className="text-xs text-[#a3a3a3] mb-4">Last 30 days</p>
          {loading && !data ? (
            <div className="flex justify-center py-8"><Loader2 className="w-4 h-4 text-[#a3a3a3] animate-spin" /></div>
          ) : !data?.countries.length ? (
            <p className="text-xs text-[#a3a3a3] text-center py-8">Visits will appear here as users browse the app.</p>
          ) : (
            <div className="divide-y divide-[#f5f5f5]">
              {data.countries.map(c => (
                <HBar key={c.countryCode} label={c.country} count={c.count} max={maxCountry} flag={flagEmoji(c.countryCode)} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          {hourlyChartData.length > 0 ? (
            <AdminChart data={hourlyChartData} title="Visits — last 24 hours" />
          ) : (
            <div className="rounded-xl border border-[#e5e5e5] bg-white p-4 flex flex-col">
              <p className="text-sm font-semibold text-[#0a0a0a] mb-4">Visits — last 24 hours</p>
              <div className="flex items-center justify-center flex-1 h-32 text-xs text-[#a3a3a3]">No traffic data yet</div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#e5e5e5] bg-white p-5">
          <p className="text-sm font-semibold text-[#0a0a0a] mb-0.5">Devices</p>
          <p className="text-xs text-[#a3a3a3] mb-4">Last 30 days</p>
          {(data?.devices ?? []).map(d => {
            const Icon = DEVICE_ICONS[d.device] ?? Monitor;
            const pct = data ? Math.round((d.count / (data.total30d || 1)) * 100) : 0;
            return (
              <div key={d.device} className="flex items-center gap-3 py-2.5 border-b border-[#f5f5f5] last:border-0">
                <div className="w-7 h-7 rounded-lg bg-[#f5f5f5] flex items-center justify-center flex-shrink-0">
                  <Icon className="w-3.5 h-3.5 text-[#525252]" />
                </div>
                <span className="text-sm text-[#0a0a0a] flex-1">{d.device}</span>
                <div className="flex items-center gap-2">
                  <Sparkline data={[0, pct / 2, pct]} width={40} height={16} color="#F44444" />
                  <span className="text-xs font-semibold text-[#0a0a0a] w-8 text-right">{pct}%</span>
                </div>
              </div>
            );
          })}
          {!data?.devices.length && <p className="text-xs text-[#a3a3a3] text-center py-6">No data yet</p>}
        </div>
      </div>

      <div className="rounded-xl border border-[#e5e5e5] bg-white p-5">
        <p className="text-sm font-semibold text-[#0a0a0a] mb-0.5">Top pages</p>
        <p className="text-xs text-[#a3a3a3] mb-4">Last 30 days</p>
        {!data?.pages.length ? (
          <p className="text-xs text-[#a3a3a3] text-center py-6">No page data yet</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 divide-y sm:divide-y-0 divide-[#f5f5f5]">
            {data.pages.map((p, i) => (
              <HBar key={p.page} label={p.page || "/"} count={p.count} max={data.pages[0].count} flag={`${i + 1}.`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Posts Tab ───
const POST_SORTS = [
  { key: "score",       label: "Score"    },
  { key: "impressions", label: "Views"    },
  { key: "likes",       label: "Likes"    },
  { key: "comments",    label: "Comments" },
  { key: "date",        label: "Recent"   },
] as const;
type PostSortKey = typeof POST_SORTS[number]["key"];

function PostDetail({ postId, onBack }: { postId: number; onBack: () => void }) {
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    api.getAdminPostDetail(postId)
      .then(d => {
        if (!alive) return;
        if (d?.error) setError(d.error); else setData(d);
      })
      .catch(e => { if (alive) setError(e?.message ?? "Failed"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [postId]);

  if (loading && !data) return <Skeleton />;
  if (error) return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-[#737373] hover:text-[#0a0a0a] transition-colors cursor-pointer">
        <ArrowLeft className="w-3.5 h-3.5" /> All posts
      </button>
      <div className="rounded-xl border border-[#e5e5e5] bg-white p-6 text-center">
        <p className="text-sm text-[#0a0a0a] mb-1">Failed to load post</p>
        <p className="text-xs text-[#a3a3a3] font-mono">{error}</p>
      </div>
    </div>
  );

  const p = data?.post;
  const s = data?.stats;
  const fadeUp = (delay: number) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { type: "spring" as const, stiffness: 380, damping: 32, delay },
  });

  return (
    <div className="space-y-5">
      <motion.div className="flex items-start gap-4" {...fadeUp(0)}>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-[#737373] hover:text-[#0a0a0a] transition-colors mt-1.5 flex-shrink-0 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All posts
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {p?.image
            ? <img src={p.image} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
            : <div className="w-12 h-12 rounded-lg bg-[#f5f5f5] flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-[#a3a3a3]" />
              </div>
          }
          <div className="min-w-0">
            <p className="text-base font-semibold text-[#0a0a0a] truncate">{p?.title || "Untitled"}</p>
            <p className="text-xs text-[#a3a3a3] mt-0.5">@{p?.authorHandle} · {p?.dateLabel} · {p?.type}</p>
            {p?.flagged && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#F44444] bg-[#F44444]/10 px-2 py-0.5 rounded-full mt-1">
                <Flag className="w-2.5 h-2.5" />
                Flagged
              </span>
            )}
          </div>
        </div>
      </motion.div>

      <motion.div className="grid grid-cols-2 lg:grid-cols-4 gap-4" {...fadeUp(0.05)}>
        <StatCard label="Impressions" value={fmt(s?.impressions ?? 0)} icon={Eye}           accent="#3B82F6" />
        <StatCard label="Likes"       value={fmt(s?.likes ?? 0)}       icon={TrendingUp}    accent="#F44444" />
        <StatCard label="Comments"    value={fmt(s?.comments ?? 0)}    icon={FileText}      accent="#8B5CF6" />
        <StatCard label="Shares"      value={fmt(s?.shares ?? 0)}      icon={Users}         accent="#F59E0B" />
      </motion.div>

      <motion.div className="grid grid-cols-2 lg:grid-cols-4 gap-4" {...fadeUp(0.1)}>
        <StatCard label="Avg dwell"   value={`${s?.avgDwell ?? 0}s`}       icon={Clock}             accent="#3B82F6" />
        <StatCard label="Engagement"  value={`${s?.engagementRate ?? 0}%`} icon={Gauge}             accent="#22c55e" />
        <StatCard label="Albiz score" value={s?.xScore ?? 0}               icon={TrendingUp}        accent="#F59E0B" />
        <StatCard label="Scroll-past" value={fmt(s?.scrollPast ?? 0)}      icon={MousePointerClick} accent="#a3a3a3" />
      </motion.div>

      <motion.div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden" {...fadeUp(0.15)}>
        <div className="px-5 pt-5 pb-3">
          <p className="text-sm font-semibold text-[#0a0a0a]">Impressions — last 30 days</p>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data?.timeSeries ?? []} margin={{ top: 4, right: 20, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id="pdImpGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#3B82F6" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="date" axisLine={false} tickLine={false}
              tick={{ fontSize: 11, fill: "#a3a3a3" }} dy={8} interval="preserveStartEnd" />
            <YAxis axisLine={false} tickLine={false}
              tick={{ fontSize: 11, fill: "#a3a3a3" }} width={36} />
            <Tooltip
              contentStyle={{ borderRadius: 10, border: "1px solid #e5e5e5", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}
              labelStyle={{ fontSize: 11, color: "#0a0a0a", fontWeight: 600 }}
              itemStyle={{ fontSize: 11 }}
              cursor={false}
            />
            <Area type="monotone" dataKey="impressions"
              stroke="#3B82F6" strokeWidth={2} fill="url(#pdImpGrad)" dot={false}
              activeDot={{ r: 4, fill: "#3B82F6", stroke: "white", strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      <motion.div {...fadeUp(0.2)}>
        <Panel title="Reading depth" sub="time spent per session">
          <DistBars items={data?.dwellDistribution ?? []} />
        </Panel>
      </motion.div>
    </div>
  );
}

function PostsTab({ days }: { days: number | null }) {
  const [search, setSearch]             = useState("");
  const [debouncedSearch, setDebounced] = useState("");
  const [sort, setSort]                 = useState<PostSortKey>("score");
  const [page, setPage]                 = useState(1);
  const [data, setData]                 = useState<any>(null);
  const [loading, setLoading]           = useState(true);
  const [selectedId, setSelectedId]     = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.getAdminPosts({ days, search: debouncedSearch, sort, page })
      .then(d => { if (alive) setData(d); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
     
  }, [days, debouncedSearch, sort, page]);

  if (selectedId !== null) {
    return <PostDetail postId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  const posts = data?.posts ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  return (
    <div className="space-y-4">
      {/* Search + sort bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#a3a3a3]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search posts or @author…"
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-[#e5e5e5] text-sm text-[#0a0a0a] placeholder:text-[#a3a3a3] focus:outline-none focus:border-[#F44444] transition-colors bg-white"
          />
        </div>
        <div className="flex gap-1">
          {POST_SORTS.map(s => (
            <button key={s.key} onClick={() => { setSort(s.key); setPage(1); }}
              className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              style={sort === s.key ? { backgroundColor: "#F44444", color: "#fff" } : { color: "#737373" }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Posts list */}
      <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
        {/* Column headers */}
        <div className="flex items-center gap-4 px-5 py-3 border-b border-[#f5f5f5]">
          <span className="w-5 flex-shrink-0 text-[10px] text-[#a3a3a3] uppercase tracking-wider tabular-nums">#</span>
          <span className="flex-1 text-[10px] text-[#a3a3a3] uppercase tracking-wider">Post</span>
          <span className="w-16 text-right text-[10px] text-[#a3a3a3] uppercase tracking-wider hidden lg:block">Views</span>
          <span className="w-12 text-right text-[10px] text-[#a3a3a3] uppercase tracking-wider hidden lg:block">Likes</span>
          <span className="w-14 text-right text-[10px] text-[#a3a3a3] uppercase tracking-wider hidden lg:block">Eng %</span>
          <span className="w-12 text-right text-[10px] text-[#a3a3a3] uppercase tracking-wider">Score</span>
          <span className="w-4 flex-shrink-0" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 text-[#a3a3a3] animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <p className="text-xs text-[#a3a3a3] text-center py-16">
            {debouncedSearch ? "No posts match your search" : "No posts in this period"}
          </p>
        ) : (
          <div className="divide-y divide-[#f5f5f5]">
            {posts.map((p: any, i: number) => (
              <div
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#fafafa] cursor-pointer"
              >
                <span className="w-5 flex-shrink-0 text-xs text-[#a3a3a3] tabular-nums">{(page - 1) * 10 + i + 1}</span>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {p.image
                    ? <img src={p.image} alt="" className="w-8 h-8 rounded-md object-cover flex-shrink-0" />
                    : <div className="w-8 h-8 rounded-md bg-[#f5f5f5] flex items-center justify-center flex-shrink-0">
                        <FileText className="w-3.5 h-3.5 text-[#a3a3a3]" />
                      </div>
                  }
                  <div className="min-w-0">
                    <p className="text-sm text-[#0a0a0a] truncate">{p.title || "Untitled"}</p>
                    <p className="text-[11px] text-[#a3a3a3] truncate">@{p.authorHandle} · {p.dateLabel}</p>
                  </div>
                </div>
                <span className="w-16 text-right text-xs text-[#525252] tabular-nums hidden lg:block">{fmt(p.impressions)}</span>
                <span className="w-12 text-right text-xs text-[#525252] tabular-nums hidden lg:block">{fmt(p.likes)}</span>
                <span className="w-14 text-right text-xs text-[#525252] tabular-nums hidden lg:block">{p.engagementRate}%</span>
                <span className="w-12 text-right"><ScoreBadge score={p.xScore} /></span>
                <ChevronRight className="w-3.5 h-3.5 text-[#d4d4d4] flex-shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-[#a3a3a3]">{total} {total === 1 ? "post" : "posts"}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-[#e5e5e5] text-[#525252] hover:bg-[#fafafa] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs text-[#525252] tabular-nums">{page} / {Math.max(1, pages)}</span>
            <button
              onClick={() => setPage(prev => Math.min(pages, prev + 1))}
              disabled={page >= pages}
              className="p-1.5 rounded-lg border border-[#e5e5e5] text-[#525252] hover:bg-[#fafafa] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Referrers Tab ───
function ReferrerRow({ label, count, percentage, max }: { label: string; count: number; percentage: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-xs text-[#0a0a0a] flex-1 truncate">{label}</span>
      <div className="w-24 h-1.5 bg-[#f5f5f5] rounded-full overflow-hidden flex-shrink-0">
        <motion.div className="h-full rounded-full bg-[#F44444]"
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true, margin: "-20px" }}
          transition={{ type: "spring", stiffness: 280, damping: 28 }} />
      </div>
      <span className="text-xs text-[#0a0a0a] w-20 text-right flex-shrink-0 tabular-nums">
        {fmt(count)} <span className="text-[#a3a3a3]">{percentage}%</span>
      </span>
    </div>
  );
}

function ReferrersTab({ days }: { days: number | null }) {
  const { data, loading, error } = useTab((d) => api.getAdminReferrers(d), days);

  if (loading && !data) return <Skeleton />;
  if (error) return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white p-6 text-center">
      <p className="text-sm text-[#0a0a0a] mb-1">Failed to load referrer data</p>
      <p className="text-xs text-[#a3a3a3]">{error}</p>
    </div>
  );

  const sources = data?.sources ?? [];
  const topReferrers = data?.topReferrers ?? [];
  const maxSource = sources[0]?.count ?? 1;
  const maxDomain = topReferrers[0]?.count ?? 1;
  const total = data?.total ?? 0;
  const searchCount = sources.filter((s: any) => ["Google","Bing","DuckDuckGo","Yahoo"].includes(s.source)).reduce((a: number, b: any) => a + b.count, 0);
  const socialCount = sources.filter((s: any) => ["Facebook","Twitter / X","LinkedIn","Instagram","YouTube","Reddit"].includes(s.source)).reduce((a: number, b: any) => a + b.count, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total visits" value={fmt(total)} sub="in selected range" icon={Globe} />
        <StatCard label="Direct" value={`${sources.find((s: any) => s.source === "Direct")?.percentage ?? 0}%`} sub="no referrer" icon={MousePointerClick} accent="#3B82F6" />
        <StatCard label="Search" value={total > 0 ? `${((searchCount / total) * 100).toFixed(1)}%` : "0%"} sub="organic search" icon={Search} accent="#22c55e" />
        <StatCard label="Social" value={total > 0 ? `${((socialCount / total) * 100).toFixed(1)}%` : "0%"} sub="social platforms" icon={Users} accent="#8B5CF6" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        <Panel title="Traffic over time" sub="Direct · Search · Social · Referral">
          {(data?.timeSeries ?? []).every((d: any) => d.direct + d.search + d.social + d.referral === 0) ? (
            <p className="text-xs text-[#a3a3a3] text-center py-12">No referrer data in this period</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data?.timeSeries ?? []} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="refDirect" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="refSearch" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="refSocial" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="refReferral" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#f5f5f5" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#a3a3a3" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "#a3a3a3" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ border: "1px solid #e5e5e5", borderRadius: 10, fontSize: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}
                  itemStyle={{ color: "#0a0a0a" }}
                  labelStyle={{ color: "#737373", fontWeight: 600 }}
                />
                <Area type="monotone" dataKey="direct"   name="Direct"   stroke="#3B82F6" strokeWidth={1.5} fill="url(#refDirect)"   dot={false} />
                <Area type="monotone" dataKey="search"   name="Search"   stroke="#22c55e" strokeWidth={1.5} fill="url(#refSearch)"   dot={false} />
                <Area type="monotone" dataKey="social"   name="Social"   stroke="#8B5CF6" strokeWidth={1.5} fill="url(#refSocial)"   dot={false} />
                <Area type="monotone" dataKey="referral" name="Referral" stroke="#F59E0B" strokeWidth={1.5} fill="url(#refReferral)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Sources">
          {!sources.length ? (
            <p className="text-xs text-[#a3a3a3] text-center py-6">No data yet</p>
          ) : (
            <div className="divide-y divide-[#f5f5f5]">
              {sources.map((s: any) => (
                <ReferrerRow key={s.source} label={s.source} count={s.count} percentage={s.percentage} max={maxSource} />
              ))}
            </div>
          )}
        </Panel>
      </div>

      {topReferrers.length > 0 && (
        <Panel title="Top referring domains">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            {topReferrers.map((r: any) => (
              <ReferrerRow key={r.domain} label={r.domain} count={r.count} percentage={r.percentage} max={maxDomain} />
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

// ─── Activity Tab ───
function ActivityTab() {
  const [q, setQ] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback((params: { q: string; types: string[]; from: string; to: string; page: number }) => {
    setLoading(true);
    api.getAdminActivity({
      q: params.q || undefined,
      eventType: params.types.length ? params.types.join(",") : undefined,
      from: params.from || undefined,
      to: params.to || undefined,
      page: params.page,
    })
      .then(d => { if (d && !d.error) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const params = { q, types: selectedTypes, from, to, page };
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(params), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
   
  }, [q, selectedTypes, from, to, page]);

  const toggleType = (type: string) => {
    setSelectedTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
    setPage(1);
  };

  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[#e5e5e5] bg-white p-4 space-y-4">
        <div className="flex gap-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#a3a3a3]" />
            <input
              value={q}
              onChange={e => { setQ(e.target.value); setPage(1); }}
              placeholder="Search by name, handle, or detail..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[#e5e5e5] bg-[#fafafa] text-[#0a0a0a] placeholder-[#a3a3a3] outline-none focus:border-[#d4d4d4] transition-colors"
            />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <input
              type="date"
              value={from}
              onChange={e => { setFrom(e.target.value); setPage(1); }}
              className="text-xs rounded-lg border border-[#e5e5e5] bg-[#fafafa] text-[#525252] px-2.5 py-2 outline-none focus:border-[#d4d4d4] transition-colors cursor-pointer"
            />
            <span className="text-xs text-[#a3a3a3]">–</span>
            <input
              type="date"
              value={to}
              onChange={e => { setTo(e.target.value); setPage(1); }}
              className="text-xs rounded-lg border border-[#e5e5e5] bg-[#fafafa] text-[#525252] px-2.5 py-2 outline-none focus:border-[#d4d4d4] transition-colors cursor-pointer"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {ALL_EVENT_TYPES.map(type => {
            const active = selectedTypes.includes(type);
            const color = EVENT_COLORS[type] ?? "#737373";
            return (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer"
                style={active ? { backgroundColor: color, color: "#fff" } : { backgroundColor: color + "18", color }}
              >
                {EVENT_LABELS[type]}
              </button>
            );
          })}
          {selectedTypes.length > 0 && (
            <button
              onClick={() => { setSelectedTypes([]); setPage(1); }}
              className="px-2.5 py-1 rounded-full text-[11px] text-[#a3a3a3] hover:text-[#525252] transition-colors cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {loading && !data ? (
        <Skeleton />
      ) : !entries.length ? (
        <div className="rounded-xl border border-[#e5e5e5] bg-white p-8 text-center">
          <p className="text-sm text-[#a3a3a3]">No activity matching your filters</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
          <div className="divide-y divide-[#f5f5f5]">
            {entries.map((entry: any, i: number) => {
              const color = EVENT_COLORS[entry.eventType] ?? "#737373";
              const initials = (entry.userName ?? "?").slice(0, 2).toUpperCase();
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 32, delay: i * 0.02 }}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center text-[11px] font-semibold"
                    style={{ backgroundColor: color + "20" }}>
                    {entry.avatar
                      ? <img src={entry.avatar} alt="" className="w-full h-full object-cover" />
                      : <span style={{ color }}>{initials}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-[#0a0a0a] truncate">{entry.userName ?? "Unknown"}</span>
                      {entry.handle && <span className="text-[11px] text-[#a3a3a3]">@{entry.handle}</span>}
                      <span
                        className="text-[11px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color + "18", color }}
                      >
                        {EVENT_LABELS[entry.eventType] ?? entry.eventType}
                      </span>
                    </div>
                    {entry.meta && (
                      <p className="text-[11px] text-[#737373] mt-0.5 truncate">{entry.meta}</p>
                    )}
                  </div>
                  <span className="text-[11px] text-[#a3a3a3] flex-shrink-0 tabular-nums">{timeAgo(entry.createdAt)}</span>
                </motion.div>
              );
            })}
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#f5f5f5]">
              <span className="text-xs text-[#a3a3a3]">{total.toLocaleString()} total</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className="p-1.5 rounded-lg border border-[#e5e5e5] text-[#525252] hover:bg-[#fafafa] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs text-[#525252] tabular-nums">{page} / {pages}</span>
                <button
                  onClick={() => setPage(p => Math.min(pages, p + 1))}
                  disabled={page >= pages || loading}
                  className="p-1.5 rounded-lg border border-[#e5e5e5] text-[#525252] hover:bg-[#fafafa] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const TABS = ["Overview", "Engagement", "Content", "Audience", "Traffic", "Referrers", "Posts", "Activity"];

export default function AdminAnalyticsPage() {
  const [tab, setTab] = useState(0);
  const [days, setDays] = useState<number | null>(30);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <AdminPillTabs tabs={TABS} activeTab={tab} onTabChange={setTab} />
        {tab !== 4 && tab !== 7 && <RangeTabs value={days} onChange={setDays} />}
      </div>

      {tab === 0 && <OverviewTab days={days} />}
      {tab === 1 && <EngagementTab days={days} />}
      {tab === 2 && <ContentTab days={days} />}
      {tab === 3 && <AudienceTab days={days} />}
      {tab === 4 && <TrafficTab />}
      {tab === 5 && <ReferrersTab days={days} />}
      {tab === 6 && <PostsTab days={days} />}
      {tab === 7 && <ActivityTab />}
    </div>
  );
}
