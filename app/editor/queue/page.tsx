"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { InboxIcon, Search } from "lucide-react";

interface Article {
  id: number;
  title: string | null;
  description: string | null;
  image: string | null;
  status: string;
  sectionId: number | null;
  canPublish: boolean;
  wordCount: number;
  unresolvedNotes: number;
  createdAt: string;
  date: string;
  user: { id: number; name: string; avatar: string; handle: string };
  section: { id: number; name: string; color: string } | null;
  editorNotes: { id: number; note: string; createdAt: string; resolvedAt: string | null }[];
}

const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  revision_requested: "Revision requested",
  approved: "Approved",
  published: "Published",
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  submitted: { bg: "#EFF6FF", text: "#3B82F6" },
  under_review: { bg: "#FFFBEB", text: "#D97706" },
  revision_requested: { bg: "#FFF5F5", text: "#F44444" },
  approved: { bg: "#F0FDF4", text: "#16a34a" },
  published: { bg: "#F0FDF4", text: "#16a34a" },
};

const FILTERS = [
  { label: "All", value: "" },
  { label: "Submitted", value: "submitted" },
  { label: "Under review", value: "under_review" },
  { label: "Revision requested", value: "revision_requested" },
  { label: "Approved", value: "approved" },
  { label: "Published", value: "published" },
];

const SORTS = [
  { label: "Newest", value: "newest" },
  { label: "Oldest", value: "oldest" },
  { label: "Most words", value: "words" },
  { label: "Unresolved notes", value: "unresolved" },
];

const GROUPS = [
  { label: "No grouping", value: "none" },
  { label: "By author", value: "author" },
  { label: "By section", value: "section" },
];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ArticleRow({ article }: { article: Article }) {
  const sc = STATUS_COLORS[article.status] ?? STATUS_COLORS.submitted;
  return (
    <Link
      href={`/editor/review/${article.id}`}
      className="flex items-center gap-4 px-5 py-4 rounded-xl border border-[#f0f0f0] bg-white hover:border-[#e5e5e5] hover:shadow-sm transition-all"
    >
      {article.image && (
        <img src={article.image} alt="" className="w-14 h-10 rounded-lg object-cover flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#0a0a0a] truncate">{article.title ?? "Untitled"}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded-full bg-[#f0f0f0] overflow-hidden flex-shrink-0">
              {article.user.avatar ? <img src={article.user.avatar} alt="" className="w-full h-full object-cover" /> : null}
            </div>
            <span className="text-xs text-[#737373]">{article.user.name}</span>
          </div>
          {article.section && (
            <span className="flex items-center gap-1 text-xs text-[#737373]">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: article.section.color }} />
              {article.section.name}
            </span>
          )}
          {article.wordCount > 0 && (
            <span className="text-xs text-[#a3a3a3]">{article.wordCount.toLocaleString()} words</span>
          )}
          {article.unresolvedNotes > 0 && (
            <span className="text-xs text-[#F44444]">{article.unresolvedNotes} open note{article.unresolvedNotes > 1 ? "s" : ""}</span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: sc.bg, color: sc.text }}>
          {STATUS_LABELS[article.status] ?? article.status}
        </span>
        <span className="text-[10px] text-[#a3a3a3]">{timeAgo(article.createdAt)}</span>
      </div>
    </Link>
  );
}

export default function EditorQueue() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [group, setGroup] = useState("none");

  useEffect(() => {
    const url = filter ? `/api/editor/queue?status=${filter}` : "/api/editor/queue";
    setLoading(true);
    fetch(url)
      .then(r => r.ok ? r.json() : { articles: [] })
      .then(d => setArticles(d.articles ?? []))
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, [filter]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = articles.filter(a =>
      !q ||
      (a.title ?? "").toLowerCase().includes(q) ||
      a.user.name.toLowerCase().includes(q)
    );

    list = [...list].sort((a, b) => {
      switch (sort) {
        case "oldest": return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "words": return b.wordCount - a.wordCount;
        case "unresolved": return b.unresolvedNotes - a.unresolvedNotes;
        default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
    return list;
  }, [articles, search, sort]);

  const grouped = useMemo(() => {
    if (group === "none") return null;
    const map = new Map<string, Article[]>();
    for (const a of visible) {
      const key = group === "author" ? a.user.name : (a.section?.name ?? "No section");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return Array.from(map.entries());
  }, [visible, group]);

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              filter === f.value ? "bg-[#0a0a0a] text-white" : "bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#a3a3a3]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search title or author…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-[#fafafa] border border-[#e5e5e5] outline-none focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/10 transition-all"
          />
        </div>
        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg bg-white border border-[#e5e5e5] text-[#525252] outline-none focus:border-[#0EA5E9] cursor-pointer"
        >
          {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select
          value={group}
          onChange={e => setGroup(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg bg-white border border-[#e5e5e5] text-[#525252] outline-none focus:border-[#0EA5E9] cursor-pointer"
        >
          {GROUPS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-[#f5f5f5] animate-pulse" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <InboxIcon className="w-8 h-8 text-[#d4d4d4] mb-3" />
          <p className="text-sm text-[#a3a3a3]">{search.trim() ? "No articles match your search" : "No articles in this view"}</p>
        </div>
      ) : grouped ? (
        <div className="space-y-6">
          {grouped.map(([key, items]) => (
            <div key={key}>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-semibold text-[#525252]">{key}</p>
                <span className="text-[10px] text-[#a3a3a3]">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map(a => <ArticleRow key={a.id} article={a} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map(a => <ArticleRow key={a.id} article={a} />)}
        </div>
      )}
    </div>
  );
}
