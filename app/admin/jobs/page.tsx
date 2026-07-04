"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity, RefreshCw, RotateCcw, Trash2, Play,
  ChevronLeft, ChevronRight, Loader2, ChevronDown,
  CheckCircle, AlertTriangle, XCircle, Clock,
} from "lucide-react";
import { ConfirmModal, AdminPillTabs } from "@/app/admin/admin-components";

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

interface HealthSignal {
  name: string;
  status: "ok" | "warn" | "error";
  detail: string;
}

interface MaintenanceRun {
  id: string;
  task: string;
  status: string;
  results: Record<string, unknown> | null;
  error: string | null;
  duration: number | null;
  startedAt: string;
  completedAt: string | null;
}

interface SystemHealth {
  queue: Record<string, number>;
  email: Record<string, number>;
  signals: HealthSignal[];
  recentRuns: MaintenanceRun[];
}

// ── Constants ──────────────────────────────────────────────────────────────────

const JOB_TYPE_LABELS: Record<string, string> = {
  "send-email":               "Email Delivery",
  "send-push":                "Push Notification",
  "prune-activity-log":       "Activity Log Prune",
  "cleanup-expired-stories":  "Story Cleanup",
  "cleanup-notifications":    "Notification Cleanup",
  "prune-email-logs":         "Email Log Prune",
  "publish-scheduled-article":"Article Publish",
  "send-scheduled-alert":     "Scheduled Alert",
  "send-campaign-email":      "Campaign Email",
};

const STATUS_BADGE: Record<string, string> = {
  pending:    "bg-[#F59E0B]/10 text-[#D97706]",
  processing: "bg-[#3B82F6]/10 text-[#3B82F6]",
  completed:  "bg-[#22c55e]/10 text-[#22c55e]",
  failed:     "bg-[#F44444]/10 text-[#F44444]",
  dead:       "bg-[#525252]/10 text-[#525252]",
};

const RUN_STATUS_STYLE: Record<string, string> = {
  success: "text-[#22c55e]",
  partial: "text-[#F59E0B]",
  failed:  "text-[#F44444]",
};

const QUEUE_STATS = [
  { key: "pending",    label: "Pending",    color: "#F59E0B" },
  { key: "processing", label: "Processing", color: "#3B82F6", neutral: true },
  { key: "completed",  label: "Completed",  color: "#22c55e", neutral: true },
  { key: "failed",     label: "Failed",     color: "#F44444" },
  { key: "dead",       label: "Dead",       color: "#525252" },
];

const EMAIL_STATS = [
  { key: "queued", label: "Emails Queued", color: "#F59E0B" },
  { key: "sent",   label: "Emails Sent",   color: "#22c55e", neutral: true },
  { key: "failed", label: "Emails Failed", color: "#F44444" },
];

const STATUS_TABS = [
  { value: "",           label: "All" },
  { value: "pending",    label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "completed",  label: "Completed" },
  { value: "failed",     label: "Failed" },
  { value: "dead",       label: "Dead" },
];

