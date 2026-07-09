"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye, EyeOff, ArrowLeft, ImagePlus, MoreVertical,
  Hash, Plus, Search, Star, Clock, BookOpen,
  Check, X, RotateCcw, Loader2, AlertCircle,
  FileText, ChevronRight, Archive, RefreshCw, Calendar,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { AdminPillTabs, StatusBadge, UserAvatar, AdminModal, Dropdown } from "../admin-components";
import { sanitizeHtml } from "@/lib/html-sanitize";
import { RichEditor } from "./RichEditor";
import type { PostStatus } from "@/lib/editor-workflow";

// ─── Workflow config ───────────────────────────────────────────────────────────
// This is intentionally a curated subset (the linear "happy path" only, no
// scheduled/rejected/archived) for the step-progress bar below — but it's now
// typed against the single authoritative PostStatus union instead of the
// separate, independently-drifted ArticleWorkflowStatus type that used to
// live in admin-data.ts (audit finding M-2).

const workflowSteps: { key: PostStatus; label: string; color: string }[] = [
  { key: "draft",              label: "Draft",             color: "#525252" },
  { key: "submitted",          label: "Submitted",         color: "#3B82F6" },
  { key: "under_review",       label: "Under Review",      color: "#F59E0B" },
  { key: "revision_requested", label: "Revision Req.",     color: "#F44444" },
  { key: "approved",           label: "Approved",          color: "#22c55e" },
  { key: "published",          label: "Published",         color: "#22c55e" },
];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft:              { bg: "#f5f5f5",     text: "#525252" },
  submitted:          { bg: "#DBEAFE",     text: "#2563EB" },
  under_review:       { bg: "#FEF3C7",     text: "#D97706" },
  revision_requested: { bg: "#FEE2E2",     text: "#DC2626" },
  approved:           { bg: "#ECFCCB",     text: "#4D7C0F" },
  published:          { bg: "#DCFCE7",     text: "#16A34A" },
  scheduled:          { bg: "#EDE9FE",     text: "#7C3AED" },
  rejected:           { bg: "#FEE2E2",     text: "#DC2626" },
  archived:           { bg: "#f5f5f5",     text: "#737373" },
};

function WorkflowBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? { bg: "#f5f5f5", text: "#525252" };
  const label = status.replace(/_/g, " ").replace(/\b\w/g, s => s.toUpperCase());
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
      style={{ backgroundColor: c.bg, color: c.text }}>
      {label}
    </span>
  );
}

// ─── KPI cards ────────────────────────────────────────────────────────────────

interface NewsStats {
  total: number; draft: number; submitted: number; under_review: number;
  revision_requested: number; approved: number; published: number;
  published_today: number; scheduled: number; rejected: number;
  archived: number; pending: number; approvalRate: number;
  trend: { date: string; count: number }[];
  topAuthors: { id: number; name: string; handle: string; avatar: string; count: number }[];
}

