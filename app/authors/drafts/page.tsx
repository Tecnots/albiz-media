"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FilePen, Trash2, Edit, Loader2, PenLine } from "lucide-react";
import { useAuthorContext } from "../context";

interface Post {
  id: number;
  title: string | null;
  description: string | null;
  date: string;
  image: string | null;
  status: string | null;
}

export default function DraftsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthorContext();
  const [drafts, setDrafts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    fetch(`/api/posts?status=drafts&userId=${user.id}`)
      .then(r => r.json())
      .then(data => setDrafts(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  const handleDelete = async (postId: number) => {
    if (!confirm("Delete this draft?")) return;
    setDeleting(postId);
    try {
      const res = await fetch("/api/posts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      if (res.ok) setDrafts(drafts.filter(d => d.id !== postId));
    } catch {
    } finally {
      setDeleting(null);
    }
  };

  if (authLoading) return null;

  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xl font-bold text-[#0a0a0a]">Drafts</p>
          <p className="text-sm text-[#a3a3a3] mt-0.5">{drafts.length} in progress</p>
        </div>
        <button
          onClick={() => router.push("/authors/create")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors"
        >
          <PenLine className="w-3.5 h-3.5" />
          New article
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 text-[#a3a3a3] animate-spin" />
        </div>
      ) : drafts.length === 0 ? (
        <div className="border border-dashed border-[#e5e5e5] rounded-xl p-14 text-center">
          <p className="text-sm text-[#a3a3a3] mb-4">No drafts. Start writing and save as draft to continue later.</p>
          <button
            onClick={() => router.push("/authors/create")}
            className="text-sm text-[#F44444] font-medium hover:text-[#d64d3c] transition-colors"
          >
            Start writing
          </button>
        </div>
      ) : (
        <div className="space-y-px">
          {drafts.map(draft => (
            <div
              key={draft.id}
              className="flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-[#fafafa] transition-colors group cursor-pointer"
              onClick={() => router.push(`/authors/create?edit=${draft.id}`)}
            >
              {draft.image ? (
                <img src={draft.image} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-[#f5f5f5] flex items-center justify-center flex-shrink-0">
                  <FilePen className="w-5 h-5 text-[#d0d0d0]" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-[#0a0a0a] truncate">{draft.title || "Untitled draft"}</p>
                  <span className="text-[10px] font-medium text-[#a3a3a3] bg-[#f5f5f5] px-2 py-0.5 rounded-full flex-shrink-0">Draft</span>
                </div>
                <p className="text-xs text-[#737373] truncate mt-0.5">{draft.description || ""}</p>
                <p className="text-xs text-[#c0c0c0] mt-1">{draft.date}</p>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => router.push(`/authors/create?edit=${draft.id}`)}
                  className="p-2 rounded-lg hover:bg-[#f0f0f0] transition-colors"
                >
                  <Edit className="w-3.5 h-3.5 text-[#737373]" />
                </button>
                <button
                  onClick={() => handleDelete(draft.id)}
                  disabled={deleting === draft.id}
                  className="p-2 rounded-lg hover:bg-[#f0f0f0] transition-colors disabled:opacity-50"
                >
                  {deleting === draft.id
                    ? <Loader2 className="w-3.5 h-3.5 text-[#737373] animate-spin" />
                    : <Trash2 className="w-3.5 h-3.5 text-[#737373]" />
                  }
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
