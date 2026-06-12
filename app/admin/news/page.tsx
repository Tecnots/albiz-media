"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye, EyeOff, ArrowLeft, ImagePlus, MoreVertical,
  Hash, Plus,
  Mail, Check, X, Send, MessageCircle, ChevronRight,
  FileText, AlertCircle, RotateCcw, Loader2,
} from "lucide-react";
import { AdminPillTabs, StatusBadge, UserAvatar, AdminModal, Dropdown } from "../admin-components";
import { RichEditor } from "./RichEditor";
import { generateAdminNews } from "../admin-data";
import type { ArticleWorkflowStatus } from "../admin-data";

const workflowSteps: { key: ArticleWorkflowStatus; label: string; color: string }[] = [
  { key: "draft", label: "Draft", color: "#525252" },
  { key: "submitted", label: "Submitted", color: "#3B82F6" },
  { key: "under_review", label: "Under Review", color: "#F59E0B" },
  { key: "revision_requested", label: "Revision Requested", color: "#F44444" },
  { key: "approved", label: "Approved", color: "#22c55e" },
  { key: "published", label: "Published", color: "#22c55e" },
];

function WorkflowBadge({ status }: { status: ArticleWorkflowStatus }) {
  const step = workflowSteps.find(s => s.key === status);
  const label = status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
      style={{ backgroundColor: `${step?.color || "#525252"}15`, color: step?.color || "#525252" }}
    >
      {label}
    </span>
  );
}

// ─── Authors Tab (redirects to dedicated Authors page) ───
type AuthorItem = { id: number; name: string; email: string; avatar: string; role: string; org: string; status: "active" | "invited" | "inactive"; articles: number; published: number; joinedDate: string; bio: string; };

function AuthorsTab() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-sm font-medium text-[#0a0a0a] mb-1">Authors are now managed in a dedicated page</p>
      <p className="text-xs text-[#a3a3a3] mb-5">View profiles, manage roles, and track article counts for all users.</p>
      <Link href="/admin/authors" className="px-4 py-2 rounded-xl bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer">
        Go to Authors
      </Link>
    </div>
  );
}

