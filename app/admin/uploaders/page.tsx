"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Avatar } from "@/app/components/Avatar";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Video, X, Loader2, Check, XCircle, Eye, Heart, Share2,
  ChevronRight, ExternalLink, Trash2, Calendar, Upload,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { AdminPillTabs, ConfirmModal } from "../admin-components";

const UPLOAD_RANGES: { label: string; days: number | null }[] = [
  { label: "1D",  days: 1    },
  { label: "7D",  days: 7    },
  { label: "30D", days: 30   },
  { label: "90D", days: 90   },
  { label: "1Y",  days: 365  },
  { label: "All", days: null },
];

function fmtU(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface ShortUser {
  id: number;
  name: string;
  handle: string;
  avatar: string | null;
}

interface Short {
  id: number;
  title: string;
  description: string | null;
  videoUrl: string;
  thumbnailUrl: string | null;
  format: string;
  status: string;
  views: number;
  likes: number;
  shares: number;
  rejectionNote: string | null;
  publishedAt: string | null;
  createdAt: string;
  user: ShortUser;
}

interface Stats {
  draft: number; in_review: number; approved: number; rejected: number; published: number;
}

interface Uploader {
  id: number;
  name: string;
  handle: string;
  email: string;
  avatar: string | null;
  role: string;
  verified: boolean;
  status: string;
  joinDate: string;
  followers: string | number;
  canPost?: boolean;
  banned?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAIN_TABS = ["Uploaders", "Analytics", "Moderation"];
const MOD_TABS = ["In Review", "Approved", "Published", "Rejected", "All"];
const MOD_STATUS = ["in_review", "approved", "published", "rejected", "all"];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: "Draft",     color: "#737373", bg: "#f5f5f5" },
  in_review: { label: "In Review", color: "#D97706", bg: "#FEF3C7" },
  approved:  { label: "Approved",  color: "#16A34A", bg: "#F0FDF4" },
  published: { label: "Published", color: "#2563EB", bg: "#EFF6FF" },
  rejected:  { label: "Rejected",  color: "#DC2626", bg: "#FEF2F2" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}>
      {cfg.label}
    </span>
  );
}

// ─── Moderation: Short row ────────────────────────────────────────────────────