function KpiCards({ stats }: { stats: NewsStats | null }) {
  const cards = [
    { label: "Total Articles",   value: stats?.total          ?? "—", accent: "#0a0a0a" },
    { label: "Pending Review",   value: stats?.pending         ?? "—", accent: "#F59E0B" },
    { label: "Approved",         value: stats?.approved        ?? "—", accent: "#22c55e" },
    { label: "Published Today",  value: stats?.published_today ?? "—", accent: "#F44444" },
    { label: "Scheduled",        value: stats?.scheduled       ?? "—", accent: "#7C3AED" },
    { label: "Rejected",         value: stats?.rejected        ?? "—", accent: "#DC2626" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {cards.map(c => (
        <div key={c.label} className="rounded-xl border border-[#e5e5e5] bg-white p-4">
          <p className="text-[10px] text-[#a3a3a3] font-medium mb-1.5">{c.label}</p>
          {stats ? (
            <p className="text-2xl font-bold" style={{ color: c.accent }}>{c.value}</p>
          ) : (
            <div className="h-7 w-12 bg-[#ebebeb] rounded animate-pulse" />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Article card for editorial queue ─────────────────────────────────────────

interface Article {
  id: number; userId: number; userName: string; userHandle: string;
  avatar: string; type: string; title: string; description: string;
  content: string; date: string; createdAt: string; publishAt: string | null;
  image: string | null; tags: string[]; views: string; likes: string;
  comments: string; status: string; featured: boolean; pinned: boolean;
  flagged: boolean; flagReason: string | null;
  sectionId: number | null; section: { id: number; name: string; color: string } | null;
  assignedEditorId: number | null;
  assignedEditor: { id: number; name: string; handle: string; avatar: string } | null;
  wordCount: number;
}

function ArticleCard({
  article,
  onAction,
  onEdit,
  onRequestRevision,
  onSchedule,
}: {
  article: Article;
  onAction: (id: number, action: string) => void;
  onEdit: (a: Article) => void;
  onRequestRevision: (id: number, title: string) => void;
  onSchedule: (id: number) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const readTime = article.wordCount > 0 ? Math.max(1, Math.ceil(article.wordCount / 200)) : 0;

  const fmtDate = (iso: string) => {
    if (!iso) return "";
    try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
    catch { return iso; }
  };

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);

  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white hover:border-[#d5d5d5] transition-colors">
      <div className="flex gap-0 p-4">
        {/* Thumbnail */}
        {article.image && (
          <div className="w-24 h-16 rounded-lg overflow-hidden flex-shrink-0 hidden sm:block mr-4 bg-[#f5f5f5]">
            <Image src={article.image} alt={article.title ?? ""} width={96} height={64} className="object-cover w-full h-full" />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 mb-1.5">
            <h3 className="font-medium text-sm text-[#0a0a0a] flex-1 min-w-0 line-clamp-1">{article.title}</h3>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {article.featured && <Star className="w-3 h-3 text-[#F44444] fill-current flex-shrink-0" />}
              <WorkflowBadge status={article.status} />
              {article.section && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 hidden sm:inline"
                  style={{ background: (article.section.color ?? "#525252") + "20", color: article.section.color ?? "#525252" }}>
                  {article.section.name}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#737373] mb-2 flex-wrap">
            <UserAvatar src={article.avatar} alt={article.userName} size={16} />
            <span className="text-[#525252] font-medium">{article.userName}</span>
            {article.assignedEditor && (
              <>
                <span className="text-[#d5d5d5]">→ ed:</span>
                <span>{article.assignedEditor.name}</span>
              </>
            )}
            <span className="text-[#e5e5e5]">·</span>
            <span>{article.date || fmtDate(article.createdAt)}</span>
            {article.wordCount > 0 && (
              <>
                <span className="text-[#e5e5e5]">·</span>
                <span className="flex items-center gap-0.5"><BookOpen className="w-3 h-3" /> {article.wordCount.toLocaleString()} words</span>
                <span className="text-[#e5e5e5]">·</span>
                <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> {readTime} min</span>
              </>
            )}
            {article.publishAt && article.status === "scheduled" && (
              <>
                <span className="text-[#e5e5e5]">·</span>
                <span className="flex items-center gap-0.5 text-[#7C3AED]"><Calendar className="w-3 h-3" /> {fmtDate(article.publishAt)}</span>
              </>
            )}
          </div>

          {article.tags.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {article.tags.slice(0, 5).map(tag => (
                <span key={tag} className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#f5f5f5] text-[#737373]">{tag}</span>
              ))}
            </div>
          )}

          {article.flagReason && article.status === "revision_requested" && (
            <div className="px-3 py-2 rounded-lg bg-[#FFF5F5] border border-[#FFD4D4] mt-2">
              <span className="text-xs text-[#F44444] flex items-center gap-1">
                <AlertCircle className="w-3 h-3 flex-shrink-0" /> {article.flagReason}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-start gap-1.5 ml-3 flex-shrink-0 mt-0.5">
          {/* Primary action per status */}
          {article.status === "draft" && (
            <button onClick={() => onAction(article.id, "submit")}
              className="px-2.5 py-1.5 text-[11px] font-medium rounded-full bg-[#3B82F6] text-white hover:bg-[#2563EB] transition-colors whitespace-nowrap">
              Submit
            </button>
          )}
          {article.status === "submitted" && (
            <button onClick={() => onAction(article.id, "start_review")}
              className="px-2.5 py-1.5 text-[11px] font-medium rounded-full bg-[#F59E0B] text-white hover:bg-[#D97706] transition-colors whitespace-nowrap">
              Start Review
            </button>
          )}
          {article.status === "under_review" && (
            <>
              <button onClick={() => onAction(article.id, "approve")}
                className="px-2.5 py-1.5 text-[11px] font-medium rounded-full bg-[#22c55e] text-white hover:bg-[#16a34a] transition-colors flex items-center gap-1">
                <Check className="w-3 h-3" /> Approve
              </button>
              <button onClick={() => onRequestRevision(article.id, article.title)}
                className="px-2.5 py-1.5 text-[11px] font-medium rounded-full bg-[#F59E0B] text-white hover:bg-[#D97706] transition-colors">
                Revision
              </button>
            </>
          )}
          {article.status === "approved" && (
            <>
              <button onClick={() => onAction(article.id, "publish")}
                className="px-2.5 py-1.5 text-[11px] font-medium rounded-full bg-[#F44444] text-white hover:bg-[#d64d3c] transition-colors whitespace-nowrap">
                Publish
              </button>
              <button onClick={() => onSchedule(article.id)}
                className="px-2.5 py-1.5 text-[11px] font-medium rounded-full border border-[#e5e5e5] text-[#525252] hover:bg-[#fafafa] transition-colors">
                <Calendar className="w-3 h-3" />
              </button>
            </>
          )}
          {article.status === "scheduled" && (
            <button onClick={() => onAction(article.id, "unschedule")}
              className="px-2.5 py-1.5 text-[11px] font-medium rounded-full border border-[#e5e5e5] text-[#525252] hover:bg-[#fafafa] transition-colors whitespace-nowrap">
              Unschedule
            </button>
          )}
          {article.status === "published" && (
            <button onClick={() => onAction(article.id, "unpublish")}
              className="px-2.5 py-1.5 text-[11px] font-medium rounded-full border border-[#e5e5e5] text-[#525252] hover:bg-[#fafafa] transition-colors whitespace-nowrap">
              Unpublish
            </button>
          )}
          {(article.status === "rejected" || article.status === "archived") && (
            <button onClick={() => onAction(article.id, "restore_draft")}
              className="px-2.5 py-1.5 text-[11px] font-medium rounded-full border border-[#e5e5e5] text-[#525252] hover:bg-[#fafafa] transition-colors flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Restore
            </button>
          )}
          {article.status === "revision_requested" && (
            <span className="text-xs text-[#a3a3a3] py-1.5">Awaiting author…</span>
          )}

          {/* Edit */}
          <button onClick={() => onEdit(article)}
            className="px-2 py-1.5 text-[11px] font-medium rounded-full text-[#525252] hover:bg-[#f5f5f5] transition-colors">
            Edit
          </button>

          {/* Three-dot menu */}
          <div className="relative">
            <button onClick={e => { e.stopPropagation(); setMenuOpen(o => !o); }}
              className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors">
              <MoreVertical className="w-3.5 h-3.5 text-[#737373]" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.12)] border border-[#e5e5e5] py-1 z-30">
                {/* "Approve directly" (submitted -> approved, skipping under_review)
                    used to work only because the admin PATCH route bypassed
                    the state machine entirely — the exact integrity gap the
                    audit flagged (finding C-7). Now that SIMPLE_TRANSITIONS
                    routes through transitionPostState, this action always
                    fails validation, so the shortcut is removed rather than
                    left as a dead, error-producing menu item. The legitimate
                    path is the "Start Review" then "Approve" primary actions
                    above, which still work and now correctly go through
                    under_review. */}
                {["under_review", "approved", "revision_requested"].includes(article.status) && (
                  <button onClick={() => { onAction(article.id, "reject"); setMenuOpen(false); }}
                    className="w-full text-left px-3.5 py-2 text-xs text-[#F44444] hover:bg-[#fafafa]">
                    Reject
                  </button>
                )}
                {article.status !== "archived" && !["rejected"].includes(article.status) && (
                  <button onClick={() => { onAction(article.id, "archive"); setMenuOpen(false); }}
                    className="w-full text-left px-3.5 py-2 text-xs text-[#737373] hover:bg-[#fafafa] flex items-center gap-2">
                    <Archive className="w-3 h-3" /> Archive
                  </button>
                )}
                {article.status === "approved" && (
                  <button onClick={() => { onSchedule(article.id); setMenuOpen(false); }}
                    className="w-full text-left px-3.5 py-2 text-xs text-[#7C3AED] hover:bg-[#fafafa] flex items-center gap-2">
                    <Calendar className="w-3 h-3" /> Schedule
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Editorial Queue Tab ───────────────────────────────────────────────────────

const QUEUE_TABS = ["All", "Draft", "Submitted", "Under Review", "Revision Req.", "Approved", "Scheduled", "Published", "Rejected", "Archived"];
const QUEUE_STATUS_VALUES = [null, "draft", "submitted", "under_review", "revision_requested", "approved", "scheduled", "published", "rejected", "archived"];

function EditorialQueueTab({ onEdit }: { onEdit: (a: any) => void }) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [revisionModal, setRevisionModal] = useState<{ id: number; title: string } | null>(null);
  const [revisionNote, setRevisionNote] = useState("");
  const [scheduleModal, setScheduleModal] = useState<{ id: number } | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ type: "article" });
    const statusVal = QUEUE_STATUS_VALUES[statusFilter];
    if (statusVal) params.set("status", statusVal);
    if (searchQuery.trim()) params.set("search", searchQuery.trim());
    try {
      const res = await fetch(`/api/admin/posts?${params}`);
      const data = await res.json();
      setArticles(Array.isArray(data) ? data : []);
    } catch {
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => { load(); }, [load]);

  const doAction = async (postId: number, action: string, extra?: Record<string, unknown>) => {
    setActionLoading(postId);
    try {
      const res = await fetch("/api/admin/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, action, ...extra }),
      });
      if (res.ok) {
        const json = await res.json();
        const newStatus = json.status;
        const filterStatus = QUEUE_STATUS_VALUES[statusFilter];
        if (filterStatus && newStatus !== filterStatus) {
          setArticles(prev => prev.filter(a => a.id !== postId));
        } else {
          setArticles(prev => prev.map(a => a.id === postId ? { ...a, status: newStatus ?? a.status } : a));
        }
      }
    } finally {
      setActionLoading(null);
    }
  };

  const confirmRevision = () => {
    if (!revisionModal || !revisionNote.trim()) return;
    doAction(revisionModal.id, "request_revision");
    setRevisionModal(null);
    setRevisionNote("");
  };

  const confirmSchedule = async () => {
    if (!scheduleModal || !scheduleDate) return;
    setScheduling(true);
    try {
      const publishAt = new Date(scheduleDate).toISOString();
      const res = await fetch("/api/admin/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: scheduleModal.id, action: "schedule", publishAt }),
      });
      if (res.ok) {
        const json = await res.json();
        setArticles(prev => prev.map(a =>
          a.id === scheduleModal.id ? { ...a, status: "scheduled", publishAt: json.publishAt } : a
        ));
      }
    } finally {
      setScheduling(false);
      setScheduleModal(null);
      setScheduleDate("");
    }
  };

  return (
    <div>
      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-[#a3a3a3] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search articles..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-white border border-[#e5e5e5] text-xs outline-none focus:border-[#a3a3a3] transition-all"
          />
        </div>
        <div className="flex-1 min-w-0">
          <AdminPillTabs tabs={QUEUE_TABS} activeTab={statusFilter} onTabChange={setStatusFilter} />
        </div>
      </div>

      {/* Workflow steps */}
      <div className="rounded-xl border border-[#e5e5e5] bg-white p-4 mb-4">
        <div className="flex items-center justify-between gap-1">
          {workflowSteps.filter(s => s.key !== "revision_requested").map((step, i, arr) => (
            <div key={step.key} className="flex items-center gap-1 flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold" style={{ backgroundColor: step.color }}>
                  {i + 1}
                </div>
                <span className="text-[10px] text-[#737373] mt-1 text-center leading-tight">{step.label}</span>
              </div>
              {i < arr.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-[#d5d5d5] flex-shrink-0 mb-3" />}
            </div>
          ))}
        </div>
      </div>

      {/* Article list */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[#e5e5e5] bg-white animate-pulse">
              <div className="flex gap-4 p-4">
                <div className="w-24 h-16 rounded-lg bg-[#ebebeb] flex-shrink-0 hidden sm:block" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[#ebebeb] rounded" style={{ width: `${50 + i * 10}%` }} />
                  <div className="h-3 bg-[#ebebeb] rounded w-48" />
                  <div className="flex gap-1">
                    <div className="h-4 w-12 bg-[#ebebeb] rounded-full" />
                    <div className="h-4 w-16 bg-[#ebebeb] rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="rounded-xl border border-[#e5e5e5] bg-white px-5 py-14 text-center">
          <p className="text-sm font-medium text-[#0a0a0a] mb-1">No articles found</p>
          <p className="text-xs text-[#a3a3a3]">
            {searchQuery ? "Try a different search term." : "Articles in this stage will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {articles.map(article => (
            <div key={article.id} className={actionLoading === article.id ? "opacity-60 pointer-events-none" : ""}>
              <ArticleCard
                article={article}
                onAction={doAction}
                onEdit={onEdit}
                onRequestRevision={(id, title) => { setRevisionModal({ id, title }); setRevisionNote(""); }}
                onSchedule={id => { setScheduleModal({ id }); setScheduleDate(""); }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Revision modal */}
      <AdminModal isOpen={!!revisionModal} onClose={() => setRevisionModal(null)} title="Request Revision">
        {revisionModal && (
          <div className="space-y-4">
            <p className="text-sm text-[#737373] truncate">{revisionModal.title}</p>
            <div>
              <label className="text-xs font-medium text-[#525252] block mb-1.5">Revision notes for the author</label>
              <textarea
                value={revisionNote}
                onChange={e => setRevisionNote(e.target.value)}
                placeholder="Describe what needs to be changed..."
                className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all resize-none min-h-[100px]"
                autoFocus
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setRevisionModal(null)}
                className="flex-1 px-4 py-2 rounded-xl border border-[#e5e5e5] text-sm font-medium hover:bg-[#f5f5f5] transition-colors">
                Cancel
              </button>
              <button onClick={confirmRevision} disabled={!revisionNote.trim()}
                className="flex-1 px-4 py-2 rounded-xl bg-[#F59E0B] text-white text-sm font-medium hover:bg-[#D97706] transition-colors flex items-center justify-center gap-2 disabled:opacity-40">
                <RotateCcw className="w-3.5 h-3.5" /> Send Request
              </button>
            </div>
          </div>
        )}
      </AdminModal>

      {/* Schedule modal */}
      <AdminModal isOpen={!!scheduleModal} onClose={() => setScheduleModal(null)} title="Schedule publication">
        {scheduleModal && (
          <div className="space-y-4">
            <p className="text-xs text-[#737373]">Choose a future date and time to auto-publish this article.</p>
            <div>
              <label className="text-xs font-medium text-[#525252] block mb-1.5">Publish at</label>
              <input
                type="datetime-local"
                value={scheduleDate}
                onChange={e => setScheduleDate(e.target.value)}
                min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                className="w-full px-3 py-2 rounded-lg bg-[#fafafa] border border-[#e5e5e5] text-xs outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setScheduleModal(null)}
                className="flex-1 px-4 py-2 rounded-xl border border-[#e5e5e5] text-sm font-medium hover:bg-[#f5f5f5] transition-colors">
                Cancel
              </button>
              <button onClick={confirmSchedule} disabled={!scheduleDate || scheduling}
                className="flex-1 px-4 py-2 rounded-xl bg-[#7C3AED] text-white text-sm font-medium hover:bg-[#6D28D9] transition-colors flex items-center justify-center gap-2 disabled:opacity-40">
                {scheduling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <Calendar className="w-3.5 h-3.5" /> Schedule
              </button>
            </div>
          </div>
        )}
      </AdminModal>
    </div>
  );
}

// ─── Authors Tab ──────────────────────────────────────────────────────────────

function AuthorsTab() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-sm font-medium text-[#0a0a0a] mb-1">Authors are managed in a dedicated page</p>
      <p className="text-xs text-[#a3a3a3] mb-5">View profiles, manage roles, and track article counts for all authors.</p>
      <Link href="/admin/authors"
        className="px-4 py-2 rounded-xl bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors">
        Go to Authors
      </Link>
    </div>
  );
}

// ─── Published Tab ─────────────────────────────────────────────────────────────

interface DBArticle {
  id: number; title: string | null; description?: string | null;
  status: string; date: string; views: string; image: string | null;
  tags: string[]; slug?: string | null; seoDescription?: string | null;
  sectionId?: number | null; sectionName?: string | null; sectionColor?: string | null;
  language?: string | null; articleContent?: { paragraphs: string[] } | null;
}

function PublishedTab({ onEdit }: { onEdit: (a: DBArticle) => void }) {
  const [articles, setArticles] = useState<DBArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previewArticle, setPreviewArticle] = useState<DBArticle | null>(null);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const [statusChanging, setStatusChanging] = useState<number | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);

  const load = () => {
    setLoading(true);
    fetch("/api/posts?status=all")
      .then(r => r.ok ? r.json() : [])
      .then((data: DBArticle[]) => setArticles(Array.isArray(data) ? data.filter((p: DBArticle) => p.title) : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = articles.filter(a => {
    if (filter === 1) return a.status === "published";
    if (filter === 2) return a.status !== "published";
    return true;
  });

  const handleDelete = async (id: number) => {
    setDeleting(true);
    await fetch("/api/posts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: id }),
    }).catch(() => {});
    setArticles(prev => prev.filter(a => a.id !== id));
    setConfirmDelete(null);
    setDeleting(false);
  };

  const handleStatusChange = async (id: number, status: "published" | "draft") => {
    setStatusChanging(id);
    setMenuOpen(null);
    await fetch("/api/posts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: id, status }),
    }).catch(() => {});
    setArticles(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    setStatusChanging(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <AdminPillTabs tabs={["All", "Published", "Draft"]} activeTab={filter} onTabChange={setFilter} />
        <span className="text-xs text-[#a3a3a3]">{filtered.length} articles</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[#e5e5e5] bg-white animate-pulse">
              <div className="flex items-center gap-4 p-3.5">
                <div className="w-16 h-16 rounded-lg bg-[#ebebeb] flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="h-3.5 bg-[#ebebeb] rounded" style={{ width: `${40 + (i % 3) * 20}%` }} />
                  <div className="h-3 bg-[#ebebeb] rounded w-48" />
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="h-5 w-16 bg-[#ebebeb] rounded-full" />
                  <div className="w-7 h-7 bg-[#ebebeb] rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-[#e5e5e5] bg-white px-5 py-16 text-center">
          <p className="text-sm text-[#0a0a0a] font-medium mb-1">No articles yet</p>
          <p className="text-xs text-[#a3a3a3]">Write and publish your first article using the editor.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((article, idx) => (
            <div key={article.id} className="rounded-xl border border-[#e5e5e5] bg-white hover:border-[#d5d5d5] transition-colors">
              <div className="flex items-center gap-4 p-3.5">
                <button type="button" onClick={() => confirmDelete === null ? onEdit(article) : undefined}
                  className="flex items-center gap-4 flex-1 min-w-0 text-left cursor-pointer hover:opacity-80 transition-opacity">
                  {article.image && (
                    <div className="w-24 h-16 rounded-lg overflow-hidden flex-shrink-0 hidden sm:block bg-[#f5f5f5]">
                      <Image src={article.image} alt={article.title ?? ""} width={96} height={64} sizes="96px" quality={80} priority={idx < 5} className="object-cover w-full h-full" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#0a0a0a] truncate mb-1">{article.title}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {article.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-[#f5f5f5] text-[#737373]">{tag}</span>
                      ))}
                    </div>
                  </div>
                </button>

                <div className="hidden sm:flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-xs text-[#737373]">{article.date}</span>
                  {article.status === "published" && article.views !== "0" && (
                    <span className="text-[10px] text-[#a3a3a3]">{article.views} views</span>
                  )}
                </div>

                {article.sectionName && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full hidden sm:block flex-shrink-0"
                    style={{ backgroundColor: (article.sectionColor ?? "#525252") + "20", color: article.sectionColor ?? "#525252" }}>
                    {article.sectionName}
                  </span>
                )}

                <StatusBadge status={article.status} />

                {confirmDelete === article.id ? (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-xs text-[#737373]">Delete?</span>
                    <button onClick={() => handleDelete(article.id)} disabled={deleting}
                      className="px-2.5 py-1 rounded-lg bg-[#F44444] text-white text-xs font-medium hover:bg-[#d64d3c] transition-colors disabled:opacity-50">
                      {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Yes"}
                    </button>
                    <button onClick={() => setConfirmDelete(null)}
                      className="px-2.5 py-1 rounded-lg border border-[#e5e5e5] text-[#525252] text-xs font-medium hover:bg-[#fafafa] transition-colors">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setPreviewArticle(article)} title="Preview"
                      className="p-1.5 rounded-lg text-[#a3a3a3] hover:text-[#525252] hover:bg-[#f5f5f5] transition-colors">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onEdit(article)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#525252] hover:bg-[#f5f5f5] transition-colors">
                      Edit
                    </button>
                    <div className="relative">
                      <button onClick={() => setMenuOpen(menuOpen === article.id ? null : article.id)}
                        className="p-1.5 rounded-lg text-[#a3a3a3] hover:text-[#525252] hover:bg-[#f5f5f5] transition-colors">
                        {statusChanging === article.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <MoreVertical className="w-3.5 h-3.5" />}
                      </button>
                      {menuOpen === article.id && (
                        <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-[#e5e5e5] rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden z-20">
                          {article.status === "published" ? (
                            <button onClick={() => handleStatusChange(article.id, "draft")}
                              className="w-full text-left px-3.5 py-2.5 text-xs text-[#525252] hover:bg-[#fafafa] flex items-center gap-2">
                              <EyeOff className="w-3.5 h-3.5 text-[#a3a3a3]" /> Unpublish
                            </button>
                          ) : (
                            <button onClick={() => handleStatusChange(article.id, "published")}
                              className="w-full text-left px-3.5 py-2.5 text-xs text-[#22c55e] font-medium hover:bg-[#F0FDF4] flex items-center gap-2">
                              <Check className="w-3.5 h-3.5" /> Publish
                            </button>
                          )}
                          <div className="border-t border-[#f5f5f5]" />
                          <button onClick={() => { setMenuOpen(null); setConfirmDelete(article.id); }}
                            className="w-full text-left px-3.5 py-2.5 text-xs text-[#F44444] hover:bg-[#FFF5F5] flex items-center gap-2">
                            <X className="w-3.5 h-3.5" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview slide-over */}
      <AnimatePresence>
        {previewArticle && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[150] bg-black/30 backdrop-blur-sm" onClick={() => setPreviewArticle(null)} />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="fixed right-0 top-0 bottom-0 z-[151] w-full max-w-2xl bg-white shadow-2xl overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-[#f0f0f0] px-6 py-3 flex items-center justify-between z-10">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[#737373]" />
                  <span className="text-sm font-medium text-[#0a0a0a]">Preview</span>
                  <span className="text-xs text-[#a3a3a3]">— how readers see it</span>
                </div>
                <button onClick={() => setPreviewArticle(null)} className="p-1.5 hover:bg-[#f5f5f5] rounded-lg">
                  <X className="w-4 h-4 text-[#737373]" />
                </button>
              </div>
              <article className="px-8 py-8 max-w-[640px] mx-auto">
                {previewArticle.tags.length > 0 && (
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    {previewArticle.tags.map(t => (
                      <span key={t} className="text-[11px] font-medium text-[#F44444] uppercase tracking-wide">{t}</span>
                    ))}
                  </div>
                )}
                <h1 className="text-3xl font-bold text-[#0a0a0a] leading-tight mb-3">{previewArticle.title ?? "Untitled"}</h1>
                {previewArticle.description && (
                  <p className="text-lg text-[#525252] leading-relaxed mb-6">{previewArticle.description}</p>
                )}
                <div className="flex items-center gap-2 mb-6 pb-6 border-b border-[#f0f0f0] text-xs text-[#a3a3a3]">
                  <span>{previewArticle.date}</span>
                  {previewArticle.sectionName && (
                    <><span>·</span><span style={{ color: previewArticle.sectionColor ?? "#525252" }}>{previewArticle.sectionName}</span></>
                  )}
                </div>
                {previewArticle.image && (
                  <div className="rounded-2xl overflow-hidden mb-8 aspect-video relative bg-[#f5f5f5]">
                    <Image src={previewArticle.image} alt={previewArticle.title ?? ""} fill className="object-cover" sizes="640px" quality={85} priority />
                  </div>
                )}
                {previewArticle.articleContent?.paragraphs?.length ? (
                  (() => {
                    const p = previewArticle.articleContent!.paragraphs[0];
                    return p.trim().startsWith("<") ? (
                      <div className="ProseMirror text-[#262626] text-base leading-7" dangerouslySetInnerHTML={{ __html: sanitizeHtml(p) }} />
                    ) : (
                      <div className="space-y-4">
                        {previewArticle.articleContent!.paragraphs.map((para, i) => (
                          <p key={i} className="text-[#262626] text-base leading-[1.8]">{para}</p>
                        ))}
                      </div>
                    );
                  })()
                ) : (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-4 bg-[#f5f5f5] rounded" style={{ width: `${85 - i * 7}%` }} />
                    ))}
                  </div>
                )}
              </article>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Analytics Tab ─────────────────────────────────────────────────────────────

function AnalyticsTab({ stats }: { stats: NewsStats | null }) {
  const fmtDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    } catch { return iso; }
  };

  const trendData = stats?.trend.map(t => ({ date: fmtDate(t.date), count: t.count })) ?? [];
  const hasData = trendData.some(d => d.count > 0);
  const displayTrend = hasData ? trendData : trendData.map(d => ({ ...d, count: 0 }));

  const statCards = stats ? [
    { label: "Total Articles",  value: stats.total,          color: "#0a0a0a" },
    { label: "Published",       value: stats.published,       color: "#22c55e" },
    { label: "Pending Review",  value: stats.pending,         color: "#F59E0B" },
    { label: "Approval Rate",   value: `${stats.approvalRate}%`, color: "#3B82F6" },
    { label: "Drafts",          value: stats.draft,           color: "#737373" },
    { label: "Archived",        value: stats.archived,        color: "#a3a3a3" },
  ] : [];

  const statusBars = stats ? [
    { label: "Draft",              value: stats.draft,               color: "#737373" },
    { label: "Submitted",          value: stats.submitted,           color: "#3B82F6" },
    { label: "Under Review",       value: stats.under_review,        color: "#F59E0B" },
    { label: "Revision Req.",      value: stats.revision_requested,  color: "#F44444" },
    { label: "Approved",           value: stats.approved,            color: "#22c55e" },
    { label: "Published",          value: stats.published,           color: "#16A34A" },
    { label: "Scheduled",          value: stats.scheduled,           color: "#7C3AED" },
    { label: "Rejected",           value: stats.rejected,            color: "#DC2626" },
    { label: "Archived",           value: stats.archived,            color: "#a3a3a3" },
  ] : [];
  const maxBar = Math.max(...statusBars.map(b => b.value), 1);

  return (
    <div className="space-y-6">
      {/* KPI row */}
      {!stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[#e5e5e5] bg-white p-4 animate-pulse">
              <div className="h-3 bg-[#ebebeb] rounded w-20 mb-2" />
              <div className="h-7 bg-[#ebebeb] rounded w-12" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {statCards.map(c => (
            <div key={c.label} className="rounded-xl border border-[#e5e5e5] bg-white p-4">
              <p className="text-[10px] text-[#a3a3a3] font-medium mb-1.5">{c.label}</p>
              <p className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Publishing trend */}
      <div className="rounded-xl border border-[#e5e5e5] bg-white p-5">
        <p className="text-xs font-semibold text-[#0a0a0a] mb-4">Articles published — last 30 days</p>
        {!stats ? (
          <div className="h-40 bg-[#fafafa] rounded-lg animate-pulse" />
        ) : (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={displayTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="newsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F44444" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#F44444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#a3a3a3" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "#a3a3a3" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "#0a0a0a", border: "none", borderRadius: 8, padding: "8px 12px" }}
                  labelStyle={{ color: "#a3a3a3", fontSize: 10 }}
                  itemStyle={{ color: "#fff", fontSize: 12, fontWeight: 600 }}
                  formatter={(v: any) => [v ?? 0, "articles"]}
                />
                <Area type="monotone" dataKey="count" stroke="#F44444" strokeWidth={1.5} fill="url(#newsGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        {stats && !hasData && (
          <p className="text-xs text-center text-[#a3a3a3] mt-2">No articles published in the last 30 days.</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status distribution */}
        <div className="rounded-xl border border-[#e5e5e5] bg-white p-5">
          <p className="text-xs font-semibold text-[#0a0a0a] mb-4">Articles by status</p>
          {!stats ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-3 bg-[#ebebeb] rounded w-20 flex-shrink-0 animate-pulse" />
                  <div className="flex-1 h-3 bg-[#ebebeb] rounded animate-pulse" style={{ width: `${30 + i * 10}%` }} />
                  <div className="h-3 w-6 bg-[#ebebeb] rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {statusBars.filter(b => b.value > 0 || stats.total === 0).map(b => (
                <div key={b.label} className="flex items-center gap-3">
                  <span className="text-[11px] text-[#737373] w-24 flex-shrink-0 text-right">{b.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-[#f5f5f5] overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${(b.value / maxBar) * 100}%`, backgroundColor: b.color }} />
                  </div>
                  <span className="text-[11px] font-semibold text-[#0a0a0a] w-6 text-right flex-shrink-0">{b.value}</span>
                </div>
              ))}
              {stats.total === 0 && (
                <p className="text-xs text-center text-[#a3a3a3] py-4">No articles yet. Start writing!</p>
              )}
            </div>
          )}
        </div>

        {/* Top authors */}
        <div className="rounded-xl border border-[#e5e5e5] bg-white p-5">
          <p className="text-xs font-semibold text-[#0a0a0a] mb-4">Top authors by article count</p>
          {!stats ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-7 h-7 rounded-full bg-[#ebebeb] flex-shrink-0" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 bg-[#ebebeb] rounded w-28" />
                    <div className="h-2.5 bg-[#ebebeb] rounded w-16" />
                  </div>
                  <div className="h-4 w-6 bg-[#ebebeb] rounded" />
                </div>
              ))}
            </div>
          ) : stats.topAuthors.length === 0 ? (
            <p className="text-xs text-center text-[#a3a3a3] py-8">No author data yet.</p>
          ) : (
            <div className="space-y-3">
              {stats.topAuthors.map((author, i) => (
                <div key={author.id} className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-[#a3a3a3] w-4 text-center flex-shrink-0">{i + 1}</span>
                  <UserAvatar src={author.avatar} alt={author.name} size={28} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#0a0a0a] truncate">{author.name}</p>
                    <p className="text-[10px] text-[#a3a3a3]">@{author.handle}</p>
                  </div>
                  <span className="text-xs font-bold text-[#0a0a0a] flex-shrink-0">{author.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── TagInput ──────────────────────────────────────────────────────────────────

const ALL_TAGS = ["News", "Technology", "Business", "AI", "Policy", "Update", "Startups", "Finance", "Space", "Health", "Climate", "India", "Global", "Science", "Culture"];

function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = ALL_TAGS.filter(t =>
    !tags.includes(t) && t.toLowerCase().includes(input.toLowerCase())
  );
  const canCreate = input.trim() && !ALL_TAGS.map(t => t.toLowerCase()).includes(input.trim().toLowerCase()) && !tags.map(t => t.toLowerCase()).includes(input.trim().toLowerCase());

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const add = (tag: string) => {
    const t = tag.trim();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setInput("");
    setOpen(false);
  };

  return (
    <div ref={ref}>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map(t => (
            <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#F44444] text-white">
              {t}
              <button type="button" onClick={() => onChange(tags.filter(x => x !== t))} className="hover:opacity-70 cursor-pointer">
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-[#f5f5f5] border border-[#e5e5e5] focus-within:border-[#F44444] focus-within:ring-1 focus-within:ring-[#F44444]/20 transition-all">
          <Hash className="w-3 h-3 text-[#a3a3a3] flex-shrink-0" />
          <input
            value={input}
            onChange={e => { setInput(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={e => {
              if (e.key === "Enter") { e.preventDefault(); if (filtered[0]) add(filtered[0]); else if (canCreate) add(input); }
              if (e.key === "Escape") setOpen(false);
              if (e.key === "Backspace" && !input && tags.length) onChange(tags.slice(0, -1));
            }}
            placeholder="Search or create tag…"
            className="flex-1 text-xs bg-transparent outline-none text-[#0a0a0a] placeholder:text-[#a3a3a3]"
          />
        </div>
        <AnimatePresence>
          {open && (filtered.length > 0 || canCreate) && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ type: "spring", duration: 0.15, bounce: 0 }}
              className="absolute z-30 top-full mt-1 left-0 right-0 bg-white border border-[#e5e5e5] rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden"
            >
              {filtered.map(t => (
                <button key={t} type="button" onMouseDown={() => add(t)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-[#fafafa] transition-colors cursor-pointer">
                  <span className="text-xs text-[#737373]">{t}</span>
                </button>
              ))}
              {canCreate && (
                <button type="button" onMouseDown={() => add(input)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-[#fafafa] transition-colors cursor-pointer border-t border-[#f5f5f5]">
                  <Plus className="w-3 h-3 text-[#F44444]" />
                  <span className="text-xs text-[#F44444] font-medium">Create &ldquo;{input.trim()}&rdquo;</span>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function AdminNews() {
  const [activeTab, setActiveTab] = useState(0);
  const [view, setView] = useState<"list" | "editor">("list");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [kpiStats, setKpiStats] = useState<NewsStats | null>(null);

  // Editor state
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [coverImage, setCoverImage] = useState("");
  const [coverUploading, setCoverUploading] = useState(false);
  const [seoDescription, setSeoDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [language, setLanguage] = useState("en");
  const [sections, setSections] = useState<{ id: number; name: string; color: string; active: boolean }[]>([]);
  const [assignedAuthor, setAssignedAuthor] = useState("");
  const [autoSaveState, setAutoSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [publishing, setPublishing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [publishError, setPublishError] = useState("");

  const tabs = ["Editorial Queue", "Authors", "Published", "Analytics", "Write Article"];

  useEffect(() => {
    fetch("/api/admin/sections")
      .then(r => r.ok ? r.json() : { sections: [] })
      .then(d => setSections((d.sections ?? []).filter((s: { active: boolean }) => s.active)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/admin/news/stats")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setKpiStats(d); })
      .catch(() => {});
  }, []);

  const resetEditor = () => {
    setTitle(""); setSubtitle(""); setContent(""); setTags([]); setCoverImage(""); setLanguage("en");
    setSeoDescription(""); setSlug(""); setScheduledDate(""); setAssignedAuthor(""); setEditingId(null); setSectionId(null);
  };

  const autoSlug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const plainText = content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const wordCount = plainText ? plainText.split(/\s+/).length : 0;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("userId", "13");
      form.append("category", "cover");
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (res.ok) {
        const data = await res.json();
        setCoverImage(data.url);
      }
    } catch {}
    setCoverUploading(false);
    if (coverInputRef.current) coverInputRef.current.value = "";
  };

  const buildPayload = (status: string) => {
    const html = content || "<p></p>";
    const plain = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    return {
      title: title.trim(),
      description: subtitle.trim() || plain.substring(0, 200) || "",
      content: subtitle.trim() || plain.substring(0, 200) || "",
      image: coverImage || null,
      tags: tags.length > 0 ? tags : [],
      articleParagraphs: [html],
      seoDescription: seoDescription.trim() || null,
      sectionId: sectionId ?? null,
      language: language || "en",
      status,
    };
  };

  const saveArticle = async (status: string): Promise<number | null> => {
    const html = content || "<p></p>";
    if (editingId) {
      const res = await fetch("/api/posts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: editingId, ...buildPayload(status), articleParagraphs: [html] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      return editingId;
    } else {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: 13, type: "article", slug: slug.trim() || null, ...buildPayload(status) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      return data.id ?? null;
    }
  };

  const handlePublish = async () => {
    if (!title.trim()) { setPublishError("A title is required"); return; }
    setPublishing(true); setPublishError("");
    try {
      await saveArticle("published");
      resetEditor(); setView("list"); setActiveTab(2);
    } catch (err: unknown) {
      setPublishError(err instanceof Error ? err.message : "Connection error");
    } finally { setPublishing(false); }
  };

  const handleSaveDraft = async () => {
    if (!title.trim()) { setPublishError("A title is required to save"); return; }
    setSavingDraft(true); setPublishError("");
    try {
      const id = await saveArticle("draft");
      if (id && !editingId) setEditingId(id);
      resetEditor(); setView("list"); setActiveTab(2);
    } catch (err: unknown) {
      setPublishError(err instanceof Error ? err.message : "Connection error");
    } finally { setSavingDraft(false); }
  };

  const handleSubmitForReview = async () => {
    if (!title.trim()) { setPublishError("A title is required"); return; }
    setSubmitting(true); setPublishError("");
    try {
      await saveArticle("submitted");
      resetEditor(); setView("list"); setActiveTab(0);
    } catch (err: unknown) {
      setPublishError(err instanceof Error ? err.message : "Connection error");
    } finally { setSubmitting(false); }
  };

  // Auto-save every 3s of inactivity
  useEffect(() => {
    if (view !== "editor" || !title.trim()) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      setAutoSaveState("saving");
      try {
        const html = content || "<p></p>";
        const plain = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        const common = {
          title: title.trim(),
          description: subtitle.trim() || plain.substring(0, 200) || "",
          content: subtitle.trim() || plain.substring(0, 200) || "",
          image: coverImage || null,
          tags: tags.length > 0 ? tags : [],
          articleParagraphs: [html],
          seoDescription: seoDescription.trim() || null,
          sectionId: sectionId ?? null,
          language: language || "en",
        };
        if (editingId) {
          await fetch("/api/posts", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ postId: editingId, ...common }),
          });
        } else {
          const res = await fetch("/api/posts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: 13, type: "article", slug: slug.trim() || null, ...common, status: "draft" }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.id) setEditingId(data.id);
          }
        }
        setAutoSaveState("saved");
        setTimeout(() => setAutoSaveState("idle"), 2000);
      } catch {
        setAutoSaveState("idle");
      }
    }, 3000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [content, title, subtitle, coverImage, tags, sectionId, language, view]);

  const openEditor = (article?: DBArticle) => {
    if (article) {
      setTitle(article.title ?? "");
      setSubtitle(article.description ?? "");
      setCoverImage(article.image ?? "");
      setTags(article.tags ?? []);
      setSlug(article.slug ?? (article.title ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
      setSeoDescription(article.seoDescription ?? "");
      setSectionId(article.sectionId ?? null);
      setLanguage(article.language ?? "en");
      setContent(article.articleContent?.paragraphs?.[0] ?? "");
      setEditingId(article.id);
    } else {
      resetEditor();
    }
    setView("editor");
  };

  // ─── EDITOR VIEW ─────────────────────────────────────────────────────────────
  if (view === "editor") {
    return (
      <>
        <div className="min-h-screen bg-white">
          <div className="sticky top-0 z-20 bg-white border-b border-[#e5e5e5] px-6 py-3">
            <div className="flex items-center justify-between max-w-[1200px]">
              <div className="flex items-center gap-3">
                <button onClick={() => { resetEditor(); setView("list"); }} className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors">
                  <ArrowLeft className="w-5 h-5 text-[#525252]" />
                </button>
                <span className="text-sm font-medium text-[#0a0a0a]">Write Article</span>
                {title && <span className="text-xs text-[#a3a3a3] hidden sm:block">— {title.substring(0, 40)}{title.length > 40 ? "..." : ""}</span>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowPreview(true)} className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#737373] hover:text-[#0a0a0a]" title="Preview">
                  <Eye className="w-4 h-4" />
                </button>
                <button onClick={handleSaveDraft} disabled={savingDraft} className="px-4 py-2 rounded-full border border-[#e5e5e5] text-[#525252] text-sm font-medium hover:bg-[#fafafa] transition-colors disabled:opacity-50 flex items-center gap-2">
                  {savingDraft && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Draft
                </button>
                <button onClick={handleSubmitForReview} disabled={submitting} className="px-4 py-2 rounded-full bg-[#3B82F6] text-white text-sm font-medium hover:bg-[#2563EB] transition-colors disabled:opacity-50 flex items-center gap-2">
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Submit for Review
                </button>
                <button onClick={handlePublish} disabled={publishing} className="px-4 py-2 rounded-full bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors disabled:opacity-50 flex items-center gap-2">
                  {publishing && <Loader2 className="w-4 h-4 animate-spin" />}
                  Publish
                </button>
              </div>
            </div>
          </div>

          <div className="flex max-w-[1200px] mx-auto">
            <div className="flex-1 min-w-0 px-6 lg:px-12 py-8">
              <div className="mb-6">
                {coverImage ? (
                  <div className="relative rounded-xl overflow-hidden h-48 sm:h-64">
                    <Image src={coverImage} alt="Cover" width={800} height={400} sizes="(max-width: 1200px) 100vw, 800px" quality={85} priority className="object-cover w-full h-full" />
                    <button onClick={() => setCoverImage("")} className="absolute top-3 right-3 px-3 py-1.5 bg-white/90 backdrop-blur-sm text-[#0a0a0a] text-xs font-medium rounded-lg hover:bg-white transition-colors">Remove</button>
                  </div>
                ) : (
                  <div>
                    <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
                    <button onClick={() => coverInputRef.current?.click()} disabled={coverUploading} className="w-full h-36 rounded-xl border-2 border-dashed border-[#e5e5e5] hover:border-[#d5d5d5] transition-colors flex flex-col items-center justify-center gap-2 text-[#737373] cursor-pointer disabled:opacity-50">
                      {coverUploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <ImagePlus className="w-6 h-6" />}
                      <span className="text-sm">{coverUploading ? "Uploading..." : "Add cover image"}</span>
                    </button>
                  </div>
                )}
              </div>

              <input type="text" value={title} onChange={e => { setTitle(e.target.value); if (!editingId) setSlug(autoSlug(e.target.value)); }} placeholder="Article title" className="w-full text-3xl font-bold text-[#0a0a0a] placeholder-[#d5d5d5] outline-none mb-3" autoFocus />
              <input type="text" value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="Add a subtitle..." className="w-full text-lg text-[#525252] placeholder-[#d5d5d5] outline-none mb-6" />

              <RichEditor value={content} onChange={v => { setContent(v); }} userId={13} />

              <div className="flex items-center gap-4 py-3 border-t border-[#e5e5e5] mt-4 text-xs text-[#a3a3a3]">
                <span>{wordCount} words</span>
                <span>{readTime} min read</span>
                {autoSaveState === "saving" && <span className="ml-auto text-[#a3a3a3]">Saving…</span>}
                {autoSaveState === "saved" && <span className="ml-auto text-[#22c55e]">Saved</span>}
                {publishError && <span className="text-[#F44444] ml-auto">{publishError}</span>}
              </div>
            </div>

            <div className="hidden lg:block w-64 border-l border-[#f0f0f0] flex-shrink-0">
              <div className="p-4 space-y-5 sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto">
                <div>
                  <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-2">Language</p>
                  <Dropdown value={language} onChange={setLanguage} options={[
                    { value: "en", label: "English" }, { value: "hi", label: "Hindi" },
                    { value: "ta", label: "Tamil" },   { value: "te", label: "Telugu" },
                    { value: "bn", label: "Bengali" }, { value: "mr", label: "Marathi" },
                    { value: "ar", label: "Arabic" },  { value: "fr", label: "French" },
                    { value: "de", label: "German" },  { value: "es", label: "Spanish" },
                  ]} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-2">Section</p>
                  <Dropdown value={sectionId ? String(sectionId) : ""}
                    onChange={v => setSectionId(v ? Number(v) : null)}
                    placeholder={sections.length ? "No section" : "Add in Settings →"}
                    options={[
                      { value: "", label: "None" },
                      ...sections.map(s => ({ value: String(s.id), label: s.name, badge: { label: s.name, color: s.color, bg: s.color + "20" } })),
                    ]} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-2">Author</p>
                  <Dropdown value={assignedAuthor} onChange={setAssignedAuthor} placeholder="Admin (self)"
                    options={[{ value: "", label: "Admin (self)" }]} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-2">Schedule</p>
                  <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#fafafa] border border-[#e5e5e5] text-xs text-[#0a0a0a] outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all cursor-pointer" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-2">Tags</p>
                  <TagInput tags={tags} onChange={setTags} />
                </div>
                <div className="border-t border-[#f0f0f0]" />
                <div className="space-y-3">
                  <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider">SEO</p>
                  <div>
                    <label className="text-[10px] font-medium text-[#737373] block mb-1.5">URL Slug</label>
                    <input type="text" value={slug} onChange={e => setSlug(e.target.value)} placeholder="article-url-slug"
                      className="w-full px-3 py-2 rounded-lg bg-[#fafafa] border border-[#e5e5e5] text-xs outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all" />
                    {slug && <p className="text-[10px] text-[#a3a3a3] mt-1 truncate">/{slug}</p>}
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-[#737373] block mb-1.5">Meta description</label>
                    <textarea value={seoDescription} onChange={e => setSeoDescription(e.target.value)}
                      placeholder="For search engines..." rows={3}
                      className="w-full px-3 py-2 rounded-lg bg-[#fafafa] border border-[#e5e5e5] text-xs outline-none resize-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all" />
                    <span className={`text-[10px] mt-0.5 block ${seoDescription.length > 140 ? "text-[#F44444]" : "text-[#a3a3a3]"}`}>
                      {seoDescription.length}/160
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Preview slide-over */}
        <AnimatePresence>
          {showPreview && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                className="fixed inset-0 z-[150] bg-black/40 backdrop-blur-sm" onClick={() => setShowPreview(false)} />
              <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
                transition={{ type: "spring", stiffness: 320, damping: 32 }}
                className="fixed right-0 top-0 bottom-0 z-[151] w-full max-w-2xl bg-white shadow-2xl overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-[#f0f0f0] px-6 py-3 flex items-center justify-between z-10">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-[#737373]" />
                    <span className="text-sm font-medium text-[#0a0a0a]">Preview</span>
                  </div>
                  <button onClick={() => setShowPreview(false)} className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors">
                    <X className="w-4 h-4 text-[#737373]" />
                  </button>
                </div>
                <div className="px-8 py-8 max-w-[680px] mx-auto">
                  {tags.length > 0 && (
                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                      {tags.map(t => <span key={t} className="text-[11px] font-medium text-[#F44444] uppercase tracking-wide">{t}</span>)}
                    </div>
                  )}
                  {title ? (
                    <h1 className="text-3xl font-bold text-[#0a0a0a] leading-tight mb-3">{title}</h1>
                  ) : (
                    <div className="h-9 bg-[#f5f5f5] rounded mb-3 w-3/4" />
                  )}
                  {subtitle && <p className="text-lg text-[#525252] leading-relaxed mb-6">{subtitle}</p>}
                  <div className="flex items-center gap-2 mb-6 pb-6 border-b border-[#f0f0f0]">
                    <div className="w-8 h-8 rounded-full bg-[#F44444]/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-[#F44444]">A</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#0a0a0a]">{assignedAuthor || "Admin"}</p>
                      <p className="text-xs text-[#a3a3a3]">Draft</p>
                    </div>
                  </div>
                  {coverImage && (
                    <div className="rounded-2xl overflow-hidden mb-8 aspect-video relative bg-[#f5f5f5]">
                      <Image src={coverImage} alt={title || "Cover"} fill className="object-cover" sizes="680px" quality={85} />
                    </div>
                  )}
                  {content && content !== "<p></p>" ? (
                    <div className="ProseMirror text-[#262626] text-base leading-7" dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }} />
                  ) : (
                    <div className="space-y-2">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-4 bg-[#f5f5f5] rounded" style={{ width: `${85 - i * 7}%` }} />
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </>
    );
  }

  // ─── LIST VIEW ───────────────────────────────────────────────────────────────
  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-[#0a0a0a]">News & Editorial</h1>
        <button onClick={() => openEditor()}
          className="px-4 py-2 rounded-full bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Write Article
        </button>
      </div>

      <KpiCards stats={kpiStats} />

      <div className="mb-6">
        <AdminPillTabs tabs={tabs} activeTab={activeTab} onTabChange={i => {
          if (i === 4) { openEditor(); return; }
          setActiveTab(i);
        }} />
      </div>

      {activeTab === 0 && <EditorialQueueTab onEdit={article => openEditor(article as unknown as DBArticle)} />}
      {activeTab === 1 && <AuthorsTab />}
      {activeTab === 2 && <PublishedTab onEdit={openEditor} />}
      {activeTab === 3 && <AnalyticsTab stats={kpiStats} />}
    </div>
  );
}