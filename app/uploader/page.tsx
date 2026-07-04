"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useShortsContext } from "./context";
import { TrendingUp, Video, Eye, Plus, ArrowRight, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface Short {
  id: number;
  title: string;
  thumbnailUrl: string | null;
  status: string;
  views: number;
  likes: number;
  shares: number;
  createdAt: string;
}

interface StatsData {
  total: number;
  draft: number;
  in_review: number;
  approved: number;
  published: number;
  rejected: number;
  totalViews: number;
  totalLikes: number;
}

const STATUS_CONFIG: Record<string, { label: string; className: string; textClass: string }> = {
  draft:     { label: "Draft",      className: "bg-[#f5f5f5] text-[#737373] border border-[#e5e5e5]", textClass: "text-[#737373]" },
  in_review: { label: "In review",  className: "bg-amber-500/10 text-amber-600 border border-amber-500/20", textClass: "text-amber-600" },
  approved:  { label: "Approved",   className: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20", textClass: "text-emerald-600" },
  published: { label: "Published",  className: "bg-blue-500/10 text-blue-600 border border-blue-500/20", textClass: "text-blue-600" },
  rejected:  { label: "Rejected",   className: "bg-red-500/10 text-red-600 border border-red-500/20", textClass: "text-red-600" },
};

function StatusDot({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

export default function ShortsOverviewPage() {
  const { user } = useShortsContext();
  const [stats, setStats]   = useState<StatsData | null>(null);
  const [recent, setRecent] = useState<Short[]>([]);
  const [top, setTop]       = useState<Short[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/shorts?limit=50");
        if (!res.ok) return;
        const data = await res.json();
        const all: Short[] = data.shorts ?? [];

        const statMap = { draft: 0, in_review: 0, approved: 0, published: 0, rejected: 0 };
        let totalViews = 0, totalLikes = 0;
        for (const s of all) {
          if (s.status in statMap) (statMap as any)[s.status]++;
          totalViews += s.views;
          totalLikes += s.likes;
        }

        setStats({ total: all.length, ...statMap, totalViews, totalLikes });
        setRecent([...all].sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ).slice(0, 6));
        setTop([...all].sort((a, b) => b.views - a.views).slice(0, 4));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xl font-semibold text-[#0a0a0a]">
            Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </p>
          <p className="text-sm text-[#737373] mt-0.5">Your shorts at a glance</p>
        </div>
        <Link
          href="/uploader/create"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors"
        >
          <Plus className="w-4 h-4" />
          New short
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {[
          { label: "Total shorts",  value: stats?.total      ?? 0, icon: Video },
          { label: "Total views",   value: stats?.totalViews ?? 0, icon: Eye },
          { label: "Published",     value: stats?.published  ?? 0, icon: CheckCircle },
          { label: "In review",     value: stats?.in_review  ?? 0, icon: Clock },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-white rounded-xl p-4 border border-[#f0f0f0]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-[#737373]">{label}</p>
              <Icon className="w-3.5 h-3.5 text-[#a3a3a3]" />
            </div>
            <p className="text-2xl font-semibold text-[#0a0a0a]">
              {value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-6">
        {/* Recent shorts */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-[#0a0a0a]">Recent</p>
            <Link href="/uploader/my-shorts" className="text-xs text-[#a3a3a3] hover:text-[#525252] transition-colors flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-[#f5f5f5] animate-pulse" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#f0f0f0] p-8 text-center">
              <Video className="w-8 h-8 text-[#d4d4d4] mx-auto mb-3" />
              <p className="text-sm text-[#a3a3a3]">No shorts yet</p>
              <Link
                href="/uploader/create"
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#F44444] hover:text-[#d64d3c]"
              >
                <Plus className="w-3 h-3" /> Create your first short
              </Link>
            </div>
          ) : (
            <div className="space-y-1.5">
              {recent.map(s => (
                <Link
                  key={s.id}
                  href={s.status === "draft" || s.status === "rejected"
                    ? `/uploader/create?id=${s.id}`
                    : `/uploader/my-shorts`}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white border border-[#f0f0f0] hover:border-[#e5e5e5] transition-colors group"
                >
                  <div className="w-10 h-14 rounded-lg bg-[#f5f5f5] flex-shrink-0 overflow-hidden border border-[#f0f0f0]">
                    {s.thumbnailUrl
                      ? <img src={s.thumbnailUrl} alt={s.title} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center">
                          <Video className="w-4 h-4 text-[#a3a3a3]" />
                        </div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#0a0a0a] truncate transition-colors">
                      {s.title}
                    </p>
                    <p className="text-xs text-[#a3a3a3] mt-0.5">{fmtDate(s.createdAt)}</p>
                  </div>
                  <StatusDot status={s.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Status breakdown + top performers */}
        <div className="w-56 space-y-4">
          {stats && (
            <div className="bg-white rounded-xl border border-[#f0f0f0] p-4">
              <p className="text-xs font-medium text-[#737373] mb-3">Status breakdown</p>
              <div className="space-y-2">
                {(["published", "in_review", "approved", "draft", "rejected"] as const).map(s => {
                  const cfg = STATUS_CONFIG[s];
                  const count = (stats as any)[s] as number;
                  return (
                    <div key={s} className="flex items-center justify-between">
                      <span className={`text-xs ${cfg.textClass}`}>{cfg.label}</span>
                      <span className="text-xs text-[#a3a3a3] tabular-nums">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {top.length > 0 && (
            <div className="bg-white rounded-xl border border-[#f0f0f0] p-4">
              <p className="text-xs font-medium text-[#737373] mb-3 flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3" /> Top performing
              </p>
              <div className="space-y-2">
                {top.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <span className="text-[10px] text-[#a3a3a3] w-3 flex-shrink-0">{i + 1}</span>
                    <p className="text-xs text-[#0a0a0a] truncate flex-1">{s.title}</p>
                    <span className="text-[10px] text-[#a3a3a3] tabular-nums flex-shrink-0">
                      {s.views.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats && stats.rejected > 0 && (
            <Link
              href="/uploader/my-shorts?tab=rejected"
              className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 hover:border-red-500/30 transition-colors"
            >
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-red-600">{stats.rejected} rejected</p>
                <p className="text-[10px] text-red-600/80">Needs revision</p>
              </div>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