function ShortRow({ short, active, onClick }: { short: Short; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-3 px-4 py-3 border-b border-[#f0f0f0] transition-colors ${
        active ? "bg-[#fafafa]" : "hover:bg-[#fafafa]"
      }`}
    >
      <div className="w-10 h-14 rounded-lg bg-[#f5f5f5] flex-shrink-0 overflow-hidden">
        {short.thumbnailUrl
          ? <img src={short.thumbnailUrl} alt={short.title} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center">
              <Video className="w-4 h-4 text-[#c0c0c0]" />
            </div>
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#0a0a0a] font-medium truncate">{short.title}</p>
        <p className="text-xs text-[#a3a3a3] truncate">@{short.user.handle}</p>
        <p className="text-[10px] text-[#c0c0c0] mt-0.5">{fmtDate(short.createdAt)}</p>
      </div>
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        <StatusBadge status={short.status} />
        <ChevronRight className="w-3.5 h-3.5 text-[#d4d4d4]" />
      </div>
    </button>
  );
}

// ─── Moderation: Detail panel ─────────────────────────────────────────────────

function ModerationDetail({
  short,
  onAction,
  loading,
}: {
  short: Short;
  onAction: (action: string, rejectionNote?: string) => void;
  loading: boolean;
}) {
  const [rejectNote, setRejectNote] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  const handleReject = () => {
    if (!rejectNote.trim()) return;
    onAction("reject", rejectNote);
    setRejectNote("");
    setShowRejectInput(false);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="bg-[#0a0a0a]">
        <video
          key={short.videoUrl}
          src={short.videoUrl}
          controls
          muted
          autoPlay
          loop
          className="w-full max-h-80 object-contain"
        />
      </div>

      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-[#0a0a0a] leading-snug">{short.title}</p>
            {short.description && (
              <p className="text-sm text-[#737373] mt-1 leading-relaxed">{short.description}</p>
            )}
          </div>
          <StatusBadge status={short.status} />
        </div>

        <div className="flex items-center gap-2.5 py-3 border-y border-[#f0f0f0]">
          <Avatar src={short.user.avatar} name={short.user.name} size={32} />
          <div>
            <p className="text-sm font-medium text-[#0a0a0a]">{short.user.name}</p>
            <p className="text-xs text-[#a3a3a3]">@{short.user.handle}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="text-center py-2 rounded-lg bg-[#fafafa]">
            <p className="text-lg font-semibold text-[#0a0a0a]">{short.views.toLocaleString()}</p>
            <p className="text-[10px] text-[#a3a3a3]">Views</p>
          </div>
          <div className="text-center py-2 rounded-lg bg-[#fafafa]">
            <p className="text-lg font-semibold text-[#0a0a0a]">{short.likes.toLocaleString()}</p>
            <p className="text-[10px] text-[#a3a3a3]">Likes</p>
          </div>
          <div className="text-center py-2 rounded-lg bg-[#fafafa]">
            <p className="text-lg font-semibold text-[#0a0a0a]">{short.shares.toLocaleString()}</p>
            <p className="text-[10px] text-[#a3a3a3]">Shares</p>
          </div>
        </div>

        <div className="text-xs text-[#a3a3a3] space-y-1">
          <div className="flex justify-between">
            <span>Format</span>
            <span className="capitalize text-[#525252]">{short.format}</span>
          </div>
          <div className="flex justify-between">
            <span>Submitted</span>
            <span className="text-[#525252]">{fmtDate(short.createdAt)}</span>
          </div>
          {short.publishedAt && (
            <div className="flex justify-between">
              <span>Published</span>
              <span className="text-[#525252]">{fmtDate(short.publishedAt)}</span>
            </div>
          )}
        </div>

        {short.rejectionNote && (
          <div className="px-3 py-2.5 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5]/30">
            <p className="text-[10px] font-semibold text-[#DC2626] mb-1">Previous rejection note</p>
            <p className="text-xs text-[#991B1B]">{short.rejectionNote}</p>
          </div>
        )}

        <AnimatePresence>
          {showRejectInput && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="space-y-2">
                <label className="text-xs font-medium text-[#525252]">Rejection reason</label>
                <textarea
                  value={rejectNote}
                  onChange={e => setRejectNote(e.target.value)}
                  placeholder="Tell the creator what needs to change…"
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#fafafa] border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowRejectInput(false); setRejectNote(""); }}
                    className="flex-1 py-2 rounded-lg border border-[#e5e5e5] text-sm text-[#525252] hover:bg-[#fafafa] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={!rejectNote.trim() || loading}
                    className="flex-1 py-2 rounded-lg bg-[#DC2626] text-white text-sm font-medium hover:bg-[#b91c1c] transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
                  >
                    {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Confirm rejection
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!showRejectInput && (
          <div className="space-y-2 pt-1">
            {short.status === "in_review" && (
              <>
                <button
                  onClick={() => onAction("approve")}
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-[#16A34A] text-white text-sm font-medium hover:bg-[#15803d] transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Approve
                </button>
                <button
                  onClick={() => setShowRejectInput(true)}
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-[#FEF2F2] text-[#DC2626] text-sm font-medium hover:bg-[#FEE2E2] transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </button>
              </>
            )}
            {short.status === "approved" && (
              <>
                <button
                  onClick={() => onAction("publish")}
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1d4ed8] transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                  Publish
                </button>
                <button
                  onClick={() => setShowRejectInput(true)}
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-[#FEF2F2] text-[#DC2626] text-sm font-medium hover:bg-[#FEE2E2] transition-colors disabled:opacity-40"
                >
                  Reject
                </button>
              </>
            )}
            {short.status === "published" && (
              <button
                onClick={() => setShowRejectInput(true)}
                disabled={loading}
                className="w-full py-2.5 rounded-xl border border-[#e5e5e5] text-[#525252] text-sm hover:bg-[#fafafa] transition-colors disabled:opacity-40"
              >
                Unpublish &amp; reject
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Uploaders: Detail panel ───────────────────────────────────────────────────

function UploaderDetail({
  uploader,
  onCanPostToggle,
  onBanToggle,
  onDelete,
  actionLoading,
}: {
  uploader: Uploader;
  onCanPostToggle: (id: number, canPost: boolean) => void;
  onBanToggle: (id: number, banned: boolean) => void;
  onDelete: (id: number) => void;
  actionLoading: boolean;
}) {
  const banned = uploader.status === "banned" || uploader.banned;
  const canPost = uploader.canPost ?? false;

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="px-6 pt-6 pb-5 border-b border-[#f5f5f5]">
        <div className="flex items-center gap-3 mb-4">
          <Avatar src={uploader.avatar} name={uploader.name} size={56} className="ring-1 ring-[#e5e5e5]" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-semibold text-[#0a0a0a]">{uploader.name}</span>
              {uploader.verified && (
                <span className="text-[10px] font-semibold text-[#22c55e] bg-[#F0FDF4] px-1.5 py-0.5 rounded-full">Verified</span>
              )}
              {banned && (
                <span className="text-[10px] font-semibold text-[#F44444] bg-[#FFF0F0] px-1.5 py-0.5 rounded-full">Banned</span>
              )}
            </div>
            <p className="text-xs text-[#a3a3a3] mt-0.5">@{uploader.handle}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-[#737373]">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Joined {fmtDate(uploader.joinDate)}
          </span>
        </div>
      </div>

      {/* Profile */}
      <div className="px-6 py-4 border-b border-[#f5f5f5] space-y-2.5">
        <div className="flex items-start gap-3 text-sm">
          <span className="text-[#a3a3a3] text-xs w-14 flex-shrink-0 pt-0.5">Email</span>
          <span className="text-[#0a0a0a] break-all">{uploader.email}</span>
        </div>
        <div className="flex items-start gap-3 text-sm">
          <span className="text-[#a3a3a3] text-xs w-14 flex-shrink-0 pt-0.5">Followers</span>
          <span className="text-[#0a0a0a]">{Number(uploader.followers).toLocaleString()}</span>
        </div>
      </div>

      {/* Permissions */}
      <div className="px-6 py-4 border-b border-[#f5f5f5] space-y-4">
        <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wide">Permissions</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[#0a0a0a]">Can upload</p>
            <p className="text-xs text-[#a3a3a3]">Allow submitting videos</p>
          </div>
          <button
            type="button"
            disabled={actionLoading}
            onClick={() => onCanPostToggle(uploader.id, !canPost)}
            className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 disabled:opacity-50 ${canPost ? "bg-[#F44444]" : "bg-[#e5e5e5]"}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${canPost ? "left-4" : "left-0.5"}`} />
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[#0a0a0a]">Banned</p>
            <p className="text-xs text-[#a3a3a3]">Restrict platform access</p>
          </div>
          <button
            type="button"
            disabled={actionLoading}
            onClick={() => onBanToggle(uploader.id, !banned)}
            className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 disabled:opacity-50 ${banned ? "bg-[#F44444]" : "bg-[#e5e5e5]"}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${banned ? "left-4" : "left-0.5"}`} />
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 py-4 space-y-2">
        <a
          href={`/${uploader.handle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-[#e5e5e5] text-sm text-[#0a0a0a] hover:bg-[#fafafa] transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5 text-[#737373]" />
          View public profile
        </a>
        <button
          onClick={() => onDelete(uploader.id)}
          disabled={actionLoading}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-[#F44444]/20 text-sm text-[#F44444] hover:bg-[#FFF0F0] transition-colors disabled:opacity-50"
        >
          {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          Delete uploader
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminUploadersPage() {
  const [mainTab, setMainTab] = useState(0);

  // ── Moderation state ────────────────────────────────────────────────────────
  const [modTab, setModTab] = useState(0);
  const [modSearch, setModSearch] = useState("");
  const [shorts, setShorts] = useState<Short[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [modPage, setModPage] = useState(1);
  const [modPages, setModPages] = useState(1);
  const [modLoading, setModLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedShort, setSelectedShort] = useState<Short | null>(null);
  const [actionError, setActionError] = useState("");
  const modSearchTimer = useRef<NodeJS.Timeout | null>(null);

  // ── Uploaders state ─────────────────────────────────────────────────────────
  const [uploaders, setUploaders] = useState<Uploader[]>([]);
  const [uploaderLoading, setUploaderLoading] = useState(false);
  const [uploaderFetched, setUploaderFetched] = useState(false);
  const [uploaderSearch, setUploaderSearch] = useState("");
  const [selectedUploader, setSelectedUploader] = useState<Uploader | null>(null);
  const [uploaderActionLoading, setUploaderActionLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Analytics state ─────────────────────────────────────────────────────────
  const [analyticsDays, setAnalyticsDays] = useState<number | null>(30);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // ── Moderation fetch ────────────────────────────────────────────────────────

  const loadShorts = useCallback(async (p = 1) => {
    setModLoading(true);
    try {
      const status = MOD_STATUS[modTab];
      const qs = new URLSearchParams({ status, page: String(p), limit: "30", ...(modSearch ? { search: modSearch } : {}) });
      const res = await fetch(`/api/admin/shorts?${qs}`);
      if (!res.ok) return;
      const data = await res.json();
      setShorts(data.shorts ?? []);
      setModPage(data.page ?? 1);
      setModPages(data.pages ?? 1);
      setStats(data.stats ?? null);
    } finally { setModLoading(false); }
  }, [modTab, modSearch]);

  useEffect(() => { if (mainTab === 2) loadShorts(1); }, [loadShorts, mainTab]);

  const handleModSearch = (v: string) => {
    setModSearch(v);
    if (modSearchTimer.current) clearTimeout(modSearchTimer.current);
    modSearchTimer.current = setTimeout(() => loadShorts(1), 300);
  };

  const handleModTabChange = (i: number) => {
    setModTab(i);
    setSelectedShort(null);
    setModSearch("");
    setModPage(1);
  };

  const handleAction = async (action: string, rejectionNote?: string) => {
    if (!selectedShort) return;
    setActionLoading(true);
    setActionError("");
    try {
      const res = await fetch(`/api/admin/shorts/${selectedShort.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, rejectionNote }),
      });
      const data = await res.json();
      if (!res.ok) { setActionError(data.error ?? "Action failed"); return; }
      const updated: Short = { ...selectedShort, ...data.short };
      setShorts(s => s.map(x => (x.id === selectedShort.id ? updated : x)));
      setSelectedShort(updated);
      loadShorts(modPage);
    } catch {
      setActionError("Something went wrong");
    } finally { setActionLoading(false); }
  };

  // ── Uploaders fetch ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (mainTab !== 0 || uploaderFetched) return;
    setUploaderLoading(true);
    fetch("/api/admin/users?tab=Shorts")
      .then(r => r.ok ? r.json() : [])
      .then(data => { setUploaders(Array.isArray(data) ? data : []); setUploaderFetched(true); })
      .catch(() => {})
      .finally(() => setUploaderLoading(false));
  }, [mainTab, uploaderFetched]);

  const handleCanPostToggle = async (id: number, canPost: boolean) => {
    setUploaderActionLoading(true);
    try {
      await fetch("/api/admin/authors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, canPost }),
      });
      setUploaders(prev => prev.map(u => u.id === id ? { ...u, canPost } : u));
      if (selectedUploader?.id === id) setSelectedUploader(prev => prev ? { ...prev, canPost } : null);
    } finally { setUploaderActionLoading(false); }
  };

  const handleBanToggle = async (id: number, banned: boolean) => {
    setUploaderActionLoading(true);
    try {
      await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: [id], action: banned ? "ban" : "unban" }),
      });
      setUploaders(prev => prev.map(u => u.id === id ? { ...u, status: banned ? "banned" : "active", banned } : u));
      if (selectedUploader?.id === id) setSelectedUploader(prev => prev ? { ...prev, status: banned ? "banned" : "active", banned } : null);
    } finally { setUploaderActionLoading(false); }
  };

  const confirmDeleteUploader = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users?id=${deleteConfirm}`, { method: "DELETE" });
      if (res.ok) {
        setUploaders(prev => prev.filter(u => u.id !== deleteConfirm));
        if (selectedUploader?.id === deleteConfirm) setSelectedUploader(null);
      }
    } finally { setDeleting(false); setDeleteConfirm(null); }
  };

  // ── Analytics fetch ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (mainTab !== 1) return;
    let alive = true;
    setAnalyticsLoading(true);
    fetch(`/api/admin/analytics/uploaders?days=${analyticsDays ?? "all"}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (alive && d) setAnalyticsData(d); })
      .catch(() => {})
      .finally(() => { if (alive) setAnalyticsLoading(false); });
    return () => { alive = false; };
  }, [mainTab, analyticsDays]);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const uploaderSearchQ = uploaderSearch.toLowerCase();
  const filteredUploaders = uploaders.filter(u =>
    !uploaderSearchQ ||
    u.name.toLowerCase().includes(uploaderSearchQ) ||
    u.handle.toLowerCase().includes(uploaderSearchQ) ||
    u.email.toLowerCase().includes(uploaderSearchQ)
  );

  const ukpis = analyticsData?.kpis ?? {};

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#f0f0f0] flex-shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <AdminPillTabs tabs={MAIN_TABS} activeTab={mainTab} onTabChange={i => { setMainTab(i); setSelectedShort(null); setSelectedUploader(null); }} />
          {mainTab === 2 && stats && (
            <div className="flex items-center gap-4 text-xs text-[#a3a3a3]">
              <span><span className="font-semibold text-[#D97706]">{stats.in_review}</span> in review</span>
              <span><span className="font-semibold text-[#16A34A]">{stats.approved}</span> approved</span>
              <span><span className="font-semibold text-[#2563EB]">{stats.published}</span> published</span>
            </div>
          )}
          {mainTab === 0 && (
            <p className="text-xs text-[#a3a3a3]">{uploaders.length} uploaders</p>
          )}
        </div>

        {mainTab === 0 && (
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#c0c0c0]" />
            <input
              type="text"
              value={uploaderSearch}
              onChange={e => setUploaderSearch(e.target.value)}
              placeholder="Search uploaders…"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#fafafa] border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all"
            />
          </div>
        )}

        {mainTab === 2 && (
          <div className="flex items-center justify-between gap-4">
            <AdminPillTabs tabs={MOD_TABS} activeTab={modTab} onTabChange={handleModTabChange} />
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#c0c0c0]" />
              <input
                type="text"
                value={modSearch}
                onChange={e => handleModSearch(e.target.value)}
                placeholder="Search videos…"
                className="pl-9 pr-3 py-2 rounded-lg bg-[#fafafa] border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all w-52"
              />
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 flex">

        {/* ── Uploaders tab ─────────────────────────────────────────────────── */}
        {mainTab === 0 && (
          <>
            <div className={`flex-shrink-0 border-r border-[#f0f0f0] overflow-y-auto ${selectedUploader ? "w-80" : "w-full"}`}>
              {uploaderLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-16 rounded-xl bg-[#f5f5f5] animate-pulse" />
                  ))}
                </div>
              ) : filteredUploaders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Upload className="w-8 h-8 text-[#e5e5e5] mb-3" />
                  <p className="text-sm text-[#a3a3a3]">{uploaderSearch ? "No uploaders match your search." : "No uploaders yet."}</p>
                </div>
              ) : (
                filteredUploaders.map((u, i) => {
                  const banned = u.status === "banned" || u.banned;
                  return (
                    <button
                      key={u.id}
                      onClick={() => setSelectedUploader(selectedUploader?.id === u.id ? null : u)}
                      className={`w-full text-left flex items-center gap-3 px-5 py-3.5 border-b border-[#f0f0f0] transition-colors ${selectedUploader?.id === u.id ? "bg-[#fafafa]" : "hover:bg-[#fafafa]"}`}
                    >
                      <Avatar src={u.avatar} name={u.name} size={36} className="ring-1 ring-[#e5e5e5]" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-[#0a0a0a] truncate">{u.name}</span>
                          {u.verified && <span className="text-[10px] font-semibold text-[#22c55e] bg-[#F0FDF4] px-1.5 py-0.5 rounded-full flex-shrink-0">Verified</span>}
                          {banned && <span className="text-[10px] font-semibold text-[#F44444] bg-[#FFF0F0] px-1.5 py-0.5 rounded-full flex-shrink-0">Banned</span>}
                        </div>
                        <p className="text-xs text-[#a3a3a3]">@{u.handle}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div
                          className="flex flex-col items-center gap-0.5"
                          onClick={e => { e.stopPropagation(); handleCanPostToggle(u.id, !(u.canPost ?? false)); }}
                        >
                          <button
                            type="button"
                            className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer ${u.canPost ? "bg-[#F44444]" : "bg-[#e5e5e5]"}`}
                          >
                            <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${u.canPost ? "left-4" : "left-0.5"}`} />
                          </button>
                          <span className="text-[9px] text-[#c0c0c0]">upload</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-[#d4d4d4]" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <AnimatePresence>
              {selectedUploader && (
                <motion.div
                  key={selectedUploader.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ type: "spring", stiffness: 400, damping: 35, duration: 0.15 }}
                  className="flex-1 min-w-0 flex flex-col border-l border-[#f0f0f0]"
                >
                  <div className="px-5 py-3 border-b border-[#f0f0f0] flex items-center justify-between flex-shrink-0">
                    <p className="text-sm font-medium text-[#0a0a0a] truncate mr-4">{selectedUploader.name}</p>
                    <button
                      onClick={() => setSelectedUploader(null)}
                      className="p-1.5 rounded-lg hover:bg-[#f5f5f5] transition-colors flex-shrink-0"
                    >
                      <X className="w-4 h-4 text-[#737373]" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <UploaderDetail
                      uploader={selectedUploader}
                      onCanPostToggle={handleCanPostToggle}
                      onBanToggle={handleBanToggle}
                      onDelete={id => setDeleteConfirm(id)}
                      actionLoading={uploaderActionLoading}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* ── Analytics tab ─────────────────────────────────────────────────── */}
        {mainTab === 1 && (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Range filter */}
            <div className="flex items-center gap-1">
              {UPLOAD_RANGES.map(r => (
                <button
                  key={r.label}
                  onClick={() => setAnalyticsDays(r.days)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    analyticsDays === r.days ? "bg-[#F44444] text-white" : "text-[#737373] hover:text-[#0a0a0a]"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {analyticsLoading && !analyticsData ? (
              <div className="py-20 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-[#a3a3a3]" />
              </div>
            ) : (
              <>
                {/* KPI cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: "Total uploads",    value: fmtU(ukpis.totalShorts ?? 0),   sub: `${ukpis.periodUploads ?? 0} this period` },
                    { label: "Total views",      value: fmtU(ukpis.totalViews ?? 0),    sub: `${fmtU(ukpis.avgViews ?? 0)} avg per video` },
                    { label: "Total likes",      value: fmtU(ukpis.totalLikes ?? 0),    sub: null },
                    { label: "Approval rate",    value: `${ukpis.approvalRate ?? 0}%`,  sub: `${ukpis.published ?? 0} published` },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl border border-[#e5e5e5] bg-white p-4">
                      <p className="text-xs text-[#737373] mb-1">{s.label}</p>
                      <p className="text-2xl font-bold text-[#0a0a0a]">{s.value}</p>
                      {s.sub && <p className="text-xs text-[#a3a3a3] mt-1">{s.sub}</p>}
                    </div>
                  ))}
                </div>

                {/* Uploads over time + status breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-4">
                  <div className="rounded-xl border border-[#e5e5e5] bg-white">
                    <div className="px-5 pt-5 pb-3">
                      <p className="text-sm font-semibold text-[#0a0a0a]">Uploads over time</p>
                      <p className="text-xs text-[#a3a3a3] mt-0.5">Videos submitted per day</p>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={analyticsData?.dailySeries ?? []} margin={{ top: 4, right: 20, bottom: 0, left: 4 }}>
                        <defs>
                          <linearGradient id="uplGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#F44444" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#F44444" stopOpacity={0}    />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#a3a3a3" }} interval="preserveStartEnd" dy={8} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#a3a3a3" }} width={28} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{ borderRadius: 10, border: "1px solid #e5e5e5", fontSize: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}
                          labelStyle={{ color: "#0a0a0a", fontWeight: 600 }}
                          cursor={false}
                          formatter={(v: any) => [v, "Uploads"]}
                        />
                        <Area type="monotone" dataKey="uploads" stroke="#F44444" strokeWidth={2} fill="url(#uplGrad)" dot={false} activeDot={{ r: 4, fill: "#F44444", stroke: "white", strokeWidth: 2 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Status breakdown */}
                  <div className="rounded-xl border border-[#e5e5e5] bg-white p-5">
                    <p className="text-sm font-semibold text-[#0a0a0a] mb-4">Status breakdown</p>
                    {(analyticsData?.statusBreakdown ?? []).length === 0 ? (
                      <p className="text-xs text-[#a3a3a3] text-center py-6">No videos yet</p>
                    ) : (
                      <div className="space-y-3">
                        {(analyticsData?.statusBreakdown ?? []).map((s: any) => {
                          const total = Math.max(1, ukpis.totalShorts ?? 1);
                          const pct = Math.round((s.count / total) * 100);
                          return (
                            <div key={s.status}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-[#525252]">{s.status}</span>
                                <span className="text-xs font-medium tabular-nums" style={{ color: s.color }}>{s.count}</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-[#f5f5f5] overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: s.color }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Top uploaders */}
                {(analyticsData?.topUploaders ?? []).length > 0 && (
                  <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-[#f5f5f5]">
                      <p className="text-sm font-semibold text-[#0a0a0a]">Top uploaders by video count</p>
                    </div>
                    {(analyticsData?.topUploaders ?? []).map((u: any, i: number) => (
                      <div key={u.id} className={`flex items-center gap-3 px-5 py-3 ${i < (analyticsData.topUploaders.length - 1) ? "border-b border-[#f5f5f5]" : ""} hover:bg-[#fafafa] transition-colors`}>
                        <span className="text-xs text-[#c0c0c0] w-5 text-right flex-shrink-0">{i + 1}</span>
                        <Avatar src={u.avatar} name={u.name} size={32} className="ring-1 ring-[#e5e5e5]" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#0a0a0a] truncate">{u.name}</p>
                          <p className="text-xs text-[#a3a3a3]">@{u.handle}</p>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0 text-right">
                          <div>
                            <p className="text-sm font-semibold text-[#0a0a0a]">{fmtU(u.shortCount)}</p>
                            <p className="text-[10px] text-[#a3a3a3]">videos</p>
                          </div>
                          <div className="hidden sm:block">
                            <p className="text-sm font-semibold text-[#0a0a0a]">{fmtU(u.totalViews)}</p>
                            <p className="text-[10px] text-[#a3a3a3]">views</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Moderation tab ────────────────────────────────────────────────── */}
        {mainTab === 2 && (
          <>
            <div className={`flex-shrink-0 border-r border-[#f0f0f0] overflow-y-auto ${selectedShort ? "w-80" : "w-full"}`}>
              {modLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-20 rounded-xl bg-[#f5f5f5] animate-pulse" />
                  ))}
                </div>
              ) : shorts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Video className="w-8 h-8 text-[#e5e5e5] mb-3" />
                  <p className="text-sm text-[#a3a3a3]">No videos found</p>
                </div>
              ) : (
                <>
                  {shorts.map(s => (
                    <ShortRow
                      key={s.id}
                      short={s}
                      active={selectedShort?.id === s.id}
                      onClick={() => { setSelectedShort(s); setActionError(""); }}
                    />
                  ))}
                  {modPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-[#f0f0f0]">
                      <span className="text-xs text-[#a3a3a3]">Page {modPage} of {modPages}</span>
                      <div className="flex gap-2">
                        <button onClick={() => loadShorts(modPage - 1)} disabled={modPage === 1}
                          className="px-2.5 py-1 rounded-lg border border-[#e5e5e5] text-xs text-[#525252] hover:bg-[#fafafa] disabled:opacity-40">Previous</button>
                        <button onClick={() => loadShorts(modPage + 1)} disabled={modPage === modPages}
                          className="px-2.5 py-1 rounded-lg border border-[#e5e5e5] text-xs text-[#525252] hover:bg-[#fafafa] disabled:opacity-40">Next</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <AnimatePresence>
              {selectedShort && (
                <motion.div
                  key={selectedShort.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ type: "spring", stiffness: 400, damping: 35, duration: 0.15 }}
                  className="flex-1 min-w-0 flex flex-col"
                >
                  <div className="px-5 py-3 border-b border-[#f0f0f0] flex items-center justify-between flex-shrink-0">
                    <p className="text-sm font-medium text-[#0a0a0a] truncate mr-4">{selectedShort.title}</p>
                    <button onClick={() => setSelectedShort(null)} className="p-1.5 rounded-lg hover:bg-[#f5f5f5] transition-colors flex-shrink-0">
                      <X className="w-4 h-4 text-[#737373]" />
                    </button>
                  </div>
                  {actionError && (
                    <div className="mx-5 mt-3 px-3 py-2 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5]/30">
                      <p className="text-xs text-[#DC2626]">{actionError}</p>
                    </div>
                  )}
                  <div className="flex-1 overflow-hidden">
                    <ModerationDetail short={selectedShort} onAction={handleAction} loading={actionLoading} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      <ConfirmModal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={confirmDeleteUploader}
        title="Delete Uploader"
        message="Remove this uploader from Albiz? This cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isSubmitting={deleting}
      />
    </div>
  );
}
