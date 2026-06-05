"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, Eye, Heart, Edit, Loader2, FilePen, Check, X, Clock, ChevronRight } from "lucide-react";
import { useAuthorContext } from "./layout";

interface Post {
  id: number;
  title: string | null;
  description: string | null;
  date: string;
  image: string | null;
  status: string | null;
  stats: { views: string; likes: string; comments: string; shares: string };
}

interface Suggestion {
  id: number;
  title: string;
  description: string | null;
  deadline: string | null;
  status: string;
  createdAt: string;
  admin: { id: number; name: string; avatar: string };
}

const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-[#FFF8E6] text-[#B45309]",
  accepted:  "bg-[#F0FDF4] text-[#15803D]",
  completed: "bg-[#F5F3FF] text-[#7C3AED]",
  dismissed: "bg-[#f5f5f5] text-[#a3a3a3]",
};

export default function AuthorDashboard() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthorContext();

  const [posts, setPosts] = useState<Post[]>([]);
  const [drafts, setDrafts] = useState<Post[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [responding, setResponding] = useState<number | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    Promise.all([
      fetch(`/api/posts?userId=${user.id}`).then(r => r.ok ? r.json() : []),
      fetch(`/api/posts?status=drafts&userId=${user.id}`).then(r => r.ok ? r.json() : []),
      fetch("/api/author/suggestions").then(r => r.ok ? r.json() : []),
    ])
      .then(([pub, drft, sugg]) => {
        setPosts(Array.isArray(pub) ? pub : []);
        setDrafts(Array.isArray(drft) ? drft : []);
        setSuggestions(Array.isArray(sugg) ? sugg : []);
      })
      .catch(() => {})
      .finally(() => setDataLoading(false));
  }, [user, authLoading]);

  const respondSuggestion = async (id: number, status: "accepted" | "completed" | "dismissed") => {
    setResponding(id);
    try {
      const res = await fetch("/api/author/suggestions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        setSuggestions(s => s.map(sg => sg.id === id ? { ...sg, status } : sg));
      }
    } finally {
      setResponding(null);
    }
  };

  if (authLoading) return null;

  const totalViews    = posts.reduce((s, p) => s + (parseInt(p.stats?.views    || "0") || 0), 0);
  const totalLikes    = posts.reduce((s, p) => s + (parseInt(p.stats?.likes    || "0") || 0), 0);
  const pendingSuggestions = suggestions.filter(s => s.status === "pending");
  const topPosts = [...posts].sort((a, b) => parseInt(b.stats?.views || "0") - parseInt(a.stats?.views || "0")).slice(0, 5);

  return (
    <div className="px-8 py-10 max-w-5xl mx-auto">
      {/* Greeting */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-2xl font-bold text-[#0a0a0a]">
            {user?.name ? `Welcome back, ${user.name.split(" ")[0]}` : "Welcome back"}
          </p>
          <p className="text-sm text-[#a3a3a3] mt-0.5">Here's how your content is doing.</p>
        </div>
        <button
          onClick={() => router.push("/authors/create")}
          className="px-5 py-2.5 rounded-xl bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors"
        >
          New article
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-10">
        {[
          { label: "Published",   value: posts.length },
          { label: "Total views", value: totalViews.toLocaleString() },
          { label: "Total likes", value: totalLikes.toLocaleString() },
          { label: "Drafts",      value: drafts.length },
        ].map(stat => (
          <div key={stat.label} className="border border-[#f0f0f0] rounded-xl p-5">
            <p className="text-2xl font-bold text-[#0a0a0a]">
              {dataLoading ? <span className="text-[#e5e5e5]">—</span> : stat.value}
            </p>
            <p className="text-xs text-[#a3a3a3] mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Two-column body */}
      <div className="grid grid-cols-5 gap-8">

        {/* Left — top articles + drafts */}
        <div className="col-span-3 space-y-8">

          {/* Top articles */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-[#0a0a0a]">Top articles</p>
              <Link href="/authors/my-articles" className="flex items-center gap-0.5 text-xs text-[#a3a3a3] hover:text-[#525252] transition-colors">
                View all <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {dataLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-4 h-4 text-[#a3a3a3] animate-spin" /></div>
            ) : topPosts.length === 0 ? (
              <div className="border border-dashed border-[#e5e5e5] rounded-xl p-10 text-center">
                <p className="text-sm text-[#a3a3a3] mb-3">No articles yet.</p>
                <Link href="/authors/create" className="text-sm text-[#F44444] font-medium hover:text-[#d64d3c] transition-colors">
                  Write your first article
                </Link>
              </div>
            ) : (
              <div className="space-y-0.5">
                {topPosts.map((post, i) => (
                  <div key={post.id} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[#fafafa] transition-colors group">
                    <span className="text-xs font-semibold text-[#d0d0d0] w-4 flex-shrink-0">{i + 1}</span>
                    {post.image ? (
                      <img src={post.image} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-[#f5f5f5] flex items-center justify-center flex-shrink-0">
                        <FileText className="w-3.5 h-3.5 text-[#d0d0d0]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#0a0a0a] truncate">{post.title || "Untitled"}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1 text-xs text-[#c0c0c0]">
                          <Eye className="w-3 h-3" />{post.stats?.views || 0}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-[#c0c0c0]">
                          <Heart className="w-3 h-3" />{post.stats?.likes || 0}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => router.push(`/authors/create?edit=${post.id}`)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-[#f0f0f0] transition-all"
                    >
                      <Edit className="w-3.5 h-3.5 text-[#737373]" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Drafts */}
          {!dataLoading && drafts.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-[#0a0a0a]">Continue writing</p>
                <Link href="/authors/drafts" className="flex items-center gap-0.5 text-xs text-[#a3a3a3] hover:text-[#525252] transition-colors">
                  View all <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-0.5">
                {drafts.slice(0, 3).map(draft => (
                  <button
                    key={draft.id}
                    onClick={() => router.push(`/authors/create?edit=${draft.id}`)}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[#fafafa] transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#f5f5f5] flex items-center justify-center flex-shrink-0">
                      <FilePen className="w-3.5 h-3.5 text-[#c0c0c0]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#0a0a0a] truncate">{draft.title || "Untitled draft"}</p>
                      <p className="text-xs text-[#c0c0c0] mt-0.5">{draft.date}</p>
                    </div>
                    <span className="text-[10px] font-medium text-[#a3a3a3] bg-[#f5f5f5] px-2 py-0.5 rounded-full">Draft</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right — suggestions */}
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-[#0a0a0a]">Suggestions</p>
            {pendingSuggestions.length > 0 && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FFF8E6] text-[#B45309]">
                {pendingSuggestions.length} pending
              </span>
            )}
          </div>

          {dataLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-4 h-4 text-[#a3a3a3] animate-spin" /></div>
          ) : suggestions.length === 0 ? (
            <div className="border border-dashed border-[#e5e5e5] rounded-xl p-8 text-center">
              <p className="text-xs text-[#c0c0c0]">No suggestions from your editor yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {suggestions.map(sg => (
                <div key={sg.id} className="border border-[#f0f0f0] rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-medium text-[#0a0a0a] leading-snug">{sg.title}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLORS[sg.status] ?? STATUS_COLORS.pending}`}>
                      {sg.status}
                    </span>
                  </div>

                  {sg.description && (
                    <p className="text-xs text-[#737373] leading-relaxed mb-2">{sg.description}</p>
                  )}

                  {sg.deadline && (
                    <div className="flex items-center gap-1 text-xs text-[#a3a3a3] mb-3">
                      <Clock className="w-3 h-3" />
                      Due {sg.deadline}
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-xs text-[#c0c0c0] mb-3">
                    <span>From</span>
                    {sg.admin.avatar ? (
                      <img src={sg.admin.avatar} alt="" className="w-4 h-4 rounded-full object-cover" />
                    ) : null}
                    <span className="text-[#737373] font-medium">{sg.admin.name}</span>
                  </div>

                  {sg.status === "pending" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => respondSuggestion(sg.id, "accepted")}
                        disabled={responding === sg.id}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-[#0a0a0a] text-white text-xs font-medium hover:bg-[#333] transition-colors disabled:opacity-50"
                      >
                        {responding === sg.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        Accept
                      </button>
                      <button
                        onClick={() => respondSuggestion(sg.id, "dismissed")}
                        disabled={responding === sg.id}
                        className="px-3 py-1.5 rounded-lg border border-[#e5e5e5] text-xs text-[#737373] hover:bg-[#fafafa] transition-colors disabled:opacity-50"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {sg.status === "accepted" && (
                    <button
                      onClick={() => respondSuggestion(sg.id, "completed")}
                      disabled={responding === sg.id}
                      className="w-full py-1.5 rounded-lg border border-[#e5e5e5] text-xs text-[#525252] hover:bg-[#fafafa] transition-colors disabled:opacity-50"
                    >
                      Mark as written
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
