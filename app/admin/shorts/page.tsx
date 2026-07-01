"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Video, X, Loader2, Check, XCircle, Eye, Heart, Share2, ChevronRight } from "lucide-react";
import { AdminPillTabs, ConfirmModal } from "../admin-components";

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

const TABS = ["In Review", "Approved", "Published", "Rejected", "All"];
const TAB_STATUS = ["in_review", "approved", "published", "rejected", "all"];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: "Draft",     color: "#737373", bg: "#f5f5f5" },
  in_review: { label: "In Review", color: "#D97706", bg: "#FEF3C7" },
  approved:  { label: "Approved",  color: "#16A34A", bg: "#F0FDF4" },
  published: { label: "Published", color: "#2563EB", bg: "#EFF6FF" },
  rejected:  { label: "Rejected",  color: "#DC2626", bg: "#FEF2F2" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}>
      {cfg.label}
    </span>
  );
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

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

function DetailPanel({
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
      {/* Video */}
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
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-[#0a0a0a] leading-snug">{short.title}</p>
            {short.description && (
              <p className="text-sm text-[#737373] mt-1 leading-relaxed">{short.description}</p>
            )}
          </div>
          <StatusBadge status={short.status} />
        </div>

        {/* Creator */}
        <div className="flex items-center gap-2.5 py-3 border-y border-[#f0f0f0]">
          <div className="w-8 h-8 rounded-full bg-[#f0f0f0] flex-shrink-0 overflow-hidden flex items-center justify-center">
            {short.user.avatar
              ? <img src={short.user.avatar} alt={short.user.name} className="w-full h-full object-cover" />
              : <span className="text-xs font-semibold text-[#525252]">{short.user.name[0]}</span>
            }
          </div>
          <div>
            <p className="text-sm font-medium text-[#0a0a0a]">{short.user.name}</p>
            <p className="text-xs text-[#a3a3a3]">@{short.user.handle}</p>
          </div>
        </div>

        {/* Meta */}
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

        {/* Existing rejection note */}
        {short.rejectionNote && (
          <div className="px-3 py-2.5 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5]/30">
            <p className="text-[10px] font-semibold text-[#DC2626] mb-1">Previous rejection note</p>
            <p className="text-xs text-[#991B1B]">{short.rejectionNote}</p>
          </div>
        )}

        {/* Reject input */}
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

        {/* Action buttons */}
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

export default function AdminShortsPage() {
  const [activeTab,    setActiveTab]    = useState(0);
  const [search,       setSearch]       = useState("");
  const [shorts,       setShorts]       = useState<Short[]>([]);
  const [stats,        setStats]        = useState<Stats | null>(null);
  const [total,        setTotal]        = useState(0);
  const [page,         setPage]         = useState(1);
  const [pages,        setPages]        = useState(1);
  const [loading,      setLoading]      = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selected,     setSelected]     = useState<Short | null>(null);
  const [actionError,  setActionError]  = useState("");
  const searchTimer = useRef<NodeJS.Timeout | null>(null);

  const loadShorts = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const status = TAB_STATUS[activeTab];
      const qs = new URLSearchParams({
        status,
        page:  String(p),
        limit: "30",
        ...(search ? { search } : {}),
      });
      const res = await fetch(`/api/admin/shorts?${qs}`);
      if (!res.ok) return;
      const data = await res.json();
      setShorts(data.shorts ?? []);
      setTotal(data.total ?? 0);
      setPage(data.page ?? 1);
      setPages(data.pages ?? 1);
      setStats(data.stats ?? null);
    } finally {
      setLoading(false);
    }
  }, [activeTab, search]);

  useEffect(() => { loadShorts(1); }, [loadShorts]);

  const handleSearch = (v: string) => {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadShorts(1), 300);
  };

  const handleTabChange = (i: number) => {
    setActiveTab(i);
    setSelected(null);
    setSearch("");
    setPage(1);
  };

  const handleAction = async (action: string, rejectionNote?: string) => {
    if (!selected) return;
    setActionLoading(true);
    setActionError("");
    try {
      const res = await fetch(`/api/admin/shorts/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, rejectionNote }),
      });
      const data = await res.json();
      if (!res.ok) { setActionError(data.error ?? "Action failed"); return; }

      // Update in-place
      const updated: Short = { ...selected, ...data.short };
      setShorts(s => s.map(x => (x.id === selected.id ? updated : x)));
      setSelected(updated);

      // Refresh stats
      loadShorts(page);
    } catch {
      setActionError("Something went wrong");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-5 border-b border-[#f0f0f0] flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <p className="text-lg font-semibold text-[#0a0a0a]">Shorts</p>
          {stats && (
            <div className="flex items-center gap-4 text-xs text-[#a3a3a3]">
              <span><span className="font-semibold text-[#D97706]">{stats.in_review}</span> in review</span>
              <span><span className="font-semibold text-[#16A34A]">{stats.approved}</span> approved</span>
              <span><span className="font-semibold text-[#2563EB]">{stats.published}</span> published</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          <AdminPillTabs tabs={TABS} activeTab={activeTab} onTabChange={handleTabChange} />
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#c0c0c0]" />
            <input
              type="text"
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search shorts…"
              className="pl-9 pr-3 py-2 rounded-lg bg-[#fafafa] border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all w-56"
            />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 flex">
        {/* List */}
        <div className={`flex-shrink-0 border-r border-[#f0f0f0] overflow-y-auto ${selected ? "w-80" : "w-full"}`}>
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-20 rounded-xl bg-[#f5f5f5] animate-pulse" />
              ))}
            </div>
          ) : shorts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Video className="w-8 h-8 text-[#e5e5e5] mb-3" />
              <p className="text-sm text-[#a3a3a3]">No shorts found</p>
            </div>
          ) : (
            <>
              {shorts.map(s => (
                <ShortRow
                  key={s.id}
                  short={s}
                  active={selected?.id === s.id}
                  onClick={() => { setSelected(s); setActionError(""); }}
                />
              ))}
              {pages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-[#f0f0f0]">
                  <span className="text-xs text-[#a3a3a3]">Page {page} of {pages}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => loadShorts(page - 1)}
                      disabled={page === 1}
                      className="px-2.5 py-1 rounded-lg border border-[#e5e5e5] text-xs text-[#525252] hover:bg-[#fafafa] disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => loadShorts(page + 1)}
                      disabled={page === pages}
                      className="px-2.5 py-1 rounded-lg border border-[#e5e5e5] text-xs text-[#525252] hover:bg-[#fafafa] disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Detail panel */}
        <AnimatePresence>
          {selected && (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ type: "spring", stiffness: 400, damping: 35, duration: 0.15 }}
              className="flex-1 min-w-0 flex flex-col"
            >
              {/* Panel header */}
              <div className="px-5 py-3 border-b border-[#f0f0f0] flex items-center justify-between flex-shrink-0">
                <p className="text-sm font-medium text-[#0a0a0a] truncate mr-4">{selected.title}</p>
                <button
                  onClick={() => setSelected(null)}
                  className="p-1.5 rounded-lg hover:bg-[#f5f5f5] transition-colors flex-shrink-0"
                >
                  <X className="w-4 h-4 text-[#737373]" />
                </button>
              </div>

              {actionError && (
                <div className="mx-5 mt-3 px-3 py-2 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5]/30">
                  <p className="text-xs text-[#DC2626]">{actionError}</p>
                </div>
              )}

              <div className="flex-1 overflow-hidden">
                <DetailPanel
                  short={selected}
                  onAction={handleAction}
                  loading={actionLoading}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
