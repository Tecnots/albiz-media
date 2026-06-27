"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Eye, Trash2, Loader2, PenLine,
  AlertCircle, ChevronRight,
} from "lucide-react";
import { useAuthorContext } from "../layout";

interface EditorNote {
  id: number;
  note: string;
  type: string;
  priority: string;
  resolvedAt: string | null;
  createdAt: string;
  editor: { id: number; name: string; avatar: string };
}

const NOTE_TYPE_COLORS: Record<string, { color: string; bg: string; label: string }> = {
  general:   { color: "#525252", bg: "#f5f5f5",  label: "General"   },
  factual:   { color: "#D97706", bg: "#FFFBEB",  label: "Factual"   },
  style:     { color: "#8B5CF6", bg: "#F5F3FF",  label: "Style"     },
  grammar:   { color: "#0EA5E9", bg: "#F0F9FF",  label: "Grammar"   },
  structure: { color: "#F44444", bg: "#FFF5F5",  label: "Structure" },
};

interface Article {
  id: number;
  title: string | null;
  description?: string | null;
  status: string | null;
  date: string;
  image: string | null;
  tags: string[];
  stats: { views: string; likes: string; comments: string; shares: string };
  articleContent?: { paragraphs: string[] } | null;
  editorNotes?: EditorNote[];
}

const WORKFLOW = [
  { key: "draft",              label: "Draft",        color: "#525252" },
  { key: "submitted",          label: "Submitted",    color: "#3B82F6" },
  { key: "under_review",       label: "Under Review", color: "#F59E0B" },
  { key: "revision_requested", label: "Revision",     color: "#F44444" },
  { key: "approved",           label: "Approved",     color: "#22c55e" },
  { key: "scheduled",          label: "Scheduled",    color: "#6366F1" },
  { key: "published",          label: "Published",    color: "#22c55e" },
];

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  draft:              { bg: "#f5f5f5",   text: "#525252" },
  submitted:          { bg: "#EFF6FF",   text: "#3B82F6" },
  under_review:       { bg: "#FFFBEB",   text: "#F59E0B" },
  revision_requested: { bg: "#FFF5F5",   text: "#F44444" },
  approved:           { bg: "#F0FDF4",   text: "#22c55e" },
  scheduled:          { bg: "#EEF2FF",   text: "#6366F1" },
  published:          { bg: "#F0FDF4",   text: "#22c55e" },
};

function StatusBadge({ status }: { status: string | null }) {
  const s = status ?? "draft";
  const c = STATUS_COLOR[s] ?? STATUS_COLOR.draft;
  const label = s.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
      style={{ backgroundColor: c.bg, color: c.text }}>
      {label}
    </span>
  );
}

const QUEUE_FILTERS = ["All", "Draft", "Submitted", "Under Review", "Revision Req.", "Scheduled"];
const QUEUE_STATUS_MAP: (string | null)[] = [null, "draft", "submitted", "under_review", "revision_requested", "scheduled"];

