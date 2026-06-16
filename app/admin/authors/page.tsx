"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  ExternalLink, Loader2, FileText, Trash2, Send, X,
  Search, UserPlus, Calendar, ChevronRight,
} from "lucide-react";
import { AdminPillTabs, Dropdown, ConfirmModal } from "../admin-components";

interface Author {
  id: number;
  name: string;
  handle: string;
  email: string;
  role: "NORMAL" | "CIRCLE" | "AUTHOR" | "ADMIN";
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

const ROLE_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  ADMIN:  { color: "#0a0a0a", bg: "#f0f0f0",  label: "Admin" },
  AUTHOR: { color: "#8B5CF6", bg: "#F5F3FF",  label: "Author" },
  CIRCLE: { color: "#F44444", bg: "#FFF0F0",  label: "Circle" },
  NORMAL: { color: "#525252", bg: "#f5f5f5",  label: "Normal" },
};

function RolePill({ role }: { role: string }) {
  const s = ROLE_STYLE[role] ?? ROLE_STYLE.NORMAL;
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

const TABS = ["All", "Accepted", "Pending", "Rejected"];
const TAB_INVITE_STATUS = [null, "accepted", "pending", "revoked"] as const;
interface InviteLite { email: string; status: string; }

export default function AdminAuthorsPage() {
  const [authors, setAuthors] = useState<Author[]>([]);
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

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/authors").then(r => r.ok ? r.json() : { authors: [] }).catch(() => ({ authors: [] })),
      fetch("/api/admin/invites").then(r => r.ok ? r.json() : { invites: [] }).catch(() => ({ invites: [] })),
    ])
      .then(([authorsRes, invitesRes]) => {
        setAuthors(authorsRes.authors ?? []);
        const map: Record<string, string> = {};
        for (const inv of (invitesRes.invites ?? []) as InviteLite[]) {
          const key = inv.email.toLowerCase();
          if (!map[key]) map[key] = inv.status;
        }
        setInviteByEmail(map);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

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
      await fetch("/api/admin/authors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, role }),
      });
      setAuthors(prev => prev.map(a => a.id === id ? { ...a, role: role as Author["role"] } : a));
      if (selectedAuthor?.id === id) setSelectedAuthor(prev => prev ? { ...prev, role: role as Author["role"] } : null);
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
        load();
        setTimeout(() => {
          setShowInvite(false);
          setInviteEmail(""); setInviteName(""); setInviteNote(""); setInviteSent(false);
        }, 1800);
      }
    } finally { setSendingInvite(false); }
  };

  const authorOnly = authors.filter(a => a.role === "AUTHOR");
  const statusFilter = TAB_INVITE_STATUS[tab];
  const matchesStatus = (a: Author, status: string | null) => {
    if (!status) return true;
    return inviteByEmail[a.email.toLowerCase()] === status;
  };
  const searchQ = search.toLowerCase().trim();
  const filtered = authorOnly
    .filter(a => matchesStatus(a, statusFilter))
    .filter(a =>
      !searchQ ||
      a.name.toLowerCase().includes(searchQ) ||
      a.handle.toLowerCase().includes(searchQ) ||
      a.email.toLowerCase().includes(searchQ)
    );
  const counts = TAB_INVITE_STATUS.map((s, i) =>
    i === 0 ? authorOnly.length : authorOnly.filter(a => matchesStatus(a, s)).length
  );

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      {/* Top bar */}
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
        <p className="text-xs text-[#a3a3a3] flex-1 min-w-0">{authorOnly.length} authors</p>
        <button
          onClick={() => { setShowInvite(true); setInviteError(null); setInviteSent(false); }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F44444] text-white text-sm font-medium hover:bg-[#E03333] transition-colors flex-shrink-0"
        >
          <UserPlus className="w-3.5 h-3.5" />
          Invite
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-5">
        <AdminPillTabs
          tabs={TABS.map((t, i) => counts[i] > 0 ? `${t} (${counts[i]})` : t)}
          activeTab={tab}
          onTabChange={setTab}
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
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-[#e5e5e5] bg-white px-5 py-12 text-center">
          <p className="text-sm text-[#a3a3a3]">
            {searchQ ? "No authors match your search." :
              statusFilter === "accepted" ? "No users from accepted invitations yet." :
              statusFilter === "pending" ? "No users with pending invitations." :
              statusFilter === "revoked" ? "No users with rejected invitations." :
              "No authors yet."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
          {filtered.map((author, i) => (
            <div
              key={author.id}
              onClick={() => selectAuthor(author)}
              className={`flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-[#fafafa] transition-colors ${i < filtered.length - 1 ? "border-b border-[#f5f5f5]" : ""} ${selectedAuthor?.id === author.id ? "bg-[#fafafa]" : ""}`}
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
                            { value: "AUTHOR", label: "Author", description: "Author", badge: { label: "Author", color: "#8B5CF6", bg: "#F5F3FF" } },
                            { value: "CIRCLE", label: "Circle", description: "Circle", badge: { label: "Circle", color: "#F44444", bg: "#FFF0F0" } },
                            { value: "ADMIN", label: "Admin", description: "Admin", badge: { label: "Admin", color: "#0a0a0a", bg: "#f0f0f0" } },
                            { value: "NORMAL", label: "Normal", description: "Normal", badge: { label: "Normal", color: "#525252", bg: "#f5f5f5" } },
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
    </div>
  );
}
