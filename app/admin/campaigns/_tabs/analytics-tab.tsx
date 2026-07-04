"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";

// ── types ─────────────────────────────────────────────────────────────────────

interface AnalyticsData {
  delivery: {
    totalSent: number; totalFailed: number; totalProcessed: number;
    deliveryRate: number; totalRecipients: number;
  };
  deliveryTrend: { date: string; delivered: number; failed: number }[];
  volumeTrend: { date: string; value: number }[];
  topBroadcasts: {
    id: string; name: string; audienceType: string;
    recipientCount: number; deliveredCount: number; failedCount: number;
    sentAt: string | null; deliveryRate: number; channels: string[];
  }[];
  audienceDistribution: { audienceType: string; broadcasts: number; totalRecipients: number }[];
}

// ── helpers ───────────────────────────────────────────────────────────────────

const RANGES = [
  { label: "7D", days: 7 }, { label: "30D", days: 30 },
  { label: "90D", days: 90 }, { label: "1Y", days: 365 }, { label: "All", days: null },
];

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const AUDIENCE_LABELS: Record<string, string> = {
  all: "All users", authors: "Authors", editors: "Editors", circle: "Circle",
  uploaders: "Uploaders", verified: "Verified", premium: "Premium",
  admin: "Admins", active: "Active", inactive: "Inactive", role: "By role",
};

function buildEmptyDeliveryTrend(days: number | null): { date: string; delivered: number; failed: number }[] {
  const d = days ?? 30;
  const gran = d <= 7 ? "day" : d <= 90 ? "week" : "month";
  const count = gran === "day" ? d : gran === "week" ? Math.ceil(d / 7) : Math.min(Math.ceil(d / 30), 12);
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => {
    const offset = (count - 1 - i) * (gran === "day" ? 86400000 : gran === "week" ? 604800000 : 2592000000);
    const dt = new Date(now - offset);
    return { date: dt.toISOString().slice(0, 10), delivered: 0, failed: 0 };
  });
}

function buildEmptyVolumeTrend(days: number | null): { date: string; value: number }[] {
  return buildEmptyDeliveryTrend(days).map(({ date }) => ({ date, value: 0 }));
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-[#e5e5e5] rounded-xl p-4">
      <p className="text-xs text-[#737373] mb-1">{label}</p>
      <p className="text-2xl font-bold text-[#0a0a0a]">{value}</p>
      {sub && <p className="text-[11px] text-[#a3a3a3] mt-0.5">{sub}</p>}
    </div>
  );
}

function DeliveryTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#e5e5e5] rounded-lg px-3 py-2 shadow-sm text-xs">
      <p className="text-[#737373] mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="font-semibold" style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

// ── main ──────────────────────────────────────────────────────────────────────