export default function MyArticlesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthorContext();
  const [tab, setTab] = useState(0); // 0 = queue, 1 = published
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [queueFilter, setQueueFilter] = useState(0);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [resolvingNote, setResolvingNote] = useState<number | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    fetch(`/api/posts?userId=${user.id}&status=all`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setArticles(Array.isArray(data) ? data.filter((a: Article) => a.title) : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);

  const updateStatus = async (id: number, status: string) => {
    setSubmitting(id);
    try {
      await fetch("/api/posts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: id, status }),
      });
      setArticles(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    } finally {
      setSubmitting(null);
    }
  };

  const resolveNote = async (articleId: number, noteId: number, resolved: boolean) => {
    setResolvingNote(noteId);
    try {
      const res = await fetch(`/api/editor/article/${articleId}/note/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved }),
      });
      const data = await res.json();
      if (!res.ok) return;
      setArticles(prev => prev.map(a =>
        a.id === articleId
          ? {
              ...a,
              editorNotes: a.editorNotes?.map(n =>
                n.id === noteId ? { ...n, resolvedAt: data.note.resolvedAt } : n
              ),
            }
          : a
      ));
    } finally {
      setResolvingNote(null);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleting(id);
    try {
      const res = await fetch("/api/posts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: id }),
      });
      if (res.ok) setArticles(prev => prev.filter(a => a.id !== id));
    } finally {
      setDeleting(null);
      setDeleteConfirm(null);
    }
  };

  const queue = articles.filter(a => a.status !== "published" && a.status !== null);
  const published = articles.filter(a => a.status === "published");

  const statusFilter = QUEUE_STATUS_MAP[queueFilter];
  const filteredQueue = queue.filter(a =>
    statusFilter === null ? true : a.status === statusFilter
  );

  const queueCounts = QUEUE_STATUS_MAP.map((s, i) =>
    i === 0 ? queue.length : queue.filter(a => a.status === s).length
  );

  if (authLoading) return null;

  return (
    <div className="p-6 lg:p-8 max-w-[1100px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-xs text-[#a3a3a3]">
          {articles.length} articles · {published.length} published
        </p>
        <button
          onClick={() => router.push("/authors/create")}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors"
        >
          <PenLine className="w-3.5 h-3.5" />
          Write article
        </button>
      </div>

      {/* Main tabs */}
      <div className="flex gap-1 mb-6">
        {["My Queue", "Published"].map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === i
                ? "bg-[#F44444] text-white"
                : "text-[#737373] hover:text-[#0a0a0a] hover:bg-[#f5f5f5]"
            }`}
          >
            {t}
            {i === 0 && queue.length > 0 && (
              <span className={`ml-1.5 text-[10px] ${tab === 0 ? "text-white/70" : "text-[#a3a3a3]"}`}>
                {queue.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 text-[#a3a3a3] animate-spin" />
        </div>
      ) : tab === 0 ? (
        // ── Queue Tab ──
        <div>
          {/* Workflow diagram */}
          <div className="rounded-xl border border-[#e5e5e5] bg-white p-4 mb-4">
            <div className="flex items-center gap-1">
              {WORKFLOW.map((step, i, arr) => (
                <div key={step.key} className="flex items-center gap-1 flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                      style={{ backgroundColor: step.color }}
                    >
                      {i + 1}
                    </div>
                    <span className="text-[10px] text-[#737373] mt-1 text-center">{step.label}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <ChevronRight className="w-4 h-4 text-[#d5d5d5] flex-shrink-0 mt-[-14px]" />
                  )}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-[#a3a3a3] text-center mt-2">
              Articles you submit flow through this pipeline. Admins review and publish approved articles.
            </p>
          </div>

          {/* Queue filter pills */}
          <div className="flex gap-1 mb-4 flex-wrap">
            {QUEUE_FILTERS.map((f, i) => (
              <button
                key={f}
                onClick={() => setQueueFilter(i)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  queueFilter === i
                    ? "bg-[#0a0a0a] text-white"
                    : "text-[#737373] border border-[#e5e5e5] hover:border-[#d5d5d5] hover:text-[#0a0a0a]"
                }`}
              >
                {f}{queueCounts[i] > 0 ? ` (${queueCounts[i]})` : ""}
              </button>
            ))}
          </div>

          {/* Queue empty */}
          {filteredQueue.length === 0 ? (
            <div className="rounded-xl border border-[#e5e5e5] bg-white px-5 py-14 text-center">
              <p className="text-sm font-medium text-[#0a0a0a] mb-1">Queue is empty</p>
              <p className="text-xs text-[#a3a3a3] mb-5">
                Articles you save or submit for review will appear here.
              </p>
              <button
                onClick={() => router.push("/authors/create")}
                className="text-sm text-[#F44444] font-medium hover:text-[#d64d3c] transition-colors"
              >
                Write your first article
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredQueue.map((article, idx) => (
                <div key={article.id} className="rounded-xl border border-[#e5e5e5] bg-white p-4 hover:border-[#d5d5d5] transition-colors">
                  <div className="flex items-start gap-4">
                    {article.image && (
                      <div className="w-20 h-14 rounded-lg overflow-hidden flex-shrink-0 hidden sm:block bg-[#f5f5f5]">
                        <Image src={article.image} alt={article.title ?? ""} width={80} height={56} sizes="80px" quality={80} priority={idx < 4} className="object-cover w-full h-full" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-sm font-medium text-[#0a0a0a] truncate">{article.title}</p>
                        <StatusBadge status={article.status} />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#737373] mb-2 flex-wrap">
                        <span>{article.date}</span>
                        {article.articleContent?.paragraphs?.[0] && (
                          <>
                            <span className="text-[#e5e5e5]">·</span>
                            <span>
                              {Math.max(1, Math.ceil(
                                article.articleContent.paragraphs[0].replace(/<[^>]*>/g, " ").trim().split(/\s+/).filter(Boolean).length / 200
                              ))} min read
                            </span>
                          </>
                        )}
                      </div>

                      {/* Editor notes */}
                      {article.status === "revision_requested" && article.editorNotes && article.editorNotes.length > 0 && (
                        <div className="mb-2 space-y-1.5">
                          {article.editorNotes.map(n => {
                            const nt = NOTE_TYPE_COLORS[n.type] ?? NOTE_TYPE_COLORS.general;
                            const isResolved = !!n.resolvedAt;
                            return (
                              <div
                                key={n.id}
                                className={`px-3 py-2 rounded-lg border flex items-start gap-2 transition-all ${
                                  isResolved
                                    ? "border-[#e5e5e5] bg-[#fafafa] opacity-60"
                                    : n.priority === "major"
                                      ? "border-[#FFD4D4] bg-[#FFF5F5] border-l-2 border-l-[#F44444]"
                                      : "border-[#FFD4D4] bg-[#FFF5F5]"
                                }`}
                              >
                                <AlertCircle className="w-3 h-3 text-[#F44444] flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                    <span className="text-[10px] font-medium text-[#F44444]">{n.editor.name}</span>
                                    <span
                                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                                      style={{ background: nt.bg, color: nt.color }}
                                    >
                                      {nt.label}
                                    </span>
                                    {n.priority === "major" && (
                                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#FFF5F5] text-[#F44444]">Major</span>
                                    )}
                                    {isResolved && (
                                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#F0FDF4] text-[#16a34a]">Resolved</span>
                                    )}
                                  </div>
                                  <p className={`text-xs text-[#F44444] leading-relaxed ${isResolved ? "line-through opacity-70" : ""}`}>{n.note}</p>
                                </div>
                                <button
                                  onClick={() => resolveNote(article.id, n.id, !isResolved)}
                                  disabled={resolvingNote === n.id}
                                  className={`flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-md transition-colors self-start ${
                                    isResolved
                                      ? "text-[#a3a3a3] hover:text-[#525252]"
                                      : "text-[#16a34a] bg-[#F0FDF4] hover:bg-[#dcfce7]"
                                  }`}
                                >
                                  {resolvingNote === n.id
                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                    : isResolved ? "Undo" : "Resolved"
                                  }
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {article.status === "revision_requested" && (!article.editorNotes || article.editorNotes.length === 0) && (
                        <div className="px-3 py-2 rounded-lg bg-[#FFF5F5] border border-[#FFD4D4] mb-2 flex items-start gap-2">
                          <AlertCircle className="w-3.5 h-3.5 text-[#F44444] flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-[#F44444]">Revision requested — open the article to review and resubmit.</p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {article.status === "draft" && (
                        <>
                          <button
                            onClick={() => updateStatus(article.id, "submitted")}
                            disabled={submitting === article.id}
                            className="px-3 py-1.5 text-xs font-medium rounded-full bg-[#3B82F6] text-white hover:bg-[#2563EB] transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            {submitting === article.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : "Submit for Review"
                            }
                          </button>
                          <button
                            onClick={() => router.push(`/authors/create?edit=${article.id}`)}
                            className="px-3 py-1.5 text-xs font-medium rounded-full border border-[#e5e5e5] text-[#525252] hover:bg-[#fafafa] transition-colors"
                          >
                            Edit
                          </button>
                        </>
                      )}
                      {article.status === "submitted" && (
                        <span className="text-xs text-[#a3a3a3]">Awaiting review…</span>
                      )}
                      {article.status === "under_review" && (
                        <span className="text-xs text-[#a3a3a3]">Under review…</span>
                      )}
                      {article.status === "revision_requested" && (
                        <button
                          onClick={() => router.push(`/authors/create?edit=${article.id}`)}
                          className="px-3 py-1.5 text-xs font-medium rounded-full bg-[#F59E0B] text-white hover:bg-[#D97706] transition-colors"
                        >
                          Edit &amp; Resubmit
                        </button>
                      )}
                      {article.status === "approved" && (
                        <span className="text-xs text-[#22c55e] font-medium">Approved — pending publish</span>
                      )}
                      {article.status === "scheduled" && (
                        <span className="text-xs text-[#6366F1] font-medium">Scheduled for publication</span>
                      )}

                      {/* Delete */}
                      {deleteConfirm === article.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(article.id)}
                            disabled={deleting === article.id}
                            className="px-2.5 py-1 rounded-lg bg-[#F44444] text-white text-xs font-medium hover:bg-[#d64d3c] transition-colors disabled:opacity-50"
                          >
                            {deleting === article.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Delete"}
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-2.5 py-1 rounded-lg border border-[#e5e5e5] text-[#525252] text-xs hover:bg-[#fafafa] transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(article.id)}
                          className="p-1.5 rounded-lg text-[#d0d0d0] hover:text-[#F44444] hover:bg-[#FFF5F5] transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        // ── Published Tab ──
        <div>
          {published.length === 0 ? (
            <div className="rounded-xl border border-[#e5e5e5] bg-white px-5 py-14 text-center">
              <p className="text-sm font-medium text-[#0a0a0a] mb-1">No published articles yet</p>
              <p className="text-xs text-[#a3a3a3] mb-5">
                Once an article is approved and published, it will appear here.
              </p>
              <button
                onClick={() => router.push("/authors/create")}
                className="text-sm text-[#F44444] font-medium hover:text-[#d64d3c] transition-colors"
              >
                Write your first article
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {published.map((article, idx) => (
                <div key={article.id} className="rounded-xl border border-[#e5e5e5] bg-white hover:border-[#d5d5d5] transition-colors">
                  <div className="flex items-center gap-4 p-3.5">
                    <button
                      type="button"
                      onClick={() => router.push(`/authors/create?edit=${article.id}`)}
                      className="flex items-center gap-4 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                    >
                      {article.image && (
                        <div className="w-24 h-16 rounded-lg overflow-hidden flex-shrink-0 hidden sm:block bg-[#f5f5f5]">
                          <Image src={article.image} alt={article.title ?? ""} width={96} height={64} sizes="96px" quality={80} priority={idx < 5} className="object-cover w-full h-full" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#0a0a0a] truncate mb-1">{article.title}</p>
                        <div className="flex items-center gap-2 text-xs text-[#a3a3a3]">
                          <span>{article.date}</span>
                          {article.stats?.views !== "0" && (
                            <>
                              <span className="text-[#e5e5e5]">·</span>
                              <span>{article.stats?.views} views</span>
                            </>
                          )}
                          {article.tags?.slice(0, 2).map(tag => (
                            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-[#f5f5f5] text-[#737373]">{tag}</span>
                          ))}
                        </div>
                      </div>
                    </button>

                    <StatusBadge status={article.status} />

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <a
                        href={`/article/${article.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-[#a3a3a3] hover:text-[#525252] hover:bg-[#f5f5f5] transition-colors"
                        title="View live"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => router.push(`/authors/create?edit=${article.id}`)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#525252] hover:bg-[#f5f5f5] transition-colors"
                      >
                        Edit
                      </button>

                      {deleteConfirm === article.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(article.id)}
                            disabled={deleting === article.id}
                            className="px-2.5 py-1 rounded-lg bg-[#F44444] text-white text-xs font-medium hover:bg-[#d64d3c] transition-colors disabled:opacity-50"
                          >
                            {deleting === article.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Delete"}
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-2.5 py-1 rounded-lg border border-[#e5e5e5] text-[#525252] text-xs hover:bg-[#fafafa] transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(article.id)}
                          className="p-1.5 rounded-lg text-[#d0d0d0] hover:text-[#F44444] hover:bg-[#FFF5F5] transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
