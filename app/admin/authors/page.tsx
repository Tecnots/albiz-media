"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  ExternalLink, Loader2, FileText, Trash2, Send, X,
  Search, UserPlus, Calendar, ChevronRight,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { AdminPillTabs, Dropdown, ConfirmModal } from "../admin-components";

const ANALYTICS_RANGES: { label: string; days: number | null }[] = [
  { label: "1D",  days: 1    },
  { label: "7D",  days: 7    },
  { label: "30D", days: 30   },
  { label: "90D", days: 90   },
  { label: "1Y",  days: 365  },
  { label: "All", days: null },
];

function fmtN(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

interface Author {
  id: number;
  name: string;
  handle: string;
  email: string;
  role: "NORMAL" | "CIRCLE" | "AUTHOR" | "ADMIN" | "EDITOR" | "SHORTS_CREATOR";
  avatar: string;
  title: string;
  bio: string;
  location: string;
  website: string;
  verified: boolean;
  joinedDate: string | null;
  banned: boolean;
  banReason: string | null;
  canPost: boolean;
  articleCount: number;
  followers: number;
}

interface Article {
  id: number;
  title: string;
  status: string;
  createdAt: string;
}

const ROLE_STYLE: Record<string, { className: string; label: string }> = {
  ADMIN:          { className: "bg-card text-foreground border border-border",  label: "Admin" },
  AUTHOR:         { className: "bg-purple-500/10 text-purple-600 border border-purple-500/20",  label: "Author" },
  EDITOR:         { className: "bg-sky-500/10 text-sky-600 border border-sky-500/20",  label: "Editor" },
  CIRCLE:         { className: "bg-red-500/10 text-[#F44444] border border-red-500/20",  label: "Circle" },
  NORMAL:         { className: "bg-card text-muted border border-border",  label: "Normal" },
  SHORTS_CREATOR: { className: "bg-orange-500/10 text-orange-600 border border-orange-500/20",  label: "Shorts" },
};

function RolePill({ role }: { role: string }) {
  const s = ROLE_STYLE[role] ?? ROLE_STYLE.NORMAL;
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${s.className}`}>
      {s.label}
    </span>
  );
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function PaginationBar({ page, pages, total, limit, onPrev, onNext }: {
  page: number; pages: number; total: number; limit: number;
  onPrev: () => void; onNext: () => void;
}) {
  if (pages <= 1) return null;
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  return (
    <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#f0f0f0]">
      <span className="text-xs text-[#a3a3a3]">{start}–{end} of {total}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          disabled={page === 1}
          className="px-2.5 py-1 rounded-lg border border-[#e5e5e5] text-xs text-[#525252] hover:bg-[#fafafa] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>
        <span className="text-xs text-[#a3a3a3]">{page} / {pages}</span>
        <button
          onClick={onNext}
          disabled={page >= pages}
          className="px-2.5 py-1 rounded-lg border border-[#e5e5e5] text-xs text-[#525252] hover:bg-[#fafafa] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}

const MAIN_TABS = ["Authors", "Analytics"];
const TABS = ["All", "Accepted", "Pending", "Rejected"];
const TAB_INVITE_STATUS = [null, "accepted", "pending", "revoked"] as const;
const PAGE_LIMIT = 20;

interface InviteLite { email: string; status: string; }

export default function AdminAuthorsPage() {
  const [mainTab, setMainTab] = useState(0);
  const [analyticsDays, setAnalyticsDays] = useState<number | null>(30);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const [authors, setAuthors] = useState<Author[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [inviteByEmail, setInviteByEmail] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");
  const [changing, setChanging] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Detail panel
  const [selectedAuthor, setSelectedAuthor] = useState<Author | null>(null);
  const [authorArticles, setAuthorArticles] = useState<Article[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(false);

  // Suggestion modal
  const [suggestionTarget, setSuggestionTarget] = useState<Author | null>(null);
  const [suggTitle, setSuggTitle] = useState("");
  const [suggDesc, setSuggDesc] = useState("");
  const [suggDeadline, setSuggDeadline] = useState("");
  const [sendingSugg, setSendingSugg] = useState(false);
  const [suggSent, setSuggSent] = useState(false);

  // Invite modal
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteNote, setInviteNote] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState(false);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchInvites = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/invites");
      if (!res.ok) return {};
      const data = await res.json();
      const map: Record<string, string> = {};
      for (const inv of (data.invites ?? []) as InviteLite[]) {
        const key = inv.email.toLowerCase();
        if (!map[key]) map[key] = inv.status;
      }
      return map;
    } catch { return {}; }
  }, []);

  // For tab 0 (All): server-side paginated + searched
  const loadPaginated = useCallback(async (p: number, q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: String(PAGE_LIMIT),
        ...(q ? { search: q } : {}),
      });
      const [authRes, invMap] = await Promise.all([
        fetch(`/api/admin/authors?${params}`).then(r => r.ok ? r.json() : { authors: [], total: 0, page: 1, pages: 1 }).catch(() => ({ authors: [], total: 0, page: 1, pages: 1 })),
        fetchInvites(),
      ]);
      setAuthors(authRes.authors ?? []);
      setTotal(authRes.total ?? 0);
      setPage(authRes.page ?? 1);
      setPages(authRes.pages ?? 1);
      setInviteByEmail(invMap);
    } finally { setLoading(false); }
  }, [fetchInvites]);

  // For invite tabs: load all AUTHORS, filter client-side
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [authRes, invMap] = await Promise.all([
        fetch("/api/admin/authors?all=1").then(r => r.ok ? r.json() : { authors: [], total: 0 }).catch(() => ({ authors: [], total: 0 })),
        fetchInvites(),
      ]);
      setAuthors(authRes.authors ?? []);
      setTotal(authRes.total ?? 0);
      setPage(1);
      setPages(1);
      setInviteByEmail(invMap);
    } finally { setLoading(false); }
  }, [fetchInvites]);

  // Tab 0 with debounced search
  useEffect(() => {
    if (tab !== 0) return;
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      setPage(1);
      loadPaginated(1, search);
    }, 300);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [search, tab]);  

  // Tab change
  useEffect(() => {
    if (tab === 0) {
      loadPaginated(1, search);
    } else {
      loadAll();
    }
    setPage(1);
  }, [tab]);  

  useEffect(() => {
    if (mainTab !== 1) return;
    let alive = true;
    setAnalyticsLoading(true);
    fetch(`/api/admin/analytics/authors?days=${analyticsDays ?? "all"}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (alive && d) setAnalyticsData(d); })
      .catch(() => {})
      .finally(() => { if (alive) setAnalyticsLoading(false); });
    return () => { alive = false; };
  }, [mainTab, analyticsDays]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    loadPaginated(newPage, search);
  };

  const loadArticles = async (userId: number) => {
    setLoadingArticles(true);
    setAuthorArticles([]);
    try {
      const res = await fetch(`/api/posts?userId=${userId}&status=all`);
      if (res.ok) {
        const data = await res.json();
        setAuthorArticles(
          (Array.isArray(data) ? data : []).slice(0, 8).map((p: any) => ({
            id: p.id,
            title: p.title || "Untitled",
            status: p.status || "published",
            createdAt: p.createdAt,
          }))
        );
      }
    } finally { setLoadingArticles(false); }
  };

  const selectAuthor = (author: Author) => {
    setSelectedAuthor(author);
    loadArticles(author.id);
  };

  const handleRoleChange = async (id: number, role: string) => {
    setChanging(id);
    try {
      const res = await fetch("/api/admin/authors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, role }),
      });
      if (!res.ok) return;
      if (role !== "AUTHOR") {
        // User is no longer an author — remove from this list and close panel
        setAuthors(prev => prev.filter(a => a.id !== id));
        setTotal(prev => Math.max(0, prev - 1));
        if (selectedAuthor?.id === id) setSelectedAuthor(null);
      } else {
        setAuthors(prev => prev.map(a => a.id === id ? { ...a, role: role as Author["role"] } : a));
        if (selectedAuthor?.id === id) setSelectedAuthor(prev => prev ? { ...prev, role: role as Author["role"] } : null);
      }
    } finally { setChanging(null); }
  };

  const handleCanPostToggle = async (id: number, canPost: boolean) => {
    await fetch("/api/admin/authors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, canPost }),
    });
    setAuthors(prev => prev.map(a => a.id === id ? { ...a, canPost } : a));
    if (selectedAuthor?.id === id) setSelectedAuthor(prev => prev ? { ...prev, canPost } : null);
  };

  const handleBanToggle = async (id: number, banned: boolean) => {
    await fetch("/api/admin/authors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, banned }),
    });
    setAuthors(prev => prev.map(a => a.id === id ? { ...a, banned } : a));
    if (selectedAuthor?.id === id) setSelectedAuthor(prev => prev ? { ...prev, banned } : null);
  };

  const handleDelete = (id: number) => setDeleteConfirm(id);

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(deleteConfirm);
    try {
      const res = await fetch(`/api/admin/authors?id=${deleteConfirm}`, { method: "DELETE" });
      if (res.ok) {
        setAuthors(prev => prev.filter(a => a.id !== deleteConfirm));
        setTotal(prev => Math.max(0, prev - 1));
        if (selectedAuthor?.id === deleteConfirm) setSelectedAuthor(null);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete user");
      }
    } catch { alert("Failed to delete user"); }
    finally { setDeleting(null); setDeleteConfirm(null); }
  };

  const sendSuggestion = async () => {
    if (!suggestionTarget || !suggTitle.trim()) return;
    setSendingSugg(true);
    try {
      const res = await fetch("/api/admin/author-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorIds: [suggestionTarget.id],
          title: suggTitle.trim(),
          description: suggDesc.trim() || null,
          deadline: suggDeadline.trim() || null,
        }),
      });
      if (res.ok) {
        setSuggSent(true);
        setTimeout(() => {
          setSuggestionTarget(null);
          setSuggTitle(""); setSuggDesc(""); setSuggDeadline(""); setSuggSent(false);
        }, 1500);
      }
    } finally { setSendingSugg(false); }
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setSendingInvite(true);
    setInviteError(null);
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: "AUTHOR",
          name: inviteName.trim() || null,
          note: inviteNote.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.error || "Failed to send invite");
      } else {
        setInviteSent(true);
        if (tab === 0) loadPaginated(page, search); else loadAll();
        setTimeout(() => {
          setShowInvite(false);
          setInviteEmail(""); setInviteName(""); setInviteNote(""); setInviteSent(false);
        }, 1800);
      }
    } finally { setSendingInvite(false); }
  };

  const matchesInviteStatus = (a: Author, status: string | null) => {
    if (!status) return true;
    return inviteByEmail[a.email.toLowerCase()] === status;
  };

  // For "All" tab: authors already server-filtered; display as-is
  // For invite tabs: filter locally from the fully loaded list
  const searchQ = search.toLowerCase().trim();
  const displayed = tab === 0
    ? authors  // server-side filtered + paginated
    : authors
        .filter(a => matchesInviteStatus(a, TAB_INVITE_STATUS[tab]))
        .filter(a =>
          !searchQ ||
          a.name.toLowerCase().includes(searchQ) ||
          a.handle.toLowerCase().includes(searchQ) ||
          a.email.toLowerCase().includes(searchQ)
        );

  // Invite tab counts are only accurate when those tabs are loaded (tab > 0)
  const tabLabels = TABS.map((t, i) => {
    if (i === 0) return total > 0 ? `${t} (${total})` : t;
    if (tab === 0) return t; // can't show accurate count from a single page
    const count = authors.filter(a => matchesInviteStatus(a, TAB_INVITE_STATUS[i])).length;
    return count > 0 ? `${t} (${count})` : t;
  });

  const akpis = analyticsData?.kpis ?? {};

  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">
      {/* Main tab bar */}
      <div className="flex items-center justify-between mb-5">
        <AdminPillTabs tabs={MAIN_TABS} activeTab={mainTab} onTabChange={setMainTab} />
        {mainTab === 0 && (
          <button
            onClick={() => { setShowInvite(true); setInviteError(null); setInviteSent(false); }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F44444] text-white text-sm font-medium hover:bg-[#E03333] transition-colors flex-shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Invite
          </button>
        )}
      </div>

      {/* Analytics tab */}
      {mainTab === 1 && (
        <div className="space-y-5">
          {/* Range filter */}
          <div className="flex items-center gap-1">
            {ANALYTICS_RANGES.map(r => (
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
                  { label: "Total authors",  value: fmtN(akpis.totalAuthors ?? 0), sub: `${akpis.canPostCount ?? 0} can publish` },
                  { label: "Total articles", value: fmtN(akpis.totalArticles ?? 0), sub: `${akpis.periodArticles ?? 0} this period` },
                  { label: "Total views",    value: fmtN(akpis.totalViews ?? 0), sub: null },
                  { label: "Approval rate",  value: `${akpis.approvalRate ?? 0}%`, sub: `${akpis.published ?? 0} published` },
                ].map(s => (
                  <div key={s.label} className="rounded-xl border border-[#e5e5e5] bg-white p-4">
                    <p className="text-xs text-[#737373] mb-1">{s.label}</p>
                    <p className="text-2xl font-bold text-[#0a0a0a]">{s.value}</p>
                    {s.sub && <p className="text-xs text-[#a3a3a3] mt-1">{s.sub}</p>}
                  </div>
                ))}
              </div>

              {/* Chart + status breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-4">
                <div className="rounded-xl border border-[#e5e5e5] bg-white">
                  <div className="px-5 pt-5 pb-3">
                    <p className="text-sm font-semibold text-[#0a0a0a]">Articles created</p>
                    <p className="text-xs text-[#a3a3a3] mt-0.5">Per day in selected period</p>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={analyticsData?.dailySeries ?? []} margin={{ top: 4, right: 20, bottom: 0, left: 4 }}>
                      <defs>
                        <linearGradient id="authAnalGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}    />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#a3a3a3" }} interval="preserveStartEnd" dy={8} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#a3a3a3" }} width={28} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: 10, border: "1px solid #e5e5e5", fontSize: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}
                        labelStyle={{ color: "#0a0a0a", fontWeight: 600 }}
                        cursor={false}
                        formatter={(v: any) => [v, "Articles"]}
                      />
                      <Area type="monotone" dataKey="articles" stroke="#8b5cf6" strokeWidth={2} fill="url(#authAnalGrad)" dot={false} activeDot={{ r: 4, fill: "#8b5cf6", stroke: "white", strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Status breakdown */}
                <div className="rounded-xl border border-[#e5e5e5] bg-white p-5">
                  <p className="text-sm font-semibold text-[#0a0a0a] mb-4">Status breakdown</p>
                  {(analyticsData?.statusBreakdown ?? []).length === 0 ? (
                    <p className="text-xs text-[#a3a3a3] text-center py-6">No articles yet</p>
                  ) : (
                    <div className="space-y-3">
                      {(analyticsData?.statusBreakdown ?? []).map((s: any) => {
                        const total = Math.max(1, akpis.totalArticles ?? 1);
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

              {/* Top authors */}
              <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#f5f5f5] flex items-center justify-between">
                  <p className="text-sm font-semibold text-[#0a0a0a]">Top authors by articles</p>
                  <span className="text-xs text-[#a3a3a3]">All-time</span>
                </div>
                {(analyticsData?.topAuthors ?? []).length === 0 ? (
                  <div className="py-12 text-center text-sm text-[#a3a3a3]">No authors yet.</div>
                ) : (
                  <div>
                    {(analyticsData?.topAuthors ?? []).map((author: any, i: number) => (
                      <div key={author.id} className={`flex items-center gap-4 px-5 py-3 ${i < (analyticsData?.topAuthors?.length ?? 0) - 1 ? "border-b border-[#f5f5f5]" : ""} hover:bg-[#fafafa] transition-colors`}>
                        <span className="text-xs text-[#c0c0c0] w-5 text-right flex-shrink-0">{i + 1}</span>
                        <div className="w-8 h-8 rounded-full flex-shrink-0 ring-1 ring-[#e5e5e5] overflow-hidden bg-[#8b5cf6]/10 flex items-center justify-center">
                          {author.avatar
                            ? <Image src={author.avatar} alt={author.name} width={32} height={32} className="object-cover w-full h-full" />
                            : <span className="text-xs font-semibold text-[#8b5cf6]">{author.name.charAt(0)}</span>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#0a0a0a] truncate">{author.name}</p>
                          <p className="text-xs text-[#a3a3a3]">@{author.handle}</p>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-sm font-semibold text-[#0a0a0a]">{fmtN(author.articleCount)}</p>
                            <p className="text-[10px] text-[#a3a3a3]">articles</p>
                          </div>
                          <div className="text-right hidden sm:block">
                            <p className="text-sm font-semibold text-[#0a0a0a]">{fmtN(author.totalViews)}</p>
                            <p className="text-[10px] text-[#a3a3a3]">views</p>
                          </div>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${author.canPost ? "text-[#22c55e] bg-[#F0FDF4]" : "text-[#737373] bg-[#f5f5f5]"}`}>
                            {author.canPost ? "Active" : "Restricted"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Authors list tab */}
      {mainTab === 0 && <>
      {/* Sub-tab bar + search */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#a3a3a3]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search authors…"
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white border border-[#e5e5e5] text-sm text-[#0a0a0a] placeholder:text-[#a3a3a3] outline-none focus:border-[#d4d4d4] transition-colors"
          />
        </div>
        <p className="text-xs text-[#a3a3a3] flex-1 min-w-0">{total} authors</p>
      </div>

      <div className="mb-5">
        <AdminPillTabs
          tabs={tabLabels}
          activeTab={tab}
          onTabChange={newTab => { setTab(newTab); setSearch(""); }}
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`flex items-center gap-4 px-5 py-4 animate-pulse ${i < 5 ? "border-b border-[#f5f5f5]" : ""}`}>
              <div className="w-10 h-10 rounded-full bg-[#ebebeb] flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="h-3.5 bg-[#ebebeb] rounded" style={{ width: `${30 + (i % 3) * 15}%` }} />
                <div className="h-3 bg-[#ebebeb] rounded w-44" />
              </div>
              <div className="hidden sm:block h-5 w-16 bg-[#ebebeb] rounded-full" />
              <div className="w-7 h-7 bg-[#ebebeb] rounded-lg" />
            </div>
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="rounded-xl border border-[#e5e5e5] bg-white px-5 py-12 text-center">
          <p className="text-sm text-[#a3a3a3]">
            {searchQ ? "No authors match your search." :
              tab === 1 ? "No users from accepted invitations yet." :
              tab === 2 ? "No users with pending invitations." :
              tab === 3 ? "No users with rejected invitations." :
              "No authors yet."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
          <div>
            {displayed.map((author, i) => (
              <div
                key={author.id}
                onClick={() => selectAuthor(author)}
                className={`flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-[#fafafa] transition-colors ${i < displayed.length - 1 ? "border-b border-[#f5f5f5]" : ""} ${selectedAuthor?.id === author.id ? "bg-[#fafafa]" : ""}`}
              >
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {author.avatar ? (
                    <div className="w-10 h-10 rounded-full overflow-hidden ring-1 ring-[#e5e5e5]">
                      <Image src={author.avatar} alt={author.name} width={40} height={40} sizes="40px" className="object-cover w-full h-full" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#F44444]/10 flex items-center justify-center ring-1 ring-[#e5e5e5]">
                      <span className="text-sm font-semibold text-[#F44444]">{author.name.charAt(0)}</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-[#0a0a0a] truncate">{author.name}</span>
                    <RolePill role={author.role} />
                    {author.verified && <span className="text-[10px] font-semibold text-[#22c55e] bg-[#F0FDF4] px-1.5 py-0.5 rounded-full">Verified</span>}
                    {author.banned && <span className="text-[10px] font-semibold text-[#F44444] bg-[#FFF0F0] px-1.5 py-0.5 rounded-full">Banned</span>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#a3a3a3] flex-wrap">
                    <span>@{author.handle}</span>
                    <span className="text-[#e5e5e5]">·</span>
                    <span>{author.email}</span>
                    {author.title && (
                      <>
                        <span className="text-[#e5e5e5]">·</span>
                        <span className="truncate max-w-[160px]">{author.title}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Article count */}
                <div className="hidden sm:flex flex-col items-center flex-shrink-0 w-12">
                  <div className="flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-[#a3a3a3]" />
                    <span className="text-sm font-semibold text-[#0a0a0a]">{author.articleCount}</span>
                  </div>
                  <span className="text-[10px] text-[#a3a3a3]">articles</span>
                </div>

                {/* canPost toggle */}
                <div
                  className="flex-shrink-0 flex flex-col items-center gap-0.5"
                  onClick={e => { e.stopPropagation(); handleCanPostToggle(author.id, !author.canPost); }}
                >
                  <button
                    type="button"
                    className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${author.canPost ? "bg-[#F44444]" : "bg-[#e5e5e5]"}`}
                    title={author.canPost ? "Can publish — click to revoke" : "Cannot publish — click to allow"}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${author.canPost ? "left-4" : "left-0.5"}`} />
                  </button>
                  <span className="text-[9px] text-[#a3a3a3]">can publish</span>
                </div>

                <ChevronRight className="w-3.5 h-3.5 text-[#d4d4d4] flex-shrink-0" />
              </div>
            ))}
          </div>

          {/* Pagination (All tab only) */}
          {tab === 0 && (
            <div className="px-5 pb-4">
              <PaginationBar
                page={page}
                pages={pages}
                total={total}
                limit={PAGE_LIMIT}
                onPrev={() => handlePageChange(page - 1)}
                onNext={() => handlePageChange(page + 1)}
              />
            </div>
          )}
        </div>
      )}

      {/* Author Detail Panel */}
      <AnimatePresence>
        {selectedAuthor && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/20 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setSelectedAuthor(null)}
            />
            <motion.div
              className="fixed top-0 right-0 bottom-0 w-full max-w-[440px] bg-white shadow-[0_0_40px_rgba(0,0,0,0.12)] z-50 flex flex-col overflow-hidden"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
            >
              {/* Panel Header */}
              <div className="px-6 pt-6 pb-5 border-b border-[#f5f5f5] flex-shrink-0">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {selectedAuthor.avatar ? (
                      <div className="w-14 h-14 rounded-full overflow-hidden ring-1 ring-[#e5e5e5] flex-shrink-0">
                        <Image src={selectedAuthor.avatar} alt={selectedAuthor.name} width={56} height={56} sizes="56px" className="object-cover w-full h-full" />
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-[#F44444]/10 flex items-center justify-center ring-1 ring-[#e5e5e5] flex-shrink-0">
                        <span className="text-xl font-semibold text-[#F44444]">{selectedAuthor.name.charAt(0)}</span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-semibold text-[#0a0a0a]">{selectedAuthor.name}</span>
                        {selectedAuthor.verified && <span className="text-[10px] font-semibold text-[#22c55e] bg-[#F0FDF4] px-1.5 py-0.5 rounded-full">Verified</span>}
                        {selectedAuthor.banned && <span className="text-[10px] font-semibold text-[#F44444] bg-[#FFF0F0] px-1.5 py-0.5 rounded-full">Banned</span>}
                      </div>
                      <p className="text-xs text-[#a3a3a3] mt-0.5">@{selectedAuthor.handle}</p>
                      {selectedAuthor.title && <p className="text-xs text-[#737373] mt-0.5">{selectedAuthor.title}</p>}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedAuthor(null)}
                    className="p-1.5 rounded-lg hover:bg-[#f5f5f5] transition-colors flex-shrink-0 ml-2"
                  >
                    <X className="w-4 h-4 text-[#737373]" />
                  </button>
                </div>

                <div className="flex items-center gap-4 text-xs text-[#737373]">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    {selectedAuthor.articleCount} articles
                  </span>
                  {selectedAuthor.joinedDate && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      Joined {formatDate(selectedAuthor.joinedDate)}
                    </span>
                  )}
                </div>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto">
                {/* Profile info */}
                <div className="px-6 py-4 border-b border-[#f5f5f5]">
                  <div className="space-y-2.5">
                    <div className="flex items-start gap-3 text-sm">
                      <span className="text-[#a3a3a3] text-xs w-14 flex-shrink-0 pt-0.5">Email</span>
                      <span className="text-[#0a0a0a] break-all">{selectedAuthor.email}</span>
                    </div>
                    {selectedAuthor.location && (
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-[#a3a3a3] text-xs w-14 flex-shrink-0">Location</span>
                        <span className="text-[#525252]">{selectedAuthor.location}</span>
                      </div>
                    )}
                    {selectedAuthor.website && (
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-[#a3a3a3] text-xs w-14 flex-shrink-0">Website</span>
                        <a
                          href={selectedAuthor.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#F44444] hover:underline truncate"
                          onClick={e => e.stopPropagation()}
                        >
                          {selectedAuthor.website.replace(/^https?:\/\//, "")}
                        </a>
                      </div>
                    )}
                  </div>
                  {selectedAuthor.bio && (
                    <p className="text-xs text-[#525252] mt-3 leading-relaxed">{selectedAuthor.bio}</p>
                  )}
                </div>

                {/* Permissions */}
                <div className="px-6 py-4 border-b border-[#f5f5f5] space-y-4">
                  <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wide">Permissions</p>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#0a0a0a]">Role</span>
                    {changing === selectedAuthor.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#a3a3a3]" />
                    ) : (
                      <div className="w-40">
                        <Dropdown
                          value={selectedAuthor.role}
                          onChange={role => handleRoleChange(selectedAuthor.id, role)}
                          options={[
                            { value: "AUTHOR", label: "Author", description: "Author", badge: { label: "Author", className: "bg-purple-500/10 text-purple-600 border border-purple-500/20" } },
                            { value: "EDITOR", label: "Editor", description: "Editor", badge: { label: "Editor", className: "bg-sky-500/10 text-sky-600 border border-sky-500/20" } },
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
                      <p className="text-sm text-[#0a0a0a]">Can publish</p>
                      <p className="text-xs text-[#a3a3a3]">Allow publishing articles</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCanPostToggle(selectedAuthor.id, !selectedAuthor.canPost)}
                      className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 ${selectedAuthor.canPost ? "bg-[#F44444]" : "bg-[#e5e5e5]"}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${selectedAuthor.canPost ? "left-4" : "left-0.5"}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[#0a0a0a]">Banned</p>
                      <p className="text-xs text-[#a3a3a3]">Restrict platform access</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleBanToggle(selectedAuthor.id, !selectedAuthor.banned)}
                      className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 ${selectedAuthor.banned ? "bg-[#F44444]" : "bg-[#e5e5e5]"}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${selectedAuthor.banned ? "left-4" : "left-0.5"}`} />
                    </button>
                  </div>
                </div>

                {/* Articles */}
                <div className="px-6 py-4 border-b border-[#f5f5f5]">
                  <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wide mb-3">Articles</p>
                  {loadingArticles ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-8 bg-[#f5f5f5] rounded-lg animate-pulse" />
                      ))}
                    </div>
                  ) : authorArticles.length === 0 ? (
                    <p className="text-xs text-[#a3a3a3]">No articles yet.</p>
                  ) : (
                    <div className="space-y-0">
                      {authorArticles.map((article, i) => (
                        <div key={article.id} className={`flex items-center gap-3 py-2.5 ${i < authorArticles.length - 1 ? "border-b border-[#f5f5f5]" : ""}`}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[#0a0a0a] truncate">{article.title}</p>
                            <p className="text-xs text-[#a3a3a3]">{formatDate(article.createdAt)}</p>
                          </div>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                            article.status === "published" ? "bg-[#F0FDF4] text-[#22c55e]" :
                            article.status === "draft" ? "bg-[#f5f5f5] text-[#737373]" :
                            article.status === "pending" ? "bg-[#FFF7ED] text-[#D97706]" :
                            "bg-[#f5f5f5] text-[#737373]"
                          }`}>
                            {article.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="px-6 py-4 space-y-2">
                  <button
                    onClick={() => { setSuggestionTarget(selectedAuthor); setSuggTitle(""); setSuggDesc(""); setSuggDeadline(""); setSuggSent(false); }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-[#e5e5e5] text-sm text-[#0a0a0a] hover:bg-[#fafafa] transition-colors"
                  >
                    <Send className="w-3.5 h-3.5 text-[#737373]" />
                    Send writing suggestion
                  </button>
                  <a
                    href={`/author/${selectedAuthor.handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-[#e5e5e5] text-sm text-[#0a0a0a] hover:bg-[#fafafa] transition-colors"
                    onClick={e => e.stopPropagation()}
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-[#737373]" />
                    View public profile
                  </a>
                  <button
                    onClick={() => handleDelete(selectedAuthor.id)}
                    disabled={deleting === selectedAuthor.id}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-[#F44444]/20 text-sm text-[#F44444] hover:bg-[#FFF0F0] transition-colors disabled:opacity-50"
                  >
                    {deleting === selectedAuthor.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Delete author
                  </button>
                </div>
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
              className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] w-full max-w-md p-6"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 35 }}
            >
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm font-semibold text-[#0a0a0a]">Invite author</p>
                <button onClick={() => setShowInvite(false)} className="p-1.5 rounded-lg hover:bg-[#f5f5f5] transition-colors">
                  <X className="w-4 h-4 text-[#737373]" />
                </button>
              </div>

              {inviteSent ? (
                <div className="py-8 text-center">
                  <p className="text-sm font-medium text-[#0a0a0a]">Invite sent</p>
                  <p className="text-xs text-[#a3a3a3] mt-1">They'll receive an email to join as an Author.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-[#525252] block mb-1.5">Email <span className="text-[#F44444]">*</span></label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      placeholder="author@example.com"
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
                      placeholder="Author's name"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#fafafa] border border-[#e5e5e5] text-sm outline-none focus:border-[#d4d4d4] transition-all"
                    />
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
                    <button
                      onClick={() => setShowInvite(false)}
                      className="flex-1 py-2.5 rounded-xl border border-[#e5e5e5] text-sm text-[#737373] hover:bg-[#fafafa] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={sendInvite}
                      disabled={sendingInvite || !inviteEmail.trim()}
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

      {/* Send Suggestion Modal */}
      <AnimatePresence>
        {suggestionTarget && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60] px-4">
            <motion.div
              className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] w-full max-w-md p-6"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 35 }}
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-sm font-semibold text-[#0a0a0a]">Send suggestion</p>
                  <p className="text-xs text-[#a3a3a3] mt-0.5">to {suggestionTarget.name}</p>
                </div>
                <button onClick={() => setSuggestionTarget(null)} className="p-1.5 rounded-lg hover:bg-[#f5f5f5] transition-colors">
                  <X className="w-4 h-4 text-[#737373]" />
                </button>
              </div>

              {suggSent ? (
                <div className="py-6 text-center">
                  <p className="text-sm font-medium text-[#0a0a0a]">Suggestion sent</p>
                  <p className="text-xs text-[#a3a3a3] mt-1">The author will see it on their dashboard.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-[#525252] block mb-1.5">Topic or title <span className="text-[#F44444]">*</span></label>
                    <input
                      type="text"
                      value={suggTitle}
                      onChange={e => setSuggTitle(e.target.value)}
                      placeholder="e.g. Write about AI in healthcare"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#fafafa] border border-[#e5e5e5] text-sm outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6]/20 transition-all"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#525252] block mb-1.5">Details <span className="text-[#c0c0c0] font-normal">· optional</span></label>
                    <textarea
                      value={suggDesc}
                      onChange={e => setSuggDesc(e.target.value)}
                      placeholder="Context, angle, or key points to cover…"
                      rows={3}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#fafafa] border border-[#e5e5e5] text-sm outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6]/20 transition-all resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#525252] block mb-1.5">Deadline <span className="text-[#c0c0c0] font-normal">· optional</span></label>
                    <input
                      type="text"
                      value={suggDeadline}
                      onChange={e => setSuggDeadline(e.target.value)}
                      placeholder="e.g. June 15, 2026"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#fafafa] border border-[#e5e5e5] text-sm outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6]/20 transition-all"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setSuggestionTarget(null)}
                      className="flex-1 py-2.5 rounded-xl border border-[#e5e5e5] text-sm text-[#737373] hover:bg-[#fafafa] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={sendSuggestion}
                      disabled={sendingSugg || !suggTitle.trim()}
                      className="flex-1 py-2.5 rounded-xl bg-[#8B5CF6] text-white text-sm font-medium hover:bg-[#7C3AED] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {sendingSugg && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Send
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
        title="Delete User"
        message="Delete this author from Albiz? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isSubmitting={deleting !== null}
      />
      </>}
    </div>
  );
}