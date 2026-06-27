"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity, RefreshCw, RotateCcw, Trash2,
  ChevronLeft, ChevronRight, Loader2,
} from "lucide-react";
import { ConfirmModal } from "@/app/admin/admin-components";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Job {
  id: string;
  type: string;
  status: string;
  priority: number;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  scheduledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface JobsResponse {
  stats: Record<string, number>;
  emailStats: Record<string, number>;
  jobs: Job[];
  total: number;
  page: number;
  pages: number;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const JOB_TYPE_LABELS: Record<string, string> = {
  "send-email":              "Email Delivery",
  "send-push":               "Push Notification",
  "prune-activity-log":      "Log Prune",
  "cleanup-expired-stories": "Story Cleanup",
  "cleanup-notifications":   "Notif Cleanup",
  "prune-email-logs":        "Email Log Prune",
};

const STATUS_BADGE: Record<string, string> = {
  pending:    "bg-[#F59E0B]/10 text-[#D97706]",
  processing: "bg-[#3B82F6]/10 text-[#3B82F6]",
  completed:  "bg-[#22c55e]/10 text-[#22c55e]",
  failed:     "bg-[#F44444]/10 text-[#F44444]",
  dead:       "bg-[#525252]/10 text-[#525252]",
};

const QUEUE_STATS = [
  { key: "pending",    label: "Pending",    color: "#F59E0B" },
  { key: "processing", label: "Processing", color: "#3B82F6" },
  { key: "completed",  label: "Completed",  color: "#22c55e" },
  { key: "failed",     label: "Failed",     color: "#F44444" },
  { key: "dead",       label: "Dead",       color: "#525252" },
];

const STATUS_TABS = [
  { value: "",           label: "All" },
  { value: "pending",    label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "completed",  label: "Completed" },
  { value: "failed",     label: "Failed" },
  { value: "dead",       label: "Dead" },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) {
    const s = Math.floor(-diff / 1000);
    if (s < 60) return `in ${s}s`;
    const m = Math.floor(s / 60);
    return m < 60 ? `in ${m}m` : `in ${Math.floor(m / 60)}h`;
  }
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function QueueCard({ label, value, color }: { label: string; value: number; color: string }) {
  const highlighted = value > 0 && label !== "Completed" && label !== "Processing";
  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white p-4">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs text-[#737373]">{label}</p>
        <div
          className="w-2 h-2 rounded-full mt-0.5 flex-shrink-0"
          style={{ backgroundColor: highlighted ? color : "#e5e5e5" }}
        />
      </div>
      <p
        className="text-2xl font-bold"
        style={{ color: highlighted ? color : "#0a0a0a" }}
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
        STATUS_BADGE[status] ?? "bg-[#f5f5f5] text-[#525252]"
      }`}
    >
      {status}
    </span>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AdminJobsPage() {
  const [data, setData]               = useState<JobsResponse | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [page, setPage]               = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter]   = useState("");
  const [retrying, setRetrying]       = useState<string | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<"completed" | "dead" | null>(null);
  const [purging, setPurging]         = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter)   params.set("type",   typeFilter);
      const res = await fetch(`/api/admin/jobs?${params}`);
      if (!res.ok) throw new Error(`${res.status}`);
      setData(await res.json());
      setLastRefresh(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [statusFilter, typeFilter]);

  async function retryJob(jobId: string) {
    setRetrying(jobId);
    try {
      const res = await fetch("/api/admin/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      if (!res.ok) throw new Error(await res.text());
      fetchData();
    } catch (e) {
      console.error("[retry]", e);
    } finally {
      setRetrying(null);
    }
  }

  async function purgeJobs() {
    if (!purgeTarget) return;
    setPurging(true);
    try {
      const res = await fetch(`/api/admin/jobs?status=${purgeTarget}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setPurgeTarget(null);
      fetchData();
    } catch (e) {
      console.error("[purge]", e);
    } finally {
      setPurging(false);
    }
  }

  const stats      = data?.stats      ?? {};
  const emailStats = data?.emailStats ?? {};
  const jobs       = data?.jobs       ?? [];
  const pages      = data?.pages      ?? 1;
  const total      = data?.total      ?? 0;

  const purgeCount = purgeTarget ? (stats[purgeTarget] ?? 0) : 0;

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#0a0a0a]">Job Queue</h1>
          <p className="text-xs text-[#a3a3a3] mt-0.5">
            Updated {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#e5e5e5] text-xs text-[#525252] hover:bg-[#fafafa] disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-[#e5e5e5] bg-white p-6 text-center">
          <p className="text-sm font-medium text-[#0a0a0a] mb-1">Failed to load job queue</p>
          <p className="text-xs text-[#a3a3a3] font-mono">{error}</p>
        </div>
      )}

      {/* Queue stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {loading && !data ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[#e5e5e5] bg-white p-4 animate-pulse">
              <div className="h-3 bg-[#ebebeb] rounded w-20 mb-3" />
              <div className="h-7 bg-[#ebebeb] rounded w-12" />
            </div>
          ))
        ) : (
          QUEUE_STATS.map(s => (
            <QueueCard key={s.key} label={s.label} value={stats[s.key] ?? 0} color={s.color} />
          ))
        )}
      </div>

      {/* Email delivery stats */}
      <div>
        <p className="text-[11px] font-semibold text-[#a3a3a3] uppercase tracking-widest mb-2">Email Deliveries</p>
        <div className="grid grid-cols-3 gap-3">
          {loading && !data ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-[#e5e5e5] bg-white p-4 animate-pulse">
                <div className="h-3 bg-[#ebebeb] rounded w-16 mb-3" />
                <div className="h-7 bg-[#ebebeb] rounded w-10" />
              </div>
            ))
          ) : (
            [
              { key: "queued", label: "Queued",  color: "#F59E0B", neutral: false },
              { key: "sent",   label: "Sent",    color: "#22c55e", neutral: true  },
              { key: "failed", label: "Failed",  color: "#F44444", neutral: false },
            ].map(({ key, label, color, neutral }) => (
              <div key={key} className="rounded-xl border border-[#e5e5e5] bg-white p-4">
                <p className="text-xs text-[#737373] mb-3">{label}</p>
                <p
                  className="text-2xl font-bold"
                  style={{ color: !neutral && (emailStats[key] ?? 0) > 0 ? color : "#0a0a0a" }}
                >
                  {(emailStats[key] ?? 0).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Filter + purge bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-white rounded-xl border border-[#e5e5e5] p-1 flex-wrap">
          {STATUS_TABS.map(t => (
            <button
              key={t.value}
              onClick={() => setStatusFilter(t.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === t.value
                  ? "bg-[#0a0a0a] text-white"
                  : "text-[#525252] hover:bg-[#f5f5f5]"
              }`}
            >
              {t.label}
              {t.value && stats[t.value] ? ` (${stats[t.value]})` : ""}
            </button>
          ))}
        </div>

        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-[#e5e5e5] bg-white text-xs text-[#525252] focus:outline-none cursor-pointer"
        >
          <option value="">All types</option>
          {Object.entries(JOB_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2">
          {(stats.completed ?? 0) > 0 && (
            <button
              onClick={() => setPurgeTarget("completed")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f5f5f5] text-xs text-[#525252] hover:bg-[#ebebeb] transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear completed
            </button>
          )}
          {(stats.dead ?? 0) > 0 && (
            <button
              onClick={() => setPurgeTarget("dead")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFF0F0] text-xs text-[#F44444] hover:bg-[#FFE0E0] transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear dead ({stats.dead})
            </button>
          )}
        </div>
      </div>

      {/* Jobs table */}
      <div className="rounded-xl border border-[#e5e5e5] bg-white relative">
        {loading && jobs.length > 0 && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-xl">
            <Loader2 className="w-5 h-5 text-[#F44444] animate-spin" />
          </div>
        )}

        {/* Column headers */}
        <div className="flex items-center gap-4 px-5 py-2.5 border-b border-[#f0f0f0]">
          <span className="flex-1 text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-widest">Type</span>
          <span className="w-24 text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-widest">Status</span>
          <span className="hidden sm:block w-16 text-center text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-widest">Tries</span>
          <span className="hidden md:block w-28 text-right text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-widest">Time</span>
          <span className="w-8" />
        </div>

        {/* Loading skeleton */}
        {loading && jobs.length === 0 && (
          <div className="divide-y divide-[#f0f0f0]">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-[#ebebeb] rounded" style={{ width: `${25 + (i % 5) * 12}%` }} />
                  <div className="h-3 bg-[#ebebeb] rounded w-40 hidden lg:block" />
                </div>
                <div className="w-24 h-5 bg-[#ebebeb] rounded-full" />
                <div className="hidden sm:block w-16 h-4 bg-[#ebebeb] rounded" />
                <div className="hidden md:block w-28 h-3 bg-[#ebebeb] rounded" />
                <div className="w-8 h-7 bg-[#ebebeb] rounded-lg" />
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && jobs.length === 0 && (
          <div className="py-16 text-center">
            <Activity className="w-8 h-8 text-[#d4d4d4] mx-auto mb-3" />
            <p className="text-sm text-[#a3a3a3]">No jobs match the current filters</p>
          </div>
        )}

        {/* Rows */}
        <div className="divide-y divide-[#f0f0f0]">
          {jobs.map((job, i) => {
            const canRetry  = job.status === "dead" || job.status === "failed";
            const timeRef   = job.completedAt ?? job.startedAt ?? job.createdAt;
            const label     = JOB_TYPE_LABELS[job.type] ?? job.type;
            const isLast    = i === jobs.length - 1;

            return (
              <div
                key={job.id}
                className={`flex items-center gap-4 px-5 py-3.5 hover:bg-[#fafafa] transition-colors ${isLast ? "rounded-b-xl" : ""}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0a0a0a] truncate">{label}</p>
                  {job.lastError && (
                    <p className="text-[11px] text-[#F44444] truncate mt-0.5">{job.lastError}</p>
                  )}
                </div>

                <div className="w-24 flex-shrink-0">
                  <StatusBadge status={job.status} />
                </div>

                <div className="hidden sm:block w-16 text-center flex-shrink-0">
                  <span className="text-xs text-[#525252] tabular-nums">{job.attempts} / {job.maxAttempts}</span>
                </div>

                <div className="hidden md:block w-28 text-right flex-shrink-0">
                  <span className="text-xs text-[#a3a3a3]">{relativeTime(timeRef)}</span>
                </div>

                <div className="w-8 flex justify-end flex-shrink-0">
                  {canRetry && (
                    <button
                      onClick={() => retryJob(job.id)}
                      disabled={retrying === job.id}
                      title="Retry job"
                      className="p-1.5 rounded-lg hover:bg-[#f0f0f0] text-[#3B82F6] disabled:opacity-40 transition-colors"
                    >
                      {retrying === job.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <RotateCcw className="w-3.5 h-3.5" />
                      }
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-[#a3a3a3]">{total.toLocaleString()} jobs</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-[#e5e5e5] text-[#525252] hover:bg-[#fafafa] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs text-[#525252] tabular-nums">{page} / {pages}</span>
            <button
              onClick={() => setPage(p => Math.min(pages, p + 1))}
              disabled={page >= pages}
              className="p-1.5 rounded-lg border border-[#e5e5e5] text-[#525252] hover:bg-[#fafafa] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Purge confirm modal */}
      <ConfirmModal
        isOpen={!!purgeTarget}
        onClose={() => { if (!purging) setPurgeTarget(null); }}
        onConfirm={purgeJobs}
        title={purgeTarget ? `Clear ${purgeTarget} jobs` : ""}
        message={
          purgeTarget
            ? `Delete all ${purgeTarget} jobs? This removes ${purgeCount.toLocaleString()} record${purgeCount !== 1 ? "s" : ""} and cannot be undone.`
            : ""
        }
        confirmText={purgeCount > 0 ? `Delete ${purgeCount.toLocaleString()} jobs` : "Delete"}
        isSubmitting={purging}
      />
    </div>
  );
}