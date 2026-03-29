"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Monitor, Smartphone, Tablet, Loader2, RotateCcw, Globe, Users, Activity } from "lucide-react";
import { AdminChart, Sparkline } from "../admin-components";

const GlobeComponent = dynamic(() => import("./GlobeComponent"), { ssr: false, loading: () => (
  <div className="flex items-center justify-center h-full">
    <Loader2 className="w-6 h-6 text-[#F44444] animate-spin" />
  </div>
) });

interface AnalyticsData {
  live: number; total24h: number; total7d: number; total30d: number;
  countries: { country: string; countryCode: string; count: number; lat: number; lon: number }[];
  devices: { device: string; count: number }[];
  pages: { page: string; count: number }[];
  hourlyData: { hour: string; count: number }[];
  globePoints: { lat: number; lng: number; size: number; color: string; label: string }[];
  liveArcs: { startLat: number; startLng: number; endLat: number; endLng: number; color: string[] }[];
}

const DEVICE_ICONS: Record<string, typeof Monitor> = { Mobile: Smartphone, Desktop: Monitor, Tablet: Tablet };

function StatCard({ label, value, sub, icon: Icon, accent }: { label: string; value: string | number; sub?: string; icon: typeof Globe; accent?: string }) {
  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white p-4">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs text-[#737373]">{label}</p>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: (accent ?? "#F44444") + "15" }}>
          <Icon className="w-3.5 h-3.5" style={{ color: accent ?? "#F44444" }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-[#0a0a0a]">{value}</p>
      {sub && <p className="text-xs text-[#a3a3a3] mt-1">{sub}</p>}
    </div>
  );
}

function HBar({ label, count, max, flag }: { label: string; count: number; max: number; flag?: string }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-2">
      {flag && <span className="text-base w-6 flex-shrink-0">{flag}</span>}
      <span className="text-xs text-[#0a0a0a] flex-1 truncate">{label}</span>
      <div className="w-24 h-1.5 bg-[#f5f5f5] rounded-full overflow-hidden flex-shrink-0">
        <div className="h-full rounded-full bg-[#F44444]" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-[#0a0a0a] w-10 text-right flex-shrink-0">{count}</span>
    </div>
  );
}

function flagEmoji(code: string) {
  return code.toUpperCase().split("").map(c => String.fromCodePoint(0x1F1E6 - 65 + c.charCodeAt(0))).join("");
}

export default function AdminAnalyticsPage() {
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
    <div className="p-6 lg:p-8 space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#a3a3a3]">Auto-refreshes every 30s · Last updated {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e5e5e5] text-xs text-[#525252] hover:bg-[#fafafa] transition-colors cursor-pointer disabled:opacity-40">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Live now" value={data?.live ?? "—"} sub="visitors in last 30 min" icon={Activity} accent="#22c55e" />
        <StatCard label="Last 24 hours" value={data?.total24h ?? "—"} sub="page views" icon={Users} accent="#3B82F6" />
        <StatCard label="Last 7 days" value={data?.total7d ?? "—"} sub="total visits" icon={Globe} accent="#F59E0B" />
        <StatCard label="Last 30 days" value={data?.total30d ?? "—"} sub="total visits" icon={Monitor} accent="#8B5CF6" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div className="rounded-2xl border border-[#e5e5e5] bg-[#0a0a0a] overflow-hidden relative" style={{ height: 500 }}>
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
            <span className="text-white text-xs font-medium">{data?.live ?? 0} live</span>
          </div>
          <div className="absolute bottom-4 left-4 z-10 text-[10px] text-white/40">Click to interact · Scroll to zoom</div>
          <GlobeComponent points={data?.globePoints ?? []} arcs={data?.liveArcs ?? []} />
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