export default function AnalyticsTab() {
  const [days, setDays] = useState<number | null>(30);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = days !== null ? `?days=${days}` : "?days=all";
      const res = await fetch(`/api/admin/campaigns/analytics${q}`);
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

  const { delivery, topBroadcasts, audienceDistribution } = data;
  const deliveryTrend = data.deliveryTrend.length > 0 ? data.deliveryTrend : buildEmptyDeliveryTrend(days);
  const volumeTrend   = data.volumeTrend.length   > 0 ? data.volumeTrend   : buildEmptyVolumeTrend(days);
  const noDeliveryData = data.deliveryTrend.length === 0;
  const noVolumeData   = data.volumeTrend.length   === 0;
  const maxRecipients = Math.max(...audienceDistribution.map(a => a.totalRecipients), 1);

  return (
    <div className="p-6 space-y-6">
      {/* range */}
      <div className="flex items-center justify-end gap-1">
        {RANGES.map(r => (
          <button key={r.label} onClick={() => setDays(r.days)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              days === r.days ? "bg-[#F44444] text-white" : "text-[#737373] hover:bg-[#f5f5f5]"
            }`}>
            {r.label}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Delivery rate" value={`${delivery.deliveryRate}%`}
          sub={`${fmt(delivery.totalSent)} sent`} />
        <KpiCard label="Total recipients" value={fmt(delivery.totalRecipients)} />
        <KpiCard label="Emails processed" value={fmt(delivery.totalProcessed)} />
        <KpiCard label="Failed" value={fmt(delivery.totalFailed)}
          sub={delivery.totalProcessed > 0
            ? `${Math.round((delivery.totalFailed / delivery.totalProcessed) * 100)}% failure rate`
            : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* delivery trend */}
        <div className="bg-white border border-[#e5e5e5] rounded-xl p-4">
          <div className="flex items-baseline gap-2 mb-4">
            <p className="text-xs font-medium text-[#525252]">Delivery trend</p>
            {noDeliveryData && <p className="text-[10px] text-[#c5c5c5]">No broadcasts in this period</p>}
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={deliveryTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="gDeliv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gFail" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F44444" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#F44444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="date" tickFormatter={d => {
                const p = d.split("-"); return `${p[1]}/${p[2]}`;
              }} tick={{ fontSize: 10, fill: "#a3a3a3" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#a3a3a3" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<DeliveryTooltip />} />
              <Area type="monotone" dataKey="delivered" name="Delivered" stroke="#22c55e" strokeWidth={1.5}
                fill="url(#gDeliv)" dot={false} activeDot={{ r: 3, fill: "#22c55e" }} />
              <Area type="monotone" dataKey="failed" name="Failed" stroke="#F44444" strokeWidth={1.5}
                fill="url(#gFail)" dot={false} activeDot={{ r: 3, fill: "#F44444" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* volume trend */}
        <div className="bg-white border border-[#e5e5e5] rounded-xl p-4">
          <div className="flex items-baseline gap-2 mb-4">
            <p className="text-xs font-medium text-[#525252]">Broadcast volume</p>
            {noVolumeData && <p className="text-[10px] text-[#c5c5c5]">No broadcasts in this period</p>}
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={volumeTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="date" tickFormatter={d => {
                const p = d.split("-"); return `${p[1]}/${p[2] ?? ""}`;
              }} tick={{ fontSize: 10, fill: "#a3a3a3" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#a3a3a3" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<DeliveryTooltip />} />
              <Bar dataKey="value" name="Broadcasts" radius={[3, 3, 0, 0]} fill="#F44444" fillOpacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* audience distribution */}
      <div className="bg-white border border-[#e5e5e5] rounded-xl p-4">
        <p className="text-xs font-medium text-[#525252] mb-4">Audience distribution</p>
        {audienceDistribution.length === 0 ? (
          <p className="text-xs text-[#a3a3a3]">No data</p>
        ) : (
          <div className="space-y-2.5">
            {audienceDistribution
              .sort((a, b) => b.totalRecipients - a.totalRecipients)
              .map(a => (
                <div key={a.audienceType}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#525252]">{AUDIENCE_LABELS[a.audienceType] ?? a.audienceType}</span>
                    <span className="text-[#737373] tabular-nums">
                      {a.broadcasts} broadcasts · {fmt(a.totalRecipients)} recipients
                    </span>
                  </div>
                  <div className="h-1.5 bg-[#f5f5f5] rounded-full overflow-hidden">
                    <div className="h-full bg-[#F44444] rounded-full"
                      style={{ width: `${(a.totalRecipients / maxRecipients) * 100}%` }} />
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* top broadcasts */}
      <div className="bg-white border border-[#e5e5e5] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#f0f0f0]">
          <p className="text-xs font-medium text-[#525252]">Top broadcasts by delivery</p>
        </div>
        {topBroadcasts.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-[#a3a3a3]">No sent broadcasts yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#f0f0f0]">
                  {["Broadcast", "Audience", "Recipients", "Delivered", "Failed", "Rate", "Sent"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topBroadcasts.map(b => (
                  <tr key={b.id} className="border-b border-[#f5f5f5] last:border-0 hover:bg-[#fafafa] transition-colors">
                    <td className="px-4 py-3 text-sm text-[#0a0a0a] max-w-[200px] truncate">{b.name}</td>
                    <td className="px-4 py-3 text-xs text-[#525252]">{AUDIENCE_LABELS[b.audienceType] ?? b.audienceType}</td>
                    <td className="px-4 py-3 text-xs text-[#0a0a0a] tabular-nums">{fmt(b.recipientCount)}</td>
                    <td className="px-4 py-3 text-xs text-[#22c55e] tabular-nums">{fmt(b.deliveredCount)}</td>
                    <td className="px-4 py-3 text-xs text-[#F44444] tabular-nums">{fmt(b.failedCount)}</td>
                    <td className="px-4 py-3 text-xs font-semibold tabular-nums"
                      style={{ color: b.deliveryRate >= 90 ? "#16A34A" : b.deliveryRate >= 70 ? "#D97706" : "#DC2626" }}>
                      {b.deliveryRate}%
                    </td>
                    <td className="px-4 py-3 text-xs text-[#a3a3a3]">{fmtDate(b.sentAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
