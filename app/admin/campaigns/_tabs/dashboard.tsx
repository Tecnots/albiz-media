"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Send, Users, CheckCircle, XCircle } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

// ── types ─────────────────────────────────────────────────────────────────────

interface DashStats {
  kpis: {
    total: number; draft: number; scheduled: number; sending: number;
    sent: number; cancelled: number;
    totalRecipients: number; totalDelivered: number; totalFailed: number; deliveryRate: number;
  };
  series: { date: string; value: number }[];
  channelDistribution: { email: number; push: number; inapp: number };
  recent: {
    id: string; name: string; status: string; audienceType: string;
    recipientCount: number; deliveredCount: number; failedCount: number;
    sentAt: string | null; createdAt: string; channels: string[];
    createdBy: { name: string } | null;
  }[];
}

// ── helpers ───────────────────────────────────────────────────────────────────

const RANGES = [
  { label: "7D", days: 7 }, { label: "30D", days: 30 },
  { label: "90D", days: 90 }, { label: "All", days: null },
];

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const STATUS_DOT: Record<string, string> = {
  sent: "#22c55e", sending: "#3B82F6", draft: "#a3a3a3",
  scheduled: "#F59E0B", cancelled: "#F44444",
};

// ── sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-[#e5e5e5] rounded-xl p-4">
      <p className="text-xs text-[#737373] mb-1">{label}</p>
      <p className="text-2xl font-bold text-[#0a0a0a]">{value}</p>
      {sub && <p className="text-[11px] text-[#a3a3a3] mt-0.5">{sub}</p>}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#e5e5e5] rounded-lg px-3 py-2 shadow-sm text-xs">
      <p className="text-[#737373] mb-1">{label}</p>
      <p className="font-semibold text-[#0a0a0a]">{payload[0].value} broadcast{payload[0].value !== 1 ? "s" : ""}</p>
    </div>
  );
}

// ── main ──────────────────────────────────────────────────────────────────────

export default function DashboardTab() {
  const [days, setDays] = useState<number | null>(30);
  const [data, setData] = useState<DashStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = days !== null ? `?days=${days}` : "?days=all";
      const res = await fetch(`/api/admin/campaigns/stats${q}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-5 h-5 text-[#F44444] animate-spin" />
    </div>
  );

  if (!data) return null;
  const { kpis, series, channelDistribution, recent } = data;

  return (
    <div className="p-6 space-y-6">
      {/* Range selector */}
      <div className="flex items-center justify-end gap-1">
        {RANGES.map(r => (
          <button key={r.label} onClick={() => setDays(r.days)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${days === r.days ? "bg-[#F44444] text-white" : "text-[#737373] hover:bg-[#f5f5f5]"}`}>
            {r.label}
          </button>
        ))}
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total broadcasts" value={kpis.total} />
        <KpiCard label="Sent" value={kpis.sent} sub={`${kpis.sending} sending`} />
        <KpiCard label="Recipients" value={fmt(kpis.totalRecipients)} />
        <KpiCard label="Delivery rate" value={`${kpis.deliveryRate}%`}
          sub={`${fmt(kpis.totalDelivered)} delivered · ${fmt(kpis.totalFailed)} failed`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Activity chart */}
        <div className="lg:col-span-2 bg-white border border-[#e5e5e5] rounded-xl p-4">
          <p className="text-xs font-medium text-[#525252] mb-4">Broadcast activity</p>
          {series.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-[#a3a3a3]">No data for this period</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F44444" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#F44444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="date" tickFormatter={d => {
                  const parts = d.split("-");
                  return `${parts[1]}/${parts[2]}`;
                }} tick={{ fontSize: 10, fill: "#a3a3a3" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#a3a3a3" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="value" stroke="#F44444" strokeWidth={1.5}
                  fill="url(#grad)" dot={false} activeDot={{ r: 3, fill: "#F44444" }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Channels + status */}
        <div className="flex flex-col gap-4">
          <div className="bg-white border border-[#e5e5e5] rounded-xl p-4 flex-1">
            <p className="text-xs font-medium text-[#525252] mb-3">Channels</p>
            <div className="space-y-2.5">
              {[
                { label: "Email",   value: channelDistribution.email  },
                { label: "Push",    value: channelDistribution.push   },
                { label: "In-App",  value: channelDistribution.inapp  },
              ].map(({ label, value }) => {
                const total = Math.max(1, channelDistribution.email + channelDistribution.push + channelDistribution.inapp);
                return (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#525252]">{label}</span>
                      <span className="text-[#0a0a0a] font-medium">{value}</span>
                    </div>
                    <div className="h-1 bg-[#f5f5f5] rounded-full overflow-hidden">
                      <div className="h-full bg-[#F44444] rounded-full" style={{ width: `${(value / total) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="bg-white border border-[#e5e5e5] rounded-xl p-4">
            <p className="text-xs font-medium text-[#525252] mb-3">Status breakdown</p>
            <div className="space-y-1.5">
              {[
                { label: "Draft",     value: kpis.draft },
                { label: "Scheduled", value: kpis.scheduled },
                { label: "Sending",   value: kpis.sending },
                { label: "Sent",      value: kpis.sent },
                { label: "Cancelled", value: kpis.cancelled },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-[#525252]">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: STATUS_DOT[label.toLowerCase()] ?? "#a3a3a3" }} />
                    {label}
                  </span>
                  <span className="text-[#0a0a0a] font-medium tabular-nums">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent */}
      <div className="bg-white border border-[#e5e5e5] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#f0f0f0]">
          <p className="text-xs font-medium text-[#525252]">Recent broadcasts</p>
        </div>
        {recent.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-[#a3a3a3]">No broadcasts yet</div>
        ) : (
          <div className="divide-y divide-[#f5f5f5]">
            {recent.map(c => (
              <div key={c.id} className="px-4 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#0a0a0a] truncate">{c.name}</p>
                  <p className="text-xs text-[#a3a3a3] mt-0.5">
                    {c.audienceType} · {timeAgo(c.createdAt)}
                    {c.createdBy ? ` · ${c.createdBy.name}` : ""}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-[#0a0a0a] font-medium tabular-nums">
                    {fmt(c.recipientCount)} recipients
                  </p>
                  <p className="text-[11px] text-[#a3a3a3] tabular-nums">
                    {c.recipientCount > 0
                      ? `${Math.round((c.deliveredCount / c.recipientCount) * 100)}% delivered`
                      : "—"}
                  </p>
                </div>
                <span className="flex-shrink-0 flex items-center gap-1 text-[11px] font-medium capitalize"
                  style={{ color: STATUS_DOT[c.status] ?? "#a3a3a3" }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_DOT[c.status] ?? "#a3a3a3" }} />
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