// ─── Editorial Queue Tab ───
function EditorialQueueTab() {
   
  const [queue, setQueue] = useState<any[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [filter, setFilter] = useState(0);
  const [selectedArticle, setSelectedArticle] = useState<typeof queue[0] | null>(null);
  const [revisionNote, setRevisionNote] = useState("");

  const loadQueue = () => {
    setLoadingQueue(true);
    // Fetch all non-published articles
    fetch("/api/posts?status=all")
      .then(r => r.ok ? r.json() : [])
      .then((data: any[]) => {
        const articles = Array.isArray(data) ? data : [];
        // Map to queue format, exclude published posts and posts without title
        const items = articles
          .filter((p: any) => p.title && p.type === "article" && p.status !== "published")
          .map((p: any) => ({
            id: p.id,
            title: p.title,
            authorId: 13,
            authorName: "Admin",
            authorAvatar: "https://picsum.photos/seed/jessinsam/200",
            image: p.image ?? null,
            status: (p.status ?? "draft") as ArticleWorkflowStatus,
            submittedAt: p.date ?? "—",
            wordCount: p.content ? p.content.replace(/<[^>]*>/g, " ").trim().split(/\s+/).filter(Boolean).length : 0,
            tags: p.tags ?? [],
            reviewer: null,
            revisionNote: null,
            dbId: p.id,
          }));
        setQueue(items);
      })
      .catch(() => {})
      .finally(() => setLoadingQueue(false));
  };

  useEffect(() => { loadQueue(); }, []);

  const filterTabs = ["All", "Submitted", "Under Review", "Revision Req.", "Approved"];

  const statusMap: Record<number, ArticleWorkflowStatus | "all"> = {
    0: "all", 1: "submitted", 2: "under_review", 3: "revision_requested", 4: "approved",
  };

  const filtered = queue.filter(a => {
    const f = statusMap[filter];
    if (f === "all") return a.status !== "published";
    return a.status === f;
  });

  const updateStatus = async (id: number, status: string, extra?: Record<string, unknown>) => {
    await fetch("/api/posts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: id, status }),
    }).catch(() => {});
    setQueue(prev => prev.map(a => a.id === id ? { ...a, status, ...extra } : a));
  };

  const moveToReview = (id: number) => updateStatus(id, "under_review", { reviewer: "Admin" });
  const approve = (id: number) => { updateStatus(id, "approved"); setSelectedArticle(null); };
  const reject = (id: number) => { updateStatus(id, "rejected"); setSelectedArticle(null); };
  const skipToPublish = (id: number) => updateStatus(id, "published");

  const publish = (id: number) => {
    updateStatus(id, "published");
    setQueue(prev => prev.filter(a => a.id !== id)); // remove from queue once published
    setSelectedArticle(null);
  };

  const requestRevision = (id: number) => {
    if (!revisionNote.trim()) return;
    updateStatus(id, "revision_requested", { revisionNote });
    setRevisionNote("");
    setSelectedArticle(null);
  };

  return (
    <div>
      <div className="mb-4">
        <AdminPillTabs tabs={filterTabs} activeTab={filter} onTabChange={setFilter} />
      </div>

      {/* Workflow diagram */}
      <div className="rounded-xl border border-[#e5e5e5] bg-white p-4 mb-4">
        <div className="flex items-center justify-between gap-1">
          {workflowSteps.filter(s => s.key !== "revision_requested").map((step, i, arr) => (
            <div key={step.key} className="flex items-center gap-1 flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold" style={{ backgroundColor: step.color }}>
                  {i + 1}
                </div>
                <span className="text-[10px] text-[#737373] mt-1 text-center">{step.label}</span>
              </div>
              {i < arr.length - 1 && <ChevronRight className="w-4 h-4 text-[#d5d5d5] flex-shrink-0 mt-[-14px]" />}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-[#a3a3a3] text-center mt-2">Articles flow through this pipeline. Admins can skip steps at any point.</p>
      </div>

      {/* Queue list */}
      {loadingQueue ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-[#a3a3a3] animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-[#e5e5e5] bg-white px-5 py-12 text-center">
          <p className="text-sm font-medium text-[#0a0a0a] mb-1">Queue is empty</p>
          <p className="text-xs text-[#a3a3a3]">Articles saved as draft or submitted for review will appear here.</p>
        </div>
      ) : null}
      <div className="space-y-2">
        {filtered.map((article, idx) => (
          <div key={article.id} className="rounded-xl border border-[#e5e5e5] bg-white p-4 hover:border-[#d5d5d5] transition-colors">
            <div className="flex items-start gap-4">
              {"image" in article && (article as typeof article & { image?: string }).image && (
                <div className="w-20 h-14 rounded-lg overflow-hidden flex-shrink-0 hidden md:block bg-[#f5f5f5]">
                  <Image src={(article as typeof article & { image: string }).image} alt={article.title} width={80} height={56} sizes="80px" quality={80} priority={idx < 4} className="object-cover w-full h-full" />
                </div>
              )}
              <UserAvatar src={article.authorAvatar} alt={article.authorName} size={40} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-sm text-[#0a0a0a] truncate">{article.title}</h3>
                  <WorkflowBadge status={article.status} />
                </div>
                <div className="flex items-center gap-2 text-xs text-[#737373] mb-2">
                  <span>{article.authorName}</span>
                  <span className="text-[#e5e5e5]">|</span>
                  <span>{article.submittedAt}</span>
                  <span className="text-[#e5e5e5]">|</span>
                  <span>{article.wordCount} words</span>
                  {article.reviewer && (
                    <>
                      <span className="text-[#e5e5e5]">|</span>
                      <span className="text-[#F59E0B]">Reviewing: {article.reviewer}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mb-2">
                  {article.tags.map((tag: string) => (
                    <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#f5f5f5] text-[#525252]">{tag}</span>
                  ))}
                </div>
                {article.revisionNote && article.status === "revision_requested" && (
                  <div className="px-3 py-2 rounded-lg bg-[#FFF5F5] border border-[#FFD4D4] mb-2">
                    <span className="text-xs text-[#F44444] flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {article.revisionNote}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Action buttons based on status */}
                {article.status === "submitted" && (
                  <>
                    <button onClick={() => moveToReview(article.id)} className="px-3 py-1.5 text-xs font-medium rounded-full bg-[#F59E0B] text-white hover:bg-[#D97706] transition-colors">
                      Start Review
                    </button>
                    <button onClick={() => skipToPublish(article.id)} className="px-3 py-1.5 text-xs font-medium rounded-full border border-[#e5e5e5] text-[#525252] hover:bg-[#fafafa] transition-colors">
                      Skip to Publish
                    </button>
                  </>
                )}
                {article.status === "under_review" && (
                  <>
                    <button onClick={() => approve(article.id)} className="px-3 py-1.5 text-xs font-medium rounded-full bg-[#22c55e] text-white hover:bg-[#16a34a] transition-colors flex items-center gap-1">
                      <Check className="w-3 h-3" /> Approve
                    </button>
                    <button onClick={() => { setSelectedArticle(article); setRevisionNote(article.revisionNote || ""); }} className="px-3 py-1.5 text-xs font-medium rounded-full bg-[#F59E0B] text-white hover:bg-[#D97706] transition-colors flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" /> Revision
                    </button>
                    <button onClick={() => reject(article.id)} className="px-3 py-1.5 text-xs font-medium rounded-full text-[#F44444] hover:bg-[#FFF5F5] transition-colors">
                      Reject
                    </button>
                  </>
                )}
                {article.status === "approved" && (
                  <button onClick={() => publish(article.id)} className="px-3 py-1.5 text-xs font-medium rounded-full bg-[#F44444] text-white hover:bg-[#d64d3c] transition-colors flex items-center gap-1">
                    Publish Now
                  </button>
                )}
                {article.status === "revision_requested" && (
                  <span className="text-xs text-[#a3a3a3]">Waiting for author...</span>
                )}
                {article.status === "draft" && (
                  <span className="text-xs text-[#a3a3a3]">Author is writing...</span>
                )}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="rounded-xl border border-[#e5e5e5] bg-white px-5 py-12 text-center">
            <p className="text-sm text-[#737373]">No articles in this stage.</p>
          </div>
        )}
      </div>

      {/* Revision Request Modal */}
      <AdminModal isOpen={!!selectedArticle} onClose={() => setSelectedArticle(null)} title="Request Revision">
        {selectedArticle && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <UserAvatar src={selectedArticle.authorAvatar} alt={selectedArticle.authorName} size={36} />
              <div>
                <span className="text-sm font-medium text-[#0a0a0a] block">{selectedArticle.title}</span>
                <span className="text-xs text-[#737373]">by {selectedArticle.authorName}</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[#525252] block mb-1.5">Revision Notes</label>
              <textarea
                value={revisionNote}
                onChange={e => setRevisionNote(e.target.value)}
                placeholder="Describe what changes the author needs to make..."
                className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all resize-none min-h-[100px]"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setSelectedArticle(null)} className="px-4 py-2 rounded-full border border-[#e5e5e5] text-[#525252] text-sm font-medium hover:bg-[#fafafa] transition-colors cursor-pointer">Cancel</button>
              <button onClick={() => requestRevision(selectedArticle.id)} className="px-5 py-2 rounded-full bg-[#F59E0B] text-white text-sm font-medium hover:bg-[#D97706] transition-colors cursor-pointer flex items-center gap-2">
                <RotateCcw className="w-4 h-4" /> Send Revision Request
              </button>
            </div>
          </div>
        )}
      </AdminModal>
    </div>
  );
}

// ─── Published Articles Tab (DB only) ────────────────────────────────────────

interface DBArticle {
  id: number;
  title: string | null;
  description?: string | null;
  status: string;
  date: string;
  views: string;
  image: string | null;
  tags: string[];
  slug?: string | null;
  seoDescription?: string | null;
  sectionId?: number | null;
  sectionName?: string | null;
  sectionColor?: string | null;
  language?: string | null;
  articleContent?: { paragraphs: string[] } | null;
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
      .then((data: DBArticle[]) => {
        const articles = Array.isArray(data) ? data : [];
        setArticles(articles.filter((p: DBArticle) => p.title));
      })
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
          <p className="text-xs text-[#a3a3a3]">Write and publish your first article using the editor above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((article, idx) => (
            <div key={article.id} className="rounded-xl border border-[#e5e5e5] bg-white hover:border-[#d5d5d5] transition-colors">
              <div className="flex items-center gap-4 p-3.5">
                {/* Clickable thumbnail + title area → opens editor */}
                <button
                  type="button"
                  onClick={() => confirmDelete === null ? onEdit(article) : undefined}
                  className="flex items-center gap-4 flex-1 min-w-0 text-left cursor-pointer hover:opacity-80 transition-opacity"
                >
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
                      className="px-2.5 py-1 rounded-lg bg-[#F44444] text-white text-xs font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer disabled:opacity-50">
                      {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Yes"}
                    </button>
                    <button onClick={() => setConfirmDelete(null)}
                      className="px-2.5 py-1 rounded-lg border border-[#e5e5e5] text-[#525252] text-xs font-medium hover:bg-[#fafafa] transition-colors cursor-pointer">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setPreviewArticle(article)}
                      title="Preview"
                      className="p-1.5 rounded-lg text-[#a3a3a3] hover:text-[#525252] hover:bg-[#f5f5f5] transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onEdit(article)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#525252] hover:bg-[#f5f5f5] transition-colors cursor-pointer">
                      Edit
                    </button>

                    {/* Three-dot menu */}
                    <div className="relative">
                      <button
                        onClick={() => setMenuOpen(menuOpen === article.id ? null : article.id)}
                        className="p-1.5 rounded-lg text-[#a3a3a3] hover:text-[#525252] hover:bg-[#f5f5f5] transition-colors cursor-pointer"
                      >
                        {statusChanging === article.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <MoreVertical className="w-3.5 h-3.5" />}
                      </button>
                      {menuOpen === article.id && (
                        <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-[#e5e5e5] rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden z-20">
                          {article.status === "published" ? (
                            <button
                              onClick={() => handleStatusChange(article.id, "draft")}
                              className="w-full text-left px-3.5 py-2.5 text-xs text-[#525252] hover:bg-[#fafafa] transition-colors cursor-pointer flex items-center gap-2"
                            >
                              <EyeOff className="w-3.5 h-3.5 text-[#a3a3a3]" />
                              Unpublish
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStatusChange(article.id, "published")}
                              className="w-full text-left px-3.5 py-2.5 text-xs text-[#22c55e] font-medium hover:bg-[#F0FDF4] transition-colors cursor-pointer flex items-center gap-2"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Publish
                            </button>
                          )}
                          <div className="border-t border-[#f5f5f5]" />
                          <button
                            onClick={() => { setMenuOpen(null); setConfirmDelete(article.id); }}
                            className="w-full text-left px-3.5 py-2.5 text-xs text-[#F44444] hover:bg-[#FFF5F5] transition-colors cursor-pointer flex items-center gap-2"
                          >
                            <X className="w-3.5 h-3.5" />
                            Delete
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

      {/* ─── Inline preview slide-over ─── */}
      <AnimatePresence>
        {previewArticle && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[150] bg-black/30 backdrop-blur-sm"
              onClick={() => setPreviewArticle(null)}
            />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="fixed right-0 top-0 bottom-0 z-[151] w-full max-w-2xl bg-white shadow-2xl overflow-y-auto"
            >
              <div className="sticky top-0 bg-white border-b border-[#f0f0f0] px-6 py-3 flex items-center justify-between z-10">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[#737373]" />
                  <span className="text-sm font-medium text-[#0a0a0a]">Preview</span>
                  <span className="text-xs text-[#a3a3a3]">— how readers see it</span>
                </div>
                <button onClick={() => setPreviewArticle(null)} className="p-1.5 hover:bg-[#f5f5f5] rounded-lg cursor-pointer">
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

                <h1 className="text-3xl font-bold text-[#0a0a0a] leading-tight mb-3">
                  {previewArticle.title ?? "Untitled"}
                </h1>

                {previewArticle.description && (
                  <p className="text-lg text-[#525252] leading-relaxed mb-6">{previewArticle.description}</p>
                )}

                <div className="flex items-center gap-2 mb-6 pb-6 border-b border-[#f0f0f0] text-xs text-[#a3a3a3]">
                  <span>{previewArticle.date}</span>
                  {previewArticle.sectionName && (
                    <>
                      <span>·</span>
                      <span style={{ color: previewArticle.sectionColor ?? "#525252" }}>{previewArticle.sectionName}</span>
                    </>
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
                      <div className="ProseMirror text-[#262626] text-base leading-7" dangerouslySetInnerHTML={{ __html: p }} />
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
      {/* Selected tags */}
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

      {/* Input */}
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

// ─── Main Page ───
export default function AdminNews() {
  const [activeTab, setActiveTab] = useState(0);
  const [view, setView] = useState<"list" | "editor">("list");
  const [editingId, setEditingId] = useState<number | null>(null);
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

  useEffect(() => {
    fetch("/api/admin/sections")
      .then(r => r.ok ? r.json() : { sections: [] })
      .then(d => setSections((d.sections ?? []).filter((s: { active: boolean }) => s.active)))
      .catch(() => {});
  }, []);
  const [assignedAuthor, setAssignedAuthor] = useState("");
  const [autoSaveState, setAutoSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

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

  const tabs = ["Editorial Queue", "Authors", "Published", "Write Article"];


  const resetEditor = () => {
    setTitle(""); setSubtitle(""); setContent(""); setTags([]); setCoverImage(""); setLanguage("en");
    setSeoDescription(""); setSlug(""); setScheduledDate(""); setAssignedAuthor(""); setEditingId(null); setSectionId(null);
  };

  const autoSlug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  // Strip HTML tags for word count
  const plainText = content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const wordCount = plainText ? plainText.split(/\s+/).length : 0;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  const [publishing, setPublishing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [publishError, setPublishError] = useState("");

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

  // Unified save — uses PUT when editing an existing post, POST when creating
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
      if (id && !editingId) setEditingId(id); // track new post for subsequent saves
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
      resetEditor(); setView("list"); setActiveTab(2);
    } catch (err: unknown) {
      setPublishError(err instanceof Error ? err.message : "Connection error");
    } finally { setSubmitting(false); }
  };

  // Auto-save every 3s of inactivity while editor is open
  useEffect(() => {
    if (view !== "editor" || !title.trim()) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      setAutoSaveState("saving");
      try {
        // When editing: PUT without changing status. When new: POST as draft.
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

  // ─── EDITOR VIEW ───
  if (view === "editor") {
    return (
      <><div className="min-h-screen bg-white">
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
              <button onClick={handleSaveDraft} disabled={savingDraft} className="px-4 py-2 rounded-full border border-[#e5e5e5] text-[#525252] text-sm font-medium hover:bg-[#fafafa] transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2">
                {savingDraft && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Draft
              </button>
              <button onClick={handleSubmitForReview} disabled={submitting} className="px-4 py-2 rounded-full bg-[#3B82F6] text-white text-sm font-medium hover:bg-[#2563EB] transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2">
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit for Review
              </button>
              <button onClick={handlePublish} disabled={publishing} className="px-4 py-2 rounded-full bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2">
                {publishing && <Loader2 className="w-4 h-4 animate-spin" />}
                Publish
              </button>
            </div>
          </div>
        </div>

        <div className="flex max-w-[1200px] mx-auto">
          <div className="flex-1 min-w-0 px-6 lg:px-12 py-8">
            {/* Cover Image */}
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

          {/* Right Settings Panel */}
          <div className="hidden lg:block w-64 border-l border-[#f0f0f0] flex-shrink-0">
            <div className="p-4 space-y-5 sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto">

              {/* Language */}
              <div>
                <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-2">Language</p>
                <Dropdown
                  value={language}
                  onChange={setLanguage}
                  options={[
                    { value: "en", label: "English" },
                    { value: "hi", label: "Hindi" },
                    { value: "ta", label: "Tamil" },
                    { value: "te", label: "Telugu" },
                    { value: "bn", label: "Bengali" },
                    { value: "mr", label: "Marathi" },
                    { value: "ar", label: "Arabic" },
                    { value: "fr", label: "French" },
                    { value: "de", label: "German" },
                    { value: "es", label: "Spanish" },
                  ]}
                />
              </div>

              {/* Section */}
              <div>
                <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-2">Section</p>
                <Dropdown
                  value={sectionId ? String(sectionId) : ""}
                  onChange={v => setSectionId(v ? Number(v) : null)}
                  placeholder={sections.length ? "No section" : "Add in Settings →"}
                  options={[
                    { value: "", label: "None" },
                    ...sections.map(s => ({
                      value: String(s.id),
                      label: s.name,
                      badge: { label: s.name, color: s.color, bg: s.color + "20" },
                    })),
                  ]}
                />
              </div>

              {/* Assign Author */}
              <div>
                <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-2">Author</p>
                <Dropdown
                  value={assignedAuthor}
                  onChange={setAssignedAuthor}
                  placeholder="Admin (self)"
                  options={[{ value: "", label: "Admin (self)" }]}
                />
              </div>

              {/* Schedule */}
              <div>
                <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-2">Schedule</p>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={e => setScheduledDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#fafafa] border border-[#e5e5e5] text-xs text-[#0a0a0a] outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all cursor-pointer"
                />
              </div>

              {/* Tags */}
              <div>
                <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-2">Tags</p>
                <TagInput tags={tags} onChange={setTags} />
              </div>

              {/* Divider */}
              <div className="border-t border-[#f0f0f0]" />

              {/* SEO */}
              <div className="space-y-3">
                <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider">SEO</p>
                <div>
                  <label className="text-[10px] font-medium text-[#737373] block mb-1.5">URL Slug</label>
                  <input
                    type="text"
                    value={slug}
                    onChange={e => setSlug(e.target.value)}
                    placeholder="article-url-slug"
                    className="w-full px-3 py-2 rounded-lg bg-[#fafafa] border border-[#e5e5e5] text-xs outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all font-mono"
                  />
                  {slug && (
                    <p className="text-[10px] text-[#a3a3a3] mt-1 truncate">/{slug}</p>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-medium text-[#737373] block mb-1.5">Meta description</label>
                  <textarea
                    value={seoDescription}
                    onChange={e => setSeoDescription(e.target.value)}
                    placeholder="For search engines..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-[#fafafa] border border-[#e5e5e5] text-xs outline-none resize-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all"
                  />
                  <span className={`text-[10px] mt-0.5 block ${seoDescription.length > 140 ? "text-[#F44444]" : "text-[#a3a3a3]"}`}>
                    {seoDescription.length}/160
                  </span>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>{/* ─── Preview slide-over ─── */}
      <AnimatePresence>
        {showPreview && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[150] bg-black/40 backdrop-blur-sm"
              onClick={() => setShowPreview(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="fixed right-0 top-0 bottom-0 z-[151] w-full max-w-2xl bg-white shadow-2xl overflow-y-auto"
            >
              {/* Preview header */}
              <div className="sticky top-0 bg-white border-b border-[#f0f0f0] px-6 py-3 flex items-center justify-between z-10">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[#737373]" />
                  <span className="text-sm font-medium text-[#0a0a0a]">Preview</span>
                </div>
                <button onClick={() => setShowPreview(false)} className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors cursor-pointer">
                  <X className="w-4 h-4 text-[#737373]" />
                </button>
              </div>

              {/* Rendered article */}
              <div className="px-8 py-8 max-w-[680px] mx-auto">
                {/* Tags */}
                {tags.length > 0 && (
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    {tags.map(t => (
                      <span key={t} className="text-[11px] font-medium text-[#F44444] uppercase tracking-wide">{t}</span>
                    ))}
                  </div>
                )}

                {/* Title */}
                {title ? (
                  <h1 className="text-3xl font-bold text-[#0a0a0a] leading-tight mb-3">{title}</h1>
                ) : (
                  <div className="h-9 bg-[#f5f5f5] rounded mb-3 w-3/4" />
                )}

                {/* Subtitle */}
                {subtitle && (
                  <p className="text-lg text-[#525252] leading-relaxed mb-6">{subtitle}</p>
                )}

                {/* Author */}
                <div className="flex items-center gap-2 mb-6 pb-6 border-b border-[#f0f0f0]">
                  <div className="w-8 h-8 rounded-full bg-[#F44444]/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-[#F44444]">A</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#0a0a0a]">{assignedAuthor || "Admin"}</p>
                    <p className="text-xs text-[#a3a3a3]">Draft</p>
                  </div>
                </div>

                {/* Cover image */}
                {coverImage && (
                  <div className="rounded-2xl overflow-hidden mb-8 aspect-video relative bg-[#f5f5f5]">
                    <Image src={coverImage} alt={title || "Cover"} fill className="object-cover" sizes="680px" quality={85} />
                  </div>
                )}

                {/* Body */}
                {content && content !== "<p></p>" ? (
                  <div
                    className="ProseMirror text-[#262626] text-base leading-7"
                    dangerouslySetInnerHTML={{ __html: content }}
                  />
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

  // ─── LIST VIEW ───
  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-[#0a0a0a]">News & Editorial</h1>
        <button
          onClick={() => { resetEditor(); setView("editor"); }}
          className="px-4 py-2 rounded-full bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer flex items-center gap-2"
        >
          <FileText className="w-4 h-4" />
          Write Article
        </button>
      </div>

      <div className="mb-6">
        <AdminPillTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {activeTab === 0 && <EditorialQueueTab />}
      {activeTab === 1 && <AuthorsTab />}
      {activeTab === 2 && <PublishedTab onEdit={article => {
        setTitle(article.title ?? "");
        setSubtitle(article.description ?? "");
        setCoverImage(article.image ?? "");
        setTags(article.tags ?? []);
        setSlug(article.slug ?? (article.title ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
        setSeoDescription(article.seoDescription ?? "");
        setSectionId(article.sectionId ?? null);
        setLanguage(article.language ?? "en");
        // Restore rich text body from saved HTML
        setContent(article.articleContent?.paragraphs?.[0] ?? "");
        setEditingId(article.id);
        setView("editor");
      }} />}
      {activeTab === 3 && (() => { setView("editor"); return null; })()}
    </div>
  );
}
