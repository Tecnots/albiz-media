"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, X, ExternalLink, Trash2, Loader2,
  ChevronRight, Calendar, FileText, Plus, UserPlus,
} from "lucide-react";
import { Dropdown, ConfirmModal } from "../admin-components";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

interface Section {
  id: number;
  name: string;
  slug: string;
  color: string;
  active?: boolean;
}

interface SectionAssignment {
  id: number;
  sectionId: number;
  canPublish: boolean;
  section: Section;
}

interface Editor {
  id: number;
  name: string;
  handle: string;
  email: string;
  avatar: string;
  title: string;
  bio: string;
  location: string;
  website: string;
  verified: boolean;
  banned: boolean;
  banReason: string | null;
  joinedDate: string | null;
  followers: number;
  assignments: SectionAssignment[];
  assignedPostCount: number;
  noteCount: number;
  activityCount: number;
}

interface EditorPost {
  id: number;
  title: string;
  status: string;
  createdAt: string;
  section: { name: string; color: string } | null;
}

interface ActivityItem {
  id: number;
  action: string;
  createdAt: string;
  post: { id: number; title: string };
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(dateStr) ?? "";
}

function formatAction(action: string) {
  const labels: Record<string, string> = {
    reviewed: "Reviewed article",
    note_added: "Added a note",
    published: "Published article",
    approved: "Approved article",
    rejected: "Rejected article",
    flagged: "Flagged article",
    assigned: "Was assigned article",
  };
  return labels[action] ?? action.replace(/_/g, " ");
}

// ─── Editor analytics tab ────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  approved:           "Approved",
  revision_requested: "Revision",
  published:          "Published",
  rejected:           "Rejected",
  reviewed:           "Reviewed",
  note_added:         "Note added",
  assigned:           "Assigned",
  flagged:            "Flagged",
};

const ACTION_COLORS: Record<string, string> = {
  approved:           "#22c55e",
  revision_requested: "#F59E0B",
  published:          "#3B82F6",
  rejected:           "#F44444",
  reviewed:           "#8B5CF6",
  note_added:         "#a3a3a3",
  assigned:           "#525252",
  flagged:            "#D97706",
};

