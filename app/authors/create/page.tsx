"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Upload, X, Plus, Save, Send } from "lucide-react";
import { AlbizLogo } from "@/app/lib/shared-components";

interface Section {
  id: number;
  name: string;
  color: string;
}

function CreateArticleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: number; name: string; handle: string; role: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sections, setSections] = useState<Section[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("published");

  useEffect(() => {
    fetch("/api/auth/session")
      .then(r => r.json())
      .then(data => {
        if (!data.user || (data.user.role !== "AUTHOR" && data.user.role !== "ADMIN")) {
          router.push("/");
          return;
        }
        setUser(data.user);
        loadSections();
        if (editId) loadPost(editId);
        else setLoading(false);
      })
      .catch(() => {
        router.push("/");
      });
  }, [router, editId]);

  const loadSections = async () => {
    try {
      const res = await fetch("/api/sections");
      const data = await res.json();
      setSections(data);
    } catch (err) {
      console.error("Failed to load sections:", err);
    }
  };

  const loadPost = async (id: string) => {
    try {
      const res = await fetch(`/api/posts`);
      const data = await res.json();
      const post = data.find((p: any) => p.id === Number(id));
      if (post) {
        setTitle(post.title || "");
        setDescription(post.description || "");
        setContent(post.content || "");
        setThumbnailPreview(post.image || "");
        setSectionId(post.sectionId?.toString() || "");
        setTags(post.tags || []);
        setSeoDescription(post.seoDescription || "");
        setStatus(post.status || "published");
      }
    } catch (err) {
      console.error("Failed to load post:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnail(file);
      setThumbnailPreview(URL.createObjectURL(file));
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleSubmit = async (saveAsDraft: boolean = false) => {
    if (!user) return;
    if (!title.trim()) {
      alert("Title is required");
      return;
    }

    setSubmitting(true);
    try {
      let imageUrl = thumbnailPreview;
      if (thumbnail) {
        const formData = new FormData();
        formData.append("file", thumbnail);
        formData.append("type", "cover");
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const uploadData = await uploadRes.json();
        imageUrl = uploadData.url;
      }

      const body = {
        type: "article",
        title: title.trim(),
        description: description.trim(),
        content: content.trim(),
        image: imageUrl,
        tags,
        status: saveAsDraft ? "draft" : status,
        seoDescription: seoDescription.trim(),
        sectionId: sectionId ? Number(sectionId) : null,
        articleParagraphs: content.split("\n\n").filter(p => p.trim()),
      };

      let res;
      if (editId) {
        res = await fetch("/api/posts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, postId: Number(editId) }),
        });
      } else {
        res = await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      if (res.ok) {
        router.push("/authors/my-articles");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to save article");
      }
    } catch (err) {
      console.error("Failed to save article:", err);
      alert("Failed to save article");
    } finally {
      setSubmitting(false);
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
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlbizLogo size={32} />
            <span className="font-semibold text-[#0a0a0a]">{editId ? "Edit Article" : "Create Article"}</span>
          </div>
          <button
            onClick={() => router.push("/authors")}
            className="text-sm text-[#737373] hover:text-[#0a0a0a] transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(false); }} className="space-y-6">
          <div>
            <label className="text-sm font-medium text-[#525252] block mb-2">Title *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Enter article title"
              className="w-full px-4 py-3 rounded-xl bg-white border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[#525252] block mb-2">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of the article"
              rows={2}
              className="w-full px-4 py-3 rounded-xl bg-white border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all resize-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[#525252] block mb-2">Thumbnail</label>
            <div className="flex items-start gap-4">
              {thumbnailPreview && (
                <img
                  src={thumbnailPreview}
                  alt="Thumbnail preview"
                  className="w-32 h-32 object-cover rounded-lg"
                />
              )}
              <div className="flex-1">
                <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white border border-[#e5e5e5] text-sm text-[#737373] hover:border-[#a3a3a3] hover:text-[#0a0a0a] transition-colors cursor-pointer">
                  <Upload className="w-4 h-4" />
                  <span>Upload thumbnail</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleThumbnailChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-[#525252] block mb-2">Category</label>
            <select
              value={sectionId}
              onChange={e => setSectionId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all"
            >
              <option value="">Select category</option>
              {sections.map(section => (
                <option key={section.id} value={section.id}>{section.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-[#525252] block mb-2">Content</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Write your article content here..."
              rows={12}
              className="w-full px-4 py-3 rounded-xl bg-white border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all resize-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[#525252] block mb-2">Tags</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#f5f5f5] text-sm text-[#0a0a0a]"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-[#F44444] transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyPress={e => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                placeholder="Add a tag"
                className="flex-1 px-4 py-2 rounded-xl bg-white border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm text-[#0a0a0a] hover:bg-[#e5e5e5] transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-[#525252] block mb-2">SEO Description</label>
            <textarea
              value={seoDescription}
              onChange={e => setSeoDescription(e.target.value)}
              placeholder="Meta description for search engines"
              rows={2}
              className="w-full px-4 py-3 rounded-xl bg-white border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all resize-none"
            />
          </div>

          <div className="flex items-center gap-4 pt-4 border-t border-[#e5e5e5]">
            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-white border border-[#e5e5e5] text-[#0a0a0a] font-medium hover:bg-[#f5f5f5] transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Draft
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-[#F44444] text-white font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Publish
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default function CreateArticlePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5]">
        <Loader2 className="w-5 h-5 text-[#a3a3a3] animate-spin" />
      </div>
    }>
      <CreateArticleContent />
    </Suspense>
  );
}
