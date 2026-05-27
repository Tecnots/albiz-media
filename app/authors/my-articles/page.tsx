"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, FileText, Trash2, Edit } from "lucide-react";
import { AlbizLogo } from "@/app/lib/shared-components";

interface Post {
  id: number;
  title: string | null;
  description: string | null;
  date: string;
  image: string | null;
  status: string | null;
  slug: string | null;
  stats: { views: string; likes: string; comments: string; shares: string };
}

export default function MyArticlesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: number; name: string; handle: string; role: string } | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [deleting, setDeleting] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then(r => r.json())
      .then(data => {
        if (!data.user || (data.user.role !== "AUTHOR" && data.user.role !== "ADMIN")) {
          router.push("/");
          return;
        }
        setUser(data.user);
        loadPosts(data.user.id);
      })
      .catch(() => {
        router.push("/");
      });
  }, [router]);

  const loadPosts = async (userId: number) => {
    try {
      const res = await fetch(`/api/posts?userId=${userId}`);
      const data = await res.json();
      setPosts(data.filter((p: Post) => !p.status || p.status === "published"));
    } catch (err) {
      console.error("Failed to load posts:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (postId: number) => {
    if (!confirm("Are you sure you want to delete this article?")) return;
    setDeleting(postId);
    try {
      const res = await fetch("/api/posts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      if (res.ok) {
        setPosts(posts.filter(p => p.id !== postId));
      }
    } catch (err) {
      console.error("Failed to delete post:", err);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5]">
        <Loader2 className="w-5 h-5 text-[#a3a3a3] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <header className="bg-white border-b border-[#e5e5e5]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlbizLogo size={32} />
            <span className="font-semibold text-[#0a0a0a]">My Articles</span>
          </div>
          <button
            onClick={() => router.push("/authors")}
            className="text-sm text-[#737373] hover:text-[#0a0a0a] transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-[#0a0a0a]">Published Articles</h1>
          <button
            onClick={() => router.push("/authors/create")}
            className="px-4 py-2 rounded-xl bg-[#F44444] text-white font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer"
          >
            Create New Article
          </button>
        </div>

        {posts.length === 0 ? (
          <div className="bg-white border border-[#e5e5e5] rounded-xl p-12 text-center">
            <FileText className="w-12 h-12 text-[#a3a3a3] mx-auto mb-4" />
            <p className="text-sm text-[#737373] mb-4">You haven't published any articles yet.</p>
            <button
              onClick={() => router.push("/authors/create")}
              className="text-sm text-[#F44444] font-medium hover:text-[#d64d3c] transition-colors cursor-pointer"
            >
              Create your first article
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {posts.map(post => (
              <div key={post.id} className="bg-white border border-[#e5e5e5] rounded-xl p-6 flex items-start gap-4">
                {post.image && (
                  <img
                    src={post.image}
                    alt={post.title || "Article"}
                    className="w-24 h-24 object-cover rounded-lg"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[#0a0a0a] mb-1 truncate">{post.title || "Untitled"}</h3>
                  <p className="text-sm text-[#737373] mb-2 line-clamp-2">{post.description || "No description"}</p>
                  <div className="flex items-center gap-4 text-xs text-[#a3a3a3]">
                    <span>{post.date}</span>
                    <span>{post.stats.views} views</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => router.push(`/article/${post.id}`)}
                    className="p-2 rounded-lg hover:bg-[#f5f5f5] transition-colors"
                    title="View"
                  >
                    <FileText className="w-4 h-4 text-[#737373]" />
                  </button>
                  <button
                    onClick={() => router.push(`/authors/create?edit=${post.id}`)}
                    className="p-2 rounded-lg hover:bg-[#f5f5f5] transition-colors"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4 text-[#737373]" />
                  </button>
                  <button
                    onClick={() => handleDelete(post.id)}
                    disabled={deleting === post.id}
                    className="p-2 rounded-lg hover:bg-[#f5f5f5] transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    {deleting === post.id ? (
                      <Loader2 className="w-4 h-4 text-[#737373] animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 text-[#737373]" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