function fmtWait(hours: number) {
  if (hours < 1)  return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

function timeAgoAnalytics(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

type RangeEntry = { label: string; days: number | null };
const RANGES: RangeEntry[] = [
  { label: "1D",  days: 1    },
  { label: "7D",  days: 7    },
  { label: "30D", days: 30   },
  { label: "90D", days: 90   },
  { label: "1Y",  days: 365  },
  { label: "All", days: null },
];

function EditorAnalyticsTab() {
  const [days, setDays]     = useState<number | null>(30);
  const [data, setData]     = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setData(null);
    fetch(`/api/admin/editor/analytics?days=${days ?? "all"}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (alive && d) setData(d); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [days]);

  const kpis = data?.kpis ?? {};

  return (
    <div className="space-y-5">
      {/* Range selector */}
      <div className="flex items-center gap-1">
        {RANGES.map(r => (
          <button
            key={r.label}
            onClick={() => setDays(r.days)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              days === r.days ? "bg-[#0a0a0a] text-white" : "text-[#737373] hover:text-[#0a0a0a]"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-[#e5e5e5] bg-white p-4 animate-pulse">
                <div className="h-3 bg-[#ebebeb] rounded w-20 mb-3" />
                <div className="h-7 bg-[#ebebeb] rounded w-14" />
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-[#e5e5e5] bg-white h-52 animate-pulse" />
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Pending review",  value: kpis.pendingReview ?? 0,  color: (kpis.pendingReview ?? 0) > 10 ? "#D97706" : "#0a0a0a" },
              { label: "In review",       value: kpis.inReview ?? 0,        color: "#0a0a0a" },
              { label: "Approved",        value: kpis.approved ?? 0,        color: "#22c55e" },
              { label: "Revisions sent",  value: kpis.revisions ?? 0,       color: "#F59E0B" },
              { label: "Published",       value: kpis.published ?? 0,       color: "#3B82F6" },
              { label: "Approval rate",   value: `${kpis.approvalRate ?? 0}%`, color: "#22c55e" },
              { label: "SLA breaches",    value: kpis.slaBreaches ?? 0,     color: (kpis.slaBreaches ?? 0) > 0 ? "#F44444" : "#0a0a0a" },
              { label: "Notes written",   value: kpis.noteCount ?? 0,       color: "#0a0a0a" },
            ].map(card => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 35 }}
                className="rounded-xl border border-[#e5e5e5] bg-white p-4"
              >
                <p className="text-xs text-[#a3a3a3] mb-1.5">{card.label}</p>
                <p className="text-2xl font-semibold tabular-nums" style={{ color: card.color }}>
                  {card.value}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Daily activity + action breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4">
            <div className="rounded-xl border border-[#e5e5e5] bg-white">
              <div className="px-5 pt-5 pb-3">
                <p className="text-sm font-semibold text-[#0a0a0a]">Review activity</p>
                <p className="text-xs text-[#a3a3a3] mt-0.5">Approvals, revisions and publications per day</p>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data?.dailyActivity ?? []} margin={{ top: 4, right: 20, bottom: 0, left: 4 }}>
                  <defs>
                    <linearGradient id="eaApproved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}    />
                    </linearGradient>
                    <linearGradient id="eaRevision" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#F59E0B" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}    />
                    </linearGradient>
                    <linearGradient id="eaPublished" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    axisLine={false} tickLine={false}
                    tick={{ fontSize: 10, fill: "#a3a3a3" }}
                    interval="preserveStartEnd" dy={8}
                  />
                  <YAxis
                    axisLine={false} tickLine={false}
                    tick={{ fontSize: 10, fill: "#a3a3a3" }}
                    width={28} allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: "1px solid #e5e5e5", fontSize: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}
                    labelStyle={{ color: "#0a0a0a", fontWeight: 600 }}
                    cursor={false}
                  />
                  <Area type="monotone" dataKey="approved"  name="Approved"  stroke="#22c55e" strokeWidth={2} fill="url(#eaApproved)"  dot={false} activeDot={{ r: 4, fill: "#22c55e", stroke: "white", strokeWidth: 2 }} />
                  <Area type="monotone" dataKey="revisions" name="Revisions" stroke="#F59E0B" strokeWidth={2} fill="url(#eaRevision)"  dot={false} activeDot={{ r: 4, fill: "#F59E0B", stroke: "white", strokeWidth: 2 }} />
                  <Area type="monotone" dataKey="published" name="Published" stroke="#3B82F6" strokeWidth={1.5} fill="url(#eaPublished)" dot={false} activeDot={{ r: 4, fill: "#3B82F6", stroke: "white", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Action breakdown bars */}
            <div className="rounded-xl border border-[#e5e5e5] bg-white p-5">
              <p className="text-sm font-semibold text-[#0a0a0a] mb-4">Action breakdown</p>
              {(data?.actionBreakdown ?? []).filter((ab: any) => ab.action !== "note_added").length === 0 ? (
                <p className="text-xs text-[#a3a3a3] text-center py-6">No activity in this period</p>
              ) : (
                <div className="space-y-3.5">
                  {(data?.actionBreakdown ?? [])
                    .filter((ab: any) => ab.action !== "note_added")
                    .map((ab: any) => (
                      <div key={ab.action}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-[#525252]">{ACTION_LABELS[ab.action] ?? ab.action}</span>
                          <span className="text-xs font-semibold text-[#0a0a0a] tabular-nums">{ab.count}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#f5f5f5] overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: ACTION_COLORS[ab.action] ?? "#a3a3a3" }}
                            initial={{ width: 0 }}
                            animate={{ width: `${ab.pct}%` }}
                            transition={{ type: "spring", stiffness: 380, damping: 35, delay: 0.06 }}
                          />
                        </div>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          </div>

          {/* Editor leaderboard + recent activity */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
            <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#f5f5f5]">
                <p className="text-sm font-semibold text-[#0a0a0a]">Editor output</p>
              </div>
              {(data?.editorLeaderboard ?? []).length === 0 ? (
                <p className="text-xs text-[#a3a3a3] text-center py-10">No editor activity in this period</p>
              ) : (
                <>
                  <div className="grid grid-cols-[1fr_56px_56px_56px_56px] px-5 py-2 border-b border-[#f5f5f5]">
                    <span className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider">Editor</span>
                    <span className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider text-right">Appr</span>
                    <span className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider text-right hidden sm:block">Rev</span>
                    <span className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider text-right hidden sm:block">Pub</span>
                    <span className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider text-right">Total</span>
                  </div>
                  {(data?.editorLeaderboard ?? []).map((e: any, i: number) => (
                    <div
                      key={e.editorId}
                      className={`grid grid-cols-[1fr_56px_56px_56px_56px] items-center px-5 py-3 ${
                        i < (data.editorLeaderboard.length - 1) ? "border-b border-[#f5f5f5]" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {e.avatar ? (
                          <img src={e.avatar} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-[#f0f0f0] flex items-center justify-center flex-shrink-0">
                            <span className="text-[11px] font-semibold text-[#525252]">{e.name.charAt(0)}</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[#0a0a0a] truncate">{e.name}</p>
                          <p className="text-[10px] text-[#a3a3a3]">@{e.handle}</p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-[#22c55e] tabular-nums text-right">{e.approved}</span>
                      <span className="text-xs font-semibold text-[#F59E0B] tabular-nums text-right hidden sm:block">{e.revisions}</span>
                      <span className="text-xs font-semibold text-[#3B82F6] tabular-nums text-right hidden sm:block">{e.published}</span>
                      <span className="text-xs font-semibold text-[#0a0a0a] tabular-nums text-right">{e.total}</span>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Recent activity feed */}
            <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#f5f5f5]">
                <p className="text-sm font-semibold text-[#0a0a0a]">Recent activity</p>
              </div>
              {(data?.recentActivity ?? []).length === 0 ? (
                <p className="text-xs text-[#a3a3a3] text-center py-10">No recent activity</p>
              ) : (
                <div className="divide-y divide-[#f5f5f5]">
                  {(data?.recentActivity ?? []).map((item: any) => (
                    <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                        style={{ backgroundColor: ACTION_COLORS[item.action] ?? "#a3a3a3" }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-[#0a0a0a] truncate">
                          <span className="font-medium">{item.editorName}</span>
                          {" "}
                          <span style={{ color: ACTION_COLORS[item.action] ?? "#a3a3a3" }}>
                            {ACTION_LABELS[item.action] ?? item.action}
                          </span>
                        </p>
                        <p className="text-[10px] text-[#a3a3a3] truncate mt-0.5">{item.postTitle}</p>
                      </div>
                      <span className="text-[10px] text-[#a3a3a3] flex-shrink-0 tabular-nums">
                        {timeAgoAnalytics(item.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Oldest pending articles */}
          {(data?.oldestPending ?? []).length > 0 && (
            <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#f5f5f5] flex items-center justify-between">
                <p className="text-sm font-semibold text-[#0a0a0a]">Oldest pending</p>
                <span className="text-xs text-[#a3a3a3]">{data.oldestPending.length} waiting</span>
              </div>
              <div>
                {data.oldestPending.map((item: any, i: number) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-4 px-5 py-3 ${
                      i < data.oldestPending.length - 1 ? "border-b border-[#f5f5f5]" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[#0a0a0a] truncate">{item.title}</p>
                      <p className="text-[10px] text-[#a3a3a3] mt-0.5">
                        by {item.authorName}{item.sectionName ? ` · ${item.sectionName}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={
                          item.status === "submitted"
                            ? { backgroundColor: "#FFF9EC", color: "#D97706" }
                            : { backgroundColor: "#EFF6FF", color: "#3B82F6" }
                        }
                      >
                        {item.status === "submitted" ? "Submitted" : "In review"}
                      </span>
                      <span
                        className="text-xs tabular-nums font-medium"
                        style={{ color: item.hoursWaiting > 48 ? "#F44444" : "#a3a3a3" }}
                      >
                        {fmtWait(item.hoursWaiting)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main editors page ────────────────────────────────────────────────────────

export default function AdminEditorsPage() {
  const [editors, setEditors] = useState<Editor[]>([]);
  const [allSections, setAllSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [mainTab, setMainTab] = useState<"editors" | "coverage" | "sections" | "analytics">("editors");

  // Section CRUD state
  const [newSectionName, setNewSectionName] = useState("");
  const [newSectionColor, setNewSectionColor] = useState("#525252");
  const [addingSection, setAddingSection] = useState(false);
  const [editingSection, setEditingSection] = useState<{ id: number; name: string; color: string } | null>(null);
  const [deactivateConfirmId, setDeactivateConfirmId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Editor | null>(null);
  const [detailTab, setDetailTab] = useState<"details" | "posts" | "activity">("details");

  const [editorPosts, setEditorPosts] = useState<EditorPost[]>([]);
  const [editorActivity, setEditorActivity] = useState<ActivityItem[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailLoadedFor, setDetailLoadedFor] = useState<number | null>(null);

  const [showAddSection, setShowAddSection] = useState(false);
  const [addingSectionId, setAddingSectionId] = useState<number | null>(null);
  const [addCanPublish, setAddCanPublish] = useState(false);
  const [addingSectionLoading, setAddingSectionLoading] = useState(false);

  const [changing, setChanging] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteNote, setInviteNote] = useState("");
  const [inviteSectionIds, setInviteSectionIds] = useState<number[]>([]);
  const [inviteCanPublish, setInviteCanPublish] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/editors").then(r => r.ok ? r.json() : { editors: [] }).catch(() => ({ editors: [] })),
      fetch("/api/admin/sections").then(r => r.ok ? r.json() : { sections: [] }).catch(() => ({ sections: [] })),
    ]).then(([editorsRes, sectionsRes]) => {
      setEditors(editorsRes.editors ?? []);
      setAllSections(sectionsRes.sections ?? []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const loadEditorDetail = async (editorId: number) => {
    if (detailLoadedFor === editorId) return;
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/editors?editorId=${editorId}`);
      if (res.ok) {
        const data = await res.json();
        setEditorPosts(data.posts ?? []);
        setEditorActivity(data.activity ?? []);
        setDetailLoadedFor(editorId);
      }
    } finally { setLoadingDetail(false); }
  };

  const selectEditor = (editor: Editor) => {
    if (selected?.id !== editor.id) {
      setEditorPosts([]);
      setEditorActivity([]);
      setDetailLoadedFor(null);
    }
    setSelected(editor);
    setDetailTab("details");
    setShowAddSection(false);
    setAddingSectionId(null);
    setAddCanPublish(false);
  };

  const handleDetailTab = (tab: "details" | "posts" | "activity") => {
    setDetailTab(tab);
    if (tab !== "details" && selected) loadEditorDetail(selected.id);
  };

  const syncSelected = (id: number, updater: (e: Editor) => Editor) => {
    setEditors(prev => prev.map(e => e.id === id ? updater(e) : e));
    setSelected(prev => prev?.id === id ? updater(prev) : prev);
  };

  const handleCreateSection = async () => {
    const name = newSectionName.trim();
    if (!name || addingSection) return;
    setAddingSection(true);
    try {
      const res = await fetch("/api/admin/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color: newSectionColor }),
      });
      if (res.ok) {
        const data = await res.json();
        setAllSections(prev => [...prev, data.section].sort((a, b) => a.name.localeCompare(b.name)));
        setNewSectionName("");
        setNewSectionColor("#525252");
      }
    } finally { setAddingSection(false); }
  };

  const handleUpdateSection = async () => {
    if (!editingSection || addingSection) return;
    setAddingSection(true);
    try {
      const res = await fetch("/api/admin/sections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingSection.id, name: editingSection.name, color: editingSection.color }),
      });
      if (res.ok) {
        const data = await res.json();
        setAllSections(prev => prev.map(s => s.id === data.section.id ? data.section : s));
        setEditingSection(null);
      }
    } finally { setAddingSection(false); }
  };

  const handleDeactivateSection = async (id: number) => {
    const res = await fetch("/api/admin/sections", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setAllSections(prev => prev.map(s => s.id === id ? { ...s, active: false } : s));
    }
  };

  const handleReactivateSection = async (id: number) => {
    const res = await fetch("/api/admin/sections", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active: true }),
    });
    if (res.ok) {
      setAllSections(prev => prev.map(s => s.id === id ? { ...s, active: true } : s));
    }
  };

  const handleBanToggle = async (id: number, banned: boolean) => {
    await fetch("/api/admin/editors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, banned }),
    });
    syncSelected(id, e => ({ ...e, banned }));
  };

  const handleRoleChange = async (id: number, role: string) => {
    setChanging(true);
    try {
      await fetch("/api/admin/editors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, role }),
      });
      if (role !== "EDITOR") {
        setEditors(prev => prev.filter(e => e.id !== id));
        setSelected(null);
      }
    } finally { setChanging(false); }
  };

  const handleRemoveSection = async (editorId: number, sectionId: number) => {
    await fetch("/api/admin/editors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editorId, removeSection: sectionId }),
    });
    syncSelected(editorId, e => ({
      ...e,
      assignments: e.assignments.filter(a => a.sectionId !== sectionId),
    }));
  };

  const handleToggleCanPublish = async (editorId: number, sectionId: number, canPublish: boolean) => {
    await fetch("/api/admin/editors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editorId, updateSection: { sectionId, canPublish } }),
    });
    syncSelected(editorId, e => ({
      ...e,
      assignments: e.assignments.map(a => a.sectionId === sectionId ? { ...a, canPublish } : a),
    }));
  };

  const handleAddSection = async (editorId: number) => {
    if (!addingSectionId) return;
    setAddingSectionLoading(true);
    try {
      const res = await fetch("/api/admin/editors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editorId, addSection: { sectionId: addingSectionId, canPublish: addCanPublish } }),
      });
      if (res.ok) {
        const section = allSections.find(s => s.id === addingSectionId);
        if (section) {
          syncSelected(editorId, e => ({
            ...e,
            assignments: [...e.assignments, { id: Date.now(), sectionId: section.id, canPublish: addCanPublish, section }],
          }));
        }
        setAddingSectionId(null);
        setAddCanPublish(false);
        setShowAddSection(false);
      }
    } finally { setAddingSectionLoading(false); }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/editors?id=${deleteConfirm}`, { method: "DELETE" });
      if (res.ok) {
        setEditors(prev => prev.filter(e => e.id !== deleteConfirm));
        if (selected?.id === deleteConfirm) setSelected(null);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete editor");
      }
    } finally { setDeleting(false); setDeleteConfirm(null); }
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    if (inviteSectionIds.length === 0) {
      setInviteError("Select at least one section for the editor");
      return;
    }
    setSendingInvite(true);
    setInviteError(null);
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: "EDITOR",
          name: inviteName.trim() || null,
          note: inviteNote.trim() || null,
          sectionIds: inviteSectionIds,
          canPublish: inviteCanPublish,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.error || "Failed to send invite");
      } else {
        setInviteSent(true);
        setTimeout(() => {
          setShowInvite(false);
          setInviteEmail(""); setInviteName(""); setInviteNote("");
          setInviteSectionIds([]); setInviteCanPublish(false); setInviteSent(false);
        }, 1800);
      }
    } finally { setSendingInvite(false); }
  };

  const totalAssigned = editors.reduce((sum, e) => sum + e.assignedPostCount, 0);
  const uncoveredSections = allSections.filter(s =>
    !editors.some(e => e.assignments.some(a => a.sectionId === s.id))
  );

  const searchQ = search.toLowerCase().trim();
  const filtered = editors.filter(e =>
    !searchQ ||
    e.name.toLowerCase().includes(searchQ) ||
    e.handle.toLowerCase().includes(searchQ) ||
    e.email.toLowerCase().includes(searchQ)
  );

  const coverageData = [...allSections]
    .sort((a, b) => {
      const aHas = editors.some(e => e.assignments.some(ass => ass.sectionId === a.id));
      const bHas = editors.some(e => e.assignments.some(ass => ass.sectionId === b.id));
      if (!aHas && bHas) return -1;
      if (aHas && !bHas) return 1;
      return a.name.localeCompare(b.name);
    })
    .map(section => ({
      section,
      sectionEditors: editors.filter(e => e.assignments.some(a => a.sectionId === section.id)),
    }));

  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">
      {/* Stats bar */}
      {!loading && (
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#e5e5e5]">
            <span className="text-sm font-semibold text-[#0a0a0a]">{editors.length}</span>
            <span className="text-xs text-[#a3a3a3]">editors</span>
          </div>
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#e5e5e5]">
            <span className="text-sm font-semibold text-[#0a0a0a]">{totalAssigned}</span>
            <span className="text-xs text-[#a3a3a3]">assigned</span>
          </div>
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#e5e5e5]">
            <span className={`text-sm font-semibold ${uncoveredSections.length > 0 ? "text-[#D97706]" : "text-[#0a0a0a]"}`}>
              {uncoveredSections.length}
            </span>
            <span className="text-xs text-[#a3a3a3]">uncovered</span>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center gap-3 mb-4">
        {mainTab === "editors" && (
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#a3a3a3]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search editors…"
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white border border-[#e5e5e5] text-sm text-[#0a0a0a] placeholder:text-[#a3a3a3] outline-none focus:border-[#d4d4d4] transition-colors"
            />
          </div>
        )}
        <div className="flex-1 min-w-0" />
        <button
          onClick={() => { setShowInvite(true); setInviteError(null); setInviteSent(false); }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F44444] text-white text-sm font-medium hover:bg-[#E03333] transition-colors flex-shrink-0"
        >
          <UserPlus className="w-3.5 h-3.5" />
          Invite
        </button>
      </div>

      {/* Main tabs */}
      <div className="flex gap-0 border-b border-[#e5e5e5] mb-5">
        {(["editors", "coverage", "sections", "analytics"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setMainTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              mainTab === tab
                ? "border-[#0a0a0a] text-[#0a0a0a]"
                : "border-transparent text-[#737373] hover:text-[#0a0a0a]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Editors list */}
      {mainTab === "editors" && (
        loading ? (
          <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={`flex items-center gap-4 px-5 py-4 animate-pulse ${i < 4 ? "border-b border-[#f5f5f5]" : ""}`}>
                <div className="w-10 h-10 rounded-full bg-[#ebebeb] flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-[#ebebeb] rounded" style={{ width: `${35 + (i % 3) * 12}%` }} />
                  <div className="h-3 bg-[#ebebeb] rounded w-40" />
                </div>
                <div className="h-5 w-20 bg-[#ebebeb] rounded-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-[#e5e5e5] bg-white px-5 py-12 text-center">
            <p className="text-sm text-[#a3a3a3]">
              {searchQ ? "No editors match your search." : "No editors yet. Use Invite to add editors."}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
            {filtered.map((editor, i) => (
              <div
                key={editor.id}
                onClick={() => selectEditor(editor)}
                className={`flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-[#fafafa] transition-colors ${i < filtered.length - 1 ? "border-b border-[#f5f5f5]" : ""} ${selected?.id === editor.id ? "bg-[#fafafa]" : ""}`}
              >
                <div className="flex-shrink-0">
                  {editor.avatar ? (
                    <div className="w-10 h-10 rounded-full overflow-hidden ring-1 ring-[#e5e5e5]">
                      <Image src={editor.avatar} alt={editor.name} width={40} height={40} sizes="40px" className="object-cover w-full h-full" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#525252]/10 flex items-center justify-center ring-1 ring-[#e5e5e5]">
                      <span className="text-sm font-semibold text-[#525252]">{editor.name.charAt(0)}</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-sm font-semibold text-[#0a0a0a]">{editor.name}</span>
                    {editor.verified && <span className="text-[10px] font-semibold text-[#22c55e] bg-[#F0FDF4] px-1.5 py-0.5 rounded-full">Verified</span>}
                    {editor.banned && <span className="text-[10px] font-semibold text-[#F44444] bg-[#FFF0F0] px-1.5 py-0.5 rounded-full">Banned</span>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#a3a3a3] flex-wrap">
                    <span>@{editor.handle}</span>
                    {editor.assignments.length > 0 && (
                      <>
                        <span className="text-[#e5e5e5]">·</span>
                        <span className="flex items-center gap-1.5">
                          {editor.assignments.slice(0, 4).map(a => (
                            <span key={a.sectionId} className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: a.section.color }} title={a.section.name} />
                          ))}
                          <span className="truncate max-w-[160px]">
                            {editor.assignments.slice(0, 2).map(a => a.section.name).join(", ")}
                            {editor.assignments.length > 2 ? ` +${editor.assignments.length - 2}` : ""}
                          </span>
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {editor.assignedPostCount > 0 && (
                  <div className="hidden sm:flex flex-col items-center flex-shrink-0 w-12">
                    <div className="flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-[#a3a3a3]" />
                      <span className="text-sm font-semibold text-[#0a0a0a]">{editor.assignedPostCount}</span>
                    </div>
                    <span className="text-[10px] text-[#a3a3a3]">assigned</span>
                  </div>
                )}

                <ChevronRight className="w-3.5 h-3.5 text-[#d4d4d4] flex-shrink-0" />
              </div>
            ))}
          </div>
        )
      )}

      {/* Coverage view */}
      {mainTab === "coverage" && (
        loading ? (
          <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`px-5 py-4 animate-pulse ${i < 3 ? "border-b border-[#f5f5f5]" : ""}`}>
                <div className="h-3.5 bg-[#ebebeb] rounded w-32 mb-3" />
                <div className="flex gap-2">
                  <div className="h-7 w-20 bg-[#ebebeb] rounded-lg" />
                  <div className="h-7 w-24 bg-[#ebebeb] rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : coverageData.length === 0 ? (
          <div className="rounded-xl border border-[#e5e5e5] bg-white px-5 py-12 text-center">
            <p className="text-sm text-[#a3a3a3]">No sections configured.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
            {coverageData.map(({ section, sectionEditors }, i) => (
              <div key={section.id} className={`px-5 py-4 ${i < coverageData.length - 1 ? "border-b border-[#f5f5f5]" : ""}`}>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: section.color }} />
                  <span className="text-sm font-medium text-[#0a0a0a]">{section.name}</span>
                  {sectionEditors.length === 0 && (
                    <span className="ml-auto text-[10px] font-medium text-[#D97706] bg-[#FFF9EC] px-1.5 py-0.5 rounded-full">No editor</span>
                  )}
                </div>
                {sectionEditors.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {sectionEditors.map(e => {
                      const assignment = e.assignments.find(a => a.sectionId === section.id);
                      return (
                        <button
                          key={e.id}
                          onClick={() => selectEditor(e)}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#fafafa] border border-[#f0f0f0] hover:border-[#d4d4d4] transition-colors text-xs text-[#0a0a0a]"
                        >
                          {e.avatar ? (
                            <Image src={e.avatar} alt={e.name} width={16} height={16} sizes="16px" className="rounded-full object-cover w-4 h-4 flex-shrink-0" />
                          ) : (
                            <span className="w-4 h-4 rounded-full bg-[#525252]/20 flex items-center justify-center text-[9px] font-semibold text-[#525252] flex-shrink-0">
                              {e.name.charAt(0)}
                            </span>
                          )}
                          {e.name}
                          {assignment?.canPublish && <span className="text-[9px] text-[#22c55e] font-semibold ml-0.5">pub</span>}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-[#a3a3a3]">Articles submitted here have no reviewer.</p>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* Sections tab */}
      {mainTab === "sections" && (
        <div className="space-y-3">
          {/* Create new section */}
          <div className="rounded-xl border border-[#e5e5e5] bg-white p-4 space-y-3">
            <p className="text-xs font-semibold text-[#a3a3a3] uppercase tracking-wide">New section</p>
            <div className="flex gap-2">
              <input
                value={newSectionName}
                onChange={e => setNewSectionName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleCreateSection()}
                placeholder="Section name"
                className="flex-1 px-3.5 py-2 rounded-xl bg-[#fafafa] border border-[#e5e5e5] text-sm text-[#0a0a0a] placeholder:text-[#a3a3a3] outline-none focus:border-[#d4d4d4] transition-colors"
              />
              <input
                type="color"
                value={newSectionColor}
                onChange={e => setNewSectionColor(e.target.value)}
                className="w-10 h-10 rounded-lg border border-[#e5e5e5] cursor-pointer bg-[#fafafa] p-1"
              />
              <button
                onClick={handleCreateSection}
                disabled={!newSectionName.trim() || addingSection}
                className="px-4 py-2 rounded-xl bg-[#0a0a0a] text-white text-sm font-medium hover:bg-[#1a1a1a] transition-colors disabled:opacity-40 flex items-center gap-1.5"
              >
                {addingSection ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Add
              </button>
            </div>
          </div>

          {/* Section list */}
          <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
            {allSections.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-[#a3a3a3]">No sections yet.</p>
              </div>
            ) : (
              allSections.map((section, i) => (
                <div key={section.id} className={`px-5 py-3.5 flex items-center gap-3 ${i < allSections.length - 1 ? "border-b border-[#f5f5f5]" : ""}`}>
                  {editingSection?.id === section.id ? (
                    <>
                      <input
                        value={editingSection.name}
                        onChange={e => setEditingSection(s => s ? { ...s, name: e.target.value } : s)}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-[#fafafa] border border-[#e5e5e5] text-sm text-[#0a0a0a] outline-none focus:border-[#d4d4d4] transition-colors"
                      />
                      <input
                        type="color"
                        value={editingSection.color}
                        onChange={e => setEditingSection(s => s ? { ...s, color: e.target.value } : s)}
                        className="w-8 h-8 rounded-lg border border-[#e5e5e5] cursor-pointer bg-[#fafafa] p-0.5"
                      />
                      <button onClick={handleUpdateSection} disabled={addingSection} className="text-xs text-white bg-[#0a0a0a] px-3 py-1.5 rounded-lg hover:bg-[#1a1a1a] transition-colors disabled:opacity-40">Save</button>
                      <button onClick={() => setEditingSection(null)} className="text-xs text-[#737373] px-2 py-1.5 transition-colors hover:text-[#0a0a0a]">Cancel</button>
                    </>
                  ) : (
                    <>
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: section.color }} />
                      <span className={`flex-1 text-sm ${section.active ? "text-[#0a0a0a]" : "text-[#a3a3a3] line-through"}`}>{section.name}</span>
                      {!section.active && <span className="text-[10px] font-medium text-[#D97706] bg-[#FFF9EC] px-1.5 py-0.5 rounded-full">Inactive</span>}
                      <button onClick={() => setEditingSection({ id: section.id, name: section.name, color: section.color })} className="text-xs text-[#525252] hover:text-[#0a0a0a] px-2 py-1 transition-colors">Edit</button>
                      {section.active ? (
                        <button onClick={() => setDeactivateConfirmId(section.id)} className="text-xs text-[#F44444] hover:text-[#cc2a2a] px-2 py-1 transition-colors">Deactivate</button>
                      ) : (
                        <button onClick={() => handleReactivateSection(section.id)} className="text-xs text-[#22c55e] hover:text-[#16a34a] px-2 py-1 transition-colors">Restore</button>
                      )}
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Analytics tab */}
      {mainTab === "analytics" && <EditorAnalyticsTab />}

      {/* Detail Panel */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/20 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setSelected(null)}
            />
            <motion.div
              className="fixed top-0 right-0 bottom-0 w-full max-w-[440px] bg-white shadow-[0_0_40px_rgba(0,0,0,0.12)] z-50 flex flex-col overflow-hidden"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
            >
              {/* Header */}
              <div className="px-6 pt-6 pb-0 border-b border-[#f5f5f5] flex-shrink-0">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {selected.avatar ? (
                      <div className="w-14 h-14 rounded-full overflow-hidden ring-1 ring-[#e5e5e5] flex-shrink-0">
                        <Image src={selected.avatar} alt={selected.name} width={56} height={56} sizes="56px" className="object-cover w-full h-full" />
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-[#525252]/10 flex items-center justify-center ring-1 ring-[#e5e5e5] flex-shrink-0">
                        <span className="text-xl font-semibold text-[#525252]">{selected.name.charAt(0)}</span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-semibold text-[#0a0a0a]">{selected.name}</span>
                        {selected.verified && <span className="text-[10px] font-semibold text-[#22c55e] bg-[#F0FDF4] px-1.5 py-0.5 rounded-full">Verified</span>}
                        {selected.banned && <span className="text-[10px] font-semibold text-[#F44444] bg-[#FFF0F0] px-1.5 py-0.5 rounded-full">Banned</span>}
                      </div>
                      <p className="text-xs text-[#a3a3a3] mt-0.5">@{selected.handle}</p>
                      {selected.title && <p className="text-xs text-[#737373] mt-0.5">{selected.title}</p>}
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-[#f5f5f5] transition-colors flex-shrink-0 ml-2">
                    <X className="w-4 h-4 text-[#737373]" />
                  </button>
                </div>

                <div className="flex items-center gap-4 text-xs text-[#737373] mb-3">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    {selected.assignedPostCount} assigned
                  </span>
                  <span>{selected.noteCount} note{selected.noteCount !== 1 ? "s" : ""}</span>
                  {selected.joinedDate && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(selected.joinedDate)}
                    </span>
                  )}
                </div>

                {/* Detail tabs */}
                <div className="flex gap-0">
                  {(["details", "posts", "activity"] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => handleDetailTab(tab)}
                      className={`px-3 py-2.5 text-xs font-medium capitalize transition-colors border-b-2 ${
                        detailTab === tab
                          ? "border-[#0a0a0a] text-[#0a0a0a]"
                          : "border-transparent text-[#737373] hover:text-[#0a0a0a]"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto">

                {/* Details tab */}
                {detailTab === "details" && (
                  <>
                    <div className="px-6 py-4 border-b border-[#f5f5f5]">
                      <div className="space-y-2.5">
                        <div className="flex items-start gap-3 text-sm">
                          <span className="text-[#a3a3a3] text-xs w-14 flex-shrink-0 pt-0.5">Email</span>
                          <span className="text-[#0a0a0a] break-all">{selected.email}</span>
                        </div>
                        {selected.location && (
                          <div className="flex items-center gap-3 text-sm">
                            <span className="text-[#a3a3a3] text-xs w-14 flex-shrink-0">Location</span>
                            <span className="text-[#525252]">{selected.location}</span>
                          </div>
                        )}
                        {selected.website && (
                          <div className="flex items-center gap-3 text-sm">
                            <span className="text-[#a3a3a3] text-xs w-14 flex-shrink-0">Website</span>
                            <a href={selected.website} target="_blank" rel="noopener noreferrer" className="text-[#F44444] hover:underline truncate" onClick={e => e.stopPropagation()}>
                              {selected.website.replace(/^https?:\/\//, "")}
                            </a>
                          </div>
                        )}
                      </div>
                      {selected.bio && <p className="text-xs text-[#525252] mt-3 leading-relaxed">{selected.bio}</p>}
                    </div>

                    <div className="px-6 py-4 border-b border-[#f5f5f5]">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wide">Sections</p>
                        <button
                          onClick={() => { setShowAddSection(v => !v); setAddingSectionId(null); setAddCanPublish(false); }}
                          className="flex items-center gap-1 text-xs text-[#525252] hover:text-[#0a0a0a] transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          Add
                        </button>
                      </div>

                      {selected.assignments.length === 0 && !showAddSection && (
                        <p className="text-xs text-[#a3a3a3]">No sections assigned.</p>
                      )}

                      <div className="space-y-1">
                        {selected.assignments.map(a => (
                          <div key={a.sectionId} className="flex items-center gap-2.5 py-1.5">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: a.section.color }} />
                            <span className="text-sm text-[#0a0a0a] flex-1 min-w-0 truncate">{a.section.name}</span>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="text-[10px] text-[#a3a3a3]">publish</span>
                              <button
                                type="button"
                                onClick={() => handleToggleCanPublish(selected.id, a.sectionId, !a.canPublish)}
                                className={`relative w-7 h-4 rounded-full transition-colors cursor-pointer ${a.canPublish ? "bg-[#22c55e]" : "bg-[#e5e5e5]"}`}
                              >
                                <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${a.canPublish ? "left-3.5" : "left-0.5"}`} />
                              </button>
                            </div>
                            <button onClick={() => handleRemoveSection(selected.id, a.sectionId)} className="p-0.5 rounded text-[#d4d4d4] hover:text-[#F44444] transition-colors flex-shrink-0">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <AnimatePresence>
                        {showAddSection && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ type: "spring", stiffness: 400, damping: 35 }}
                            className="overflow-hidden"
                          >
                            <div className="pt-3 space-y-2.5">
                              <select
                                value={addingSectionId ?? ""}
                                onChange={e => setAddingSectionId(Number(e.target.value) || null)}
                                className="w-full px-3 py-2 rounded-lg bg-[#fafafa] border border-[#e5e5e5] text-sm text-[#0a0a0a] outline-none focus:border-[#d4d4d4] transition-colors"
                              >
                                <option value="">Pick a section…</option>
                                {allSections.filter(s => !selected.assignments.some(a => a.sectionId === s.id)).map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <button type="button" onClick={() => setAddCanPublish(v => !v)} className={`relative w-7 h-4 rounded-full transition-colors cursor-pointer ${addCanPublish ? "bg-[#22c55e]" : "bg-[#e5e5e5]"}`}>
                                    <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${addCanPublish ? "left-3.5" : "left-0.5"}`} />
                                  </button>
                                  <span className="text-xs text-[#525252]">Can publish</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button onClick={() => { setShowAddSection(false); setAddingSectionId(null); }} className="text-xs text-[#737373] hover:text-[#0a0a0a] px-2 py-1 transition-colors">Cancel</button>
                                  <button
                                    onClick={() => handleAddSection(selected.id)}
                                    disabled={!addingSectionId || addingSectionLoading}
                                    className="text-xs text-white bg-[#0a0a0a] hover:bg-[#1a1a1a] px-3 py-1 rounded-lg transition-colors disabled:opacity-40 flex items-center gap-1.5"
                                  >
                                    {addingSectionLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                                    Assign
                                  </button>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="px-6 py-4 border-b border-[#f5f5f5] space-y-4">
                      <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wide">Permissions</p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[#0a0a0a]">Role</span>
                        {changing ? <Loader2 className="w-4 h-4 animate-spin text-[#a3a3a3]" /> : (
                          <div className="w-40">
                            <Dropdown
                              value="EDITOR"
                              onChange={role => handleRoleChange(selected.id, role)}
                              options={[
                                { value: "EDITOR", label: "Editor", description: "Editor", badge: { label: "Editor", className: "bg-sky-500/10 text-sky-600 border border-sky-500/20" } },
                                { value: "AUTHOR", label: "Author", description: "Author", badge: { label: "Author", className: "bg-purple-500/10 text-purple-600 border border-purple-500/20" } },
                                { value: "CIRCLE", label: "Circle", description: "Circle", badge: { label: "Circle", className: "bg-red-500/10 text-[#F44444] border border-red-500/20" } },
                                { value: "ADMIN", label: "Admin", description: "Admin", badge: { label: "Admin", className: "bg-card text-foreground border border-border" } },
                                { value: "NORMAL", label: "Normal", description: "Normal", badge: { label: "Normal", className: "bg-card text-muted border border-border" } },
                              ]}
                            />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-[#0a0a0a]">Banned</p>
                          <p className="text-xs text-[#a3a3a3]">Restrict platform access</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleBanToggle(selected.id, !selected.banned)}
                          className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 ${selected.banned ? "bg-[#F44444]" : "bg-[#e5e5e5]"}`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${selected.banned ? "left-4" : "left-0.5"}`} />
                        </button>
                      </div>
                    </div>

                    <div className="px-6 py-4 space-y-2">
                      <a
                        href={`/author/${selected.handle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-[#e5e5e5] text-sm text-[#0a0a0a] hover:bg-[#fafafa] transition-colors"
                        onClick={e => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-[#737373]" />
                        View public profile
                      </a>
                      <button
                        onClick={() => setDeleteConfirm(selected.id)}
                        disabled={deleting}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-[#F44444]/20 text-sm text-[#F44444] hover:bg-[#FFF0F0] transition-colors disabled:opacity-50"
                      >
                        {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        Delete editor
                      </button>
                    </div>
                  </>
                )}

                {/* Posts tab */}
                {detailTab === "posts" && (
                  <div className="px-6 py-4">
                    {loadingDetail ? (
                      <div className="space-y-3 pt-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="h-12 bg-[#f5f5f5] rounded-xl animate-pulse" />
                        ))}
                      </div>
                    ) : editorPosts.length === 0 ? (
                      <p className="text-sm text-[#a3a3a3] text-center py-8">No posts assigned.</p>
                    ) : (
                      <div>
                        {editorPosts.map((post, i) => (
                          <div key={post.id} className={`flex items-center gap-3 py-3 ${i < editorPosts.length - 1 ? "border-b border-[#f5f5f5]" : ""}`}>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-[#0a0a0a] truncate">{post.title || "Untitled"}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {post.section && (
                                  <span className="flex items-center gap-1 text-xs text-[#737373]">
                                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: post.section.color }} />
                                    {post.section.name}
                                  </span>
                                )}
                                <span className="text-[10px] text-[#a3a3a3]">{formatDate(post.createdAt)}</span>
                              </div>
                            </div>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                              post.status === "published" ? "bg-[#F0FDF4] text-[#22c55e]" :
                              post.status === "pending" ? "bg-[#FFF9EC] text-[#D97706]" :
                              "bg-[#f5f5f5] text-[#737373]"
                            }`}>
                              {post.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Activity tab */}
                {detailTab === "activity" && (
                  <div className="px-6 py-4">
                    {loadingDetail ? (
                      <div className="space-y-3 pt-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="h-10 bg-[#f5f5f5] rounded-xl animate-pulse" />
                        ))}
                      </div>
                    ) : editorActivity.length === 0 ? (
                      <p className="text-sm text-[#a3a3a3] text-center py-8">No activity yet.</p>
                    ) : (
                      <div>
                        {editorActivity.map((item, i) => (
                          <div key={item.id} className={`flex items-start gap-3 py-3 ${i < editorActivity.length - 1 ? "border-b border-[#f5f5f5]" : ""}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-[#d4d4d4] flex-shrink-0 mt-1.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-[#0a0a0a] capitalize">{formatAction(item.action)}</p>
                              {item.post?.title && (
                                <p className="text-xs text-[#737373] truncate mt-0.5">{item.post.title}</p>
                              )}
                            </div>
                            <span className="text-[10px] text-[#a3a3a3] flex-shrink-0 mt-0.5">{timeAgo(item.createdAt)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Invite Modal */}
      <AnimatePresence>
        {showInvite && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
            <motion.div
              className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 35 }}
            >
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm font-semibold text-[#0a0a0a]">Invite editor</p>
                <button onClick={() => setShowInvite(false)} className="p-1.5 rounded-lg hover:bg-[#f5f5f5] transition-colors">
                  <X className="w-4 h-4 text-[#737373]" />
                </button>
              </div>

              {inviteSent ? (
                <div className="py-8 text-center">
                  <p className="text-sm font-medium text-[#0a0a0a]">Invite sent</p>
                  <p className="text-xs text-[#a3a3a3] mt-1">They'll receive an email to join as an Editor.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-[#525252] block mb-1.5">Email <span className="text-[#F44444]">*</span></label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      placeholder="editor@example.com"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#fafafa] border border-[#e5e5e5] text-sm outline-none focus:border-[#d4d4d4] transition-all"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#525252] block mb-1.5">Name <span className="text-[#c0c0c0] font-normal">· optional</span></label>
                    <input
                      type="text"
                      value={inviteName}
                      onChange={e => setInviteName(e.target.value)}
                      placeholder="Editor's name"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#fafafa] border border-[#e5e5e5] text-sm outline-none focus:border-[#d4d4d4] transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-[#525252] block mb-1.5">Sections <span className="text-[#F44444]">*</span></label>
                    <div className="flex flex-wrap gap-1.5">
                      {allSections.map(s => {
                        const active = inviteSectionIds.includes(s.id);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setInviteSectionIds(prev => prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id])}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all border ${
                              active ? "bg-[#0a0a0a] text-white border-[#0a0a0a]" : "bg-[#fafafa] text-[#525252] border-[#e5e5e5] hover:border-[#d4d4d4]"
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: active ? "white" : s.color }} />
                            {s.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[#0a0a0a]">Can publish</p>
                      <p className="text-xs text-[#a3a3a3]">Allow publishing in assigned sections</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInviteCanPublish(v => !v)}
                      className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 ${inviteCanPublish ? "bg-[#22c55e]" : "bg-[#e5e5e5]"}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${inviteCanPublish ? "left-4" : "left-0.5"}`} />
                    </button>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-[#525252] block mb-1.5">Personal note <span className="text-[#c0c0c0] font-normal">· optional</span></label>
                    <textarea
                      value={inviteNote}
                      onChange={e => setInviteNote(e.target.value)}
                      placeholder="Add a personal message to the invite email…"
                      rows={2}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#fafafa] border border-[#e5e5e5] text-sm outline-none focus:border-[#d4d4d4] transition-all resize-none"
                    />
                  </div>

                  {inviteError && <p className="text-xs text-[#F44444]">{inviteError}</p>}

                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setShowInvite(false)} className="flex-1 py-2.5 rounded-xl border border-[#e5e5e5] text-sm text-[#737373] hover:bg-[#fafafa] transition-colors">
                      Cancel
                    </button>
                    <button
                      onClick={sendInvite}
                      disabled={sendingInvite || !inviteEmail.trim() || inviteSectionIds.length === 0}
                      className="flex-1 py-2.5 rounded-xl bg-[#F44444] text-white text-sm font-medium hover:bg-[#E03333] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {sendingInvite && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Send invite
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={confirmDelete}
        title="Delete Editor"
        message="Delete this editor from Albiz? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isSubmitting={deleting}
      />

      <ConfirmModal
        isOpen={deactivateConfirmId !== null}
        onClose={() => setDeactivateConfirmId(null)}
        onConfirm={() => { if (deactivateConfirmId !== null) { handleDeactivateSection(deactivateConfirmId); setDeactivateConfirmId(null); } }}
        title="Deactivate section"
        message="Articles in this section will remain but it will no longer accept new assignments. You can restore it later."
        confirmText="Deactivate"
        cancelText="Cancel"
      />
    </div>
  );
}