const PAGE_TABS = ["Queue", "System"];

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

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function QueueCard({ label, value, color, neutral }: { label: string; value: number; color: string; neutral?: boolean }) {
  const highlighted = value > 0 && !neutral;
  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white p-4 transition-all duration-300 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between mb-2">
        <p className="text-[11px] font-medium text-[#737373]">{label}</p>
        <div
          className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 transition-colors"
          style={{ backgroundColor: highlighted ? color : "#e5e5e5" }}
        />
      </div>
      <p
        className="text-2xl font-bold tracking-tight transition-colors"
        style={{ color: highlighted ? color : "#0a0a0a" }}
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function JobStatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold capitalize ${STATUS_BADGE[status] ?? "bg-[#f5f5f5] text-[#525252]"}`}>
      {status}
    </span>
  );
}

function SignalIcon({ status }: { status: "ok" | "warn" | "error" }) {
  if (status === "ok")    return <CheckCircle className="w-4 h-4 text-[#22c55e] flex-shrink-0" />;
  if (status === "warn")  return <AlertTriangle className="w-4 h-4 text-[#F59E0B] flex-shrink-0" />;
  return <XCircle className="w-4 h-4 text-[#F44444] flex-shrink-0" />;
}

// ── System Tab ─────────────────────────────────────────────────────────────────

function SystemTab() {
  const [health, setHealth]       = useState<SystemHealth | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<{ status: string; message: string } | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/system-health");
      if (!res.ok) throw new Error(`${res.status}`);
      setHealth(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  async function triggerMaintenance() {
    setTriggering(true);
    setTriggerResult(null);
    try {
      const res = await fetch("/api/admin/maintenance", { method: "POST" });
      const data = await res.json();
      const enqueued = Array.isArray(data.results?.enqueuedTasks)
        ? (data.results.enqueuedTasks as string[]).length
        : 0;
      setTriggerResult({
        status: data.status,
        message: `${data.status} — ${enqueued > 0 ? `${enqueued} task${enqueued !== 1 ? "s" : ""} enqueued` : "no new tasks enqueued"}, ${data.results?.prunedJobs ?? 0} old tasks pruned`,
      });
      fetchHealth();
    } catch {
      setTriggerResult({ status: "failed", message: "Request failed" });
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Health Signals */}
      <div className="rounded-xl border border-[#e5e5e5] bg-white">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0]">
          <span className="text-sm font-semibold text-[#0a0a0a]">Health signals</span>
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="flex items-center gap-1.5 p-1.5 rounded-lg border border-[#e5e5e5] text-[#525252] hover:bg-[#fafafa] disabled:opacity-40 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loading && !health ? (
          <div className="divide-y divide-[#f0f0f0]">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3.5 animate-pulse">
                <div className="w-4 h-4 rounded-full bg-[#ebebeb]" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-[#ebebeb] rounded w-32" />
                  <div className="h-3 bg-[#ebebeb] rounded w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-[#F44444]">{error}</p>
          </div>
        ) : (
          <div className="divide-y divide-[#f0f0f0]">
            {(health?.signals ?? []).map((sig) => (
              <div key={sig.name} className="flex items-center gap-3 px-5 py-3.5">
                <SignalIcon status={sig.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0a0a0a]">{sig.name}</p>
                  <p className="text-xs text-[#737373]">{sig.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manual Maintenance Trigger */}
      <div className="rounded-xl border border-[#e5e5e5] bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#0a0a0a] mb-1">Manual maintenance</p>
            <p className="text-xs text-[#737373]">
              Immediately prune old tasks and enqueue all maintenance tasks. The daily schedule runs at 3am UTC automatically.
            </p>
            {triggerResult && (
              <p className={`text-xs mt-2 font-medium ${triggerResult.status === "success" ? "text-[#22c55e]" : triggerResult.status === "partial" ? "text-[#F59E0B]" : "text-[#F44444]"}`}>
                {triggerResult.message}
              </p>
            )}
          </div>
          <button
            onClick={triggerMaintenance}
            disabled={triggering}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0a0a0a] text-white text-xs font-medium hover:bg-[#262626] disabled:opacity-40 transition-colors flex-shrink-0"
          >
            {triggering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Run now
          </button>
        </div>
      </div>

      {/* Maintenance History */}
      <div className="rounded-xl border border-[#e5e5e5] bg-white">
        <div className="px-5 py-4 border-b border-[#f0f0f0]">
          <span className="text-sm font-semibold text-[#0a0a0a]">Maintenance history</span>
        </div>

        {loading && !health ? (
          <div className="divide-y divide-[#f0f0f0]">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-[#ebebeb] rounded w-40" />
                  <div className="h-3 bg-[#ebebeb] rounded w-24" />
                </div>
                <div className="w-16 h-3 bg-[#ebebeb] rounded" />
              </div>
            ))}
          </div>
        ) : !health?.recentRuns?.length ? (
          <div className="py-12 text-center">
            <Clock className="w-7 h-7 text-[#d4d4d4] mx-auto mb-3" />
            <p className="text-sm text-[#a3a3a3]">No maintenance runs recorded yet</p>
            <p className="text-xs text-[#d4d4d4] mt-1">Runs after 3am UTC daily, or trigger manually above</p>
          </div>
        ) : (
          <div className="divide-y divide-[#f0f0f0]">
            {health.recentRuns.map((run) => {
              const results = run.results as Record<string, unknown> | null;
              const enqueuedCount = Array.isArray(results?.enqueuedTasks) ? (results!.enqueuedTasks as string[]).length : 0;
              const prunedJobs = typeof results?.prunedJobs === "number" ? results.prunedJobs : null;
              const taskLabel = run.task === "daily-maintenance" ? "Daily maintenance" : "Manual run";

              return (
                <div key={run.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#0a0a0a]">{taskLabel}</span>
                      <span className={`text-[11px] font-semibold capitalize ${RUN_STATUS_STYLE[run.status] ?? "text-[#a3a3a3]"}`}>
                        {run.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#737373] mt-0.5">
                      {enqueuedCount > 0 && `${enqueuedCount} task${enqueuedCount !== 1 ? "s" : ""} enqueued`}
                      {enqueuedCount > 0 && prunedJobs != null && " · "}
                      {prunedJobs != null && `${prunedJobs} old tasks pruned`}
                      {run.error && <span className="text-[#F44444]"> · {run.error.slice(0, 80)}</span>}
                    </p>
                  </div>

                  <div className="text-right flex-shrink-0 space-y-0.5">
                    <p className="text-xs text-[#a3a3a3]">{relativeTime(run.startedAt)}</p>
                    {run.duration != null && (
                      <p className="text-[10px] text-[#d4d4d4]">{formatDuration(run.duration)}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Queue Tab ──────────────────────────────────────────────────────────────────

function QueueTab() {
  const [data, setData]               = useState<JobsResponse | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [page, setPage]               = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter]   = useState("");
  const [retrying, setRetrying]       = useState<string | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<"completed" | "dead" | null>(null);
  const [purging, setPurging]         = useState(false);

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

  const tabLabels = STATUS_TABS.map(t =>
    t.value && stats[t.value] ? `${t.label} (${stats[t.value]})` : t.label
  );
  const activeTabIndex = STATUS_TABS.findIndex(t => t.value === statusFilter);

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-[#e5e5e5] bg-white p-6 text-center">
          <p className="text-sm font-medium text-[#0a0a0a] mb-1">Failed to load system task queue</p>
          <p className="text-xs text-[#a3a3a3] font-mono">{error}</p>
        </div>
      )}

      {/* Queue & Email Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        {loading && !data ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[#e5e5e5] bg-white p-4 animate-pulse">
              <div className="h-3 bg-[#ebebeb] rounded w-16 mb-3" />
              <div className="h-7 bg-[#ebebeb] rounded w-10 mt-3" />
            </div>
          ))
        ) : (
          <>
            {QUEUE_STATS.map(s => (
              <QueueCard key={s.key} label={s.label} value={stats[s.key] ?? 0} color={s.color} neutral={s.neutral} />
            ))}
            {EMAIL_STATS.map(s => (
              <QueueCard key={s.key} label={s.label} value={emailStats[s.key] ?? 0} color={s.color} neutral={s.neutral} />
            ))}
          </>
        )}
      </div>

      {/* Filter + Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <AdminPillTabs
            tabs={tabLabels}
            activeTab={activeTabIndex >= 0 ? activeTabIndex : 0}
            onTabChange={(i) => setStatusFilter(STATUS_TABS[i].value)}
          />

          <div className="relative">
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="pl-3 pr-8 py-1.5 rounded-full border border-[#e5e5e5] bg-white text-xs font-medium text-[#525252] focus:outline-none appearance-none hover:bg-[#fafafa] transition-colors cursor-pointer"
            >
              <option value="">All task types</option>
              {Object.entries(JOB_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#a3a3a3] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {(stats.completed ?? 0) > 0 && (
            <button
              onClick={() => setPurgeTarget("completed")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#e5e5e5] bg-white text-xs font-medium text-[#525252] hover:bg-[#fafafa] transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear completed
            </button>
          )}
          {(stats.dead ?? 0) > 0 && (
            <button
              onClick={() => setPurgeTarget("dead")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#F44444]/20 bg-[#FFF0F0] text-xs font-medium text-[#F44444] hover:bg-[#FFE0E0] transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear dead
            </button>
          )}

          <div className="hidden sm:block w-px h-4 bg-[#e5e5e5] mx-1" />

          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center justify-center p-1.5 rounded-full border border-[#e5e5e5] bg-white text-[#525252] hover:bg-[#fafafa] disabled:opacity-50 transition-colors"
            title="Refresh task queue"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Jobs table */}
      <div className="rounded-xl border border-[#e5e5e5] bg-white relative">
        {loading && jobs.length > 0 && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-xl">
            <Loader2 className="w-5 h-5 text-[#F44444] animate-spin" />
          </div>
        )}

        <div className="flex items-center gap-4 px-5 py-2.5 border-b border-[#f0f0f0]">
          <span className="flex-1 text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-widest">Type</span>
          <span className="w-24 text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-widest">Status</span>
          <span className="hidden sm:block w-16 text-center text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-widest">Tries</span>
          <span className="hidden md:block w-28 text-right text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-widest">Time</span>
          <span className="w-8" />
        </div>

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

        {!loading && jobs.length === 0 && (
          <div className="py-16 text-center">
            <Activity className="w-8 h-8 text-[#d4d4d4] mx-auto mb-3" />
            <p className="text-sm text-[#a3a3a3]">No system tasks match the current filters</p>
          </div>
        )}

        <div className="divide-y divide-[#f0f0f0]">
          {jobs.map((job, i) => {
            const canRetry = job.status === "dead" || job.status === "failed";
            const timeRef  = job.completedAt ?? job.startedAt ?? job.createdAt;
            const label    = JOB_TYPE_LABELS[job.type] ?? job.type;
            const isLast   = i === jobs.length - 1;

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
                  <JobStatusBadge status={job.status} />
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
                      title="Retry task"
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
          <p className="text-xs text-[#a3a3a3]">{total.toLocaleString()} tasks</p>
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

      <ConfirmModal
        isOpen={!!purgeTarget}
        onClose={() => { if (!purging) setPurgeTarget(null); }}
        onConfirm={purgeJobs}
        title={purgeTarget ? `Clear ${purgeTarget} tasks` : ""}
        message={
          purgeTarget
            ? `Delete all ${purgeTarget} tasks? This removes ${purgeCount.toLocaleString()} record${purgeCount !== 1 ? "s" : ""} and cannot be undone.`
            : ""
        }
        confirmText={purgeCount > 0 ? `Delete ${purgeCount.toLocaleString()} tasks` : "Delete"}
        isSubmitting={purging}
      />
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AdminJobsPage() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-xl font-semibold text-[#0a0a0a]">System Tasks</span>
        <AdminPillTabs
          tabs={PAGE_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      {activeTab === 0 ? <QueueTab /> : <SystemTab />}
    </div>
  );
}