"use client";

import { useState, useRef, useEffect, useCallback, useContext } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { X, ArrowLeft, ImagePlus, Loader2, Check, ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { AuthContext, MobileContext, StoryContext } from "@/app/lib/contexts";
import { RichEditor, type RichEditorHandle } from "@/app/admin/news/RichEditor";

type Section = { id: number; name: string; slug: string; color: string; active: boolean };
type ConfirmState = null | "draft" | "submitted";
type TagSuggestion = { tag: string; uses: number };

const READING_TIME_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "1", label: "1 min" },
  { value: "2", label: "2 min" },
  { value: "3", label: "3 min" },
  { value: "5", label: "5 min" },
  { value: "7", label: "7 min" },
  { value: "10", label: "10 min" },
  { value: "15", label: "15 min" },
  { value: "20", label: "20 min" },
];

function autoSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

/* AppTheme Dropdown – matches admin-components.tsx pattern */
function AppDropdown({
  value,
  onChange,
  options,
  placeholder = "Select…",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-[#e5e5e5] text-sm text-left hover:bg-[#fafafa] transition-colors cursor-pointer focus:outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]"
      >
        <span className={`text-sm truncate ${selected ? "text-[#0a0a0a] font-medium" : "text-[#a3a3a3]"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-[#a3a3a3] flex-shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ type: "spring", duration: 0.15, bounce: 0 }}
            className="absolute z-30 top-full mt-1 left-0 right-0 bg-white border border-[#e5e5e5] rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.12)] overflow-y-auto max-h-[240px] py-1"
          >
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors cursor-pointer hover:bg-[#fafafa] ${value === o.value ? "bg-[#fafafa]" : ""}`}
              >
                <span className="text-[13px] font-medium text-[#0a0a0a] truncate flex-1">{o.label}</span>
                {value === o.value && <Check className="w-4 h-4 text-[#F44444] flex-shrink-0" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface Props {
  onClose: () => void;
  editArticleId?: number | null;
}

export default function ArticleCreator({ onClose, editArticleId }: Props) {
  const router = useRouter();
  const { currentUserId, userProfile } = useContext(AuthContext);
  const { isMobile } = useContext(MobileContext);
  const { triggerArticleRefresh } = useContext(StoryContext);
  const editorRef = useRef<RichEditorHandle>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [content, setContent] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [coverUploading, setCoverUploading] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tagSuggestions, setTagSuggestions] = useState<TagSuggestion[]>([]);
  const [tagLoading, setTagLoading] = useState(false);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [slug, setSlug] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [readingTimeOverride, setReadingTimeOverride] = useState("auto");

  const [editLoading, setEditLoading] = useState(!!editArticleId);

  // Load existing article for editing
  useEffect(() => {
    if (!editArticleId) return;
    setEditLoading(true);
    fetch(`/api/posts/${editArticleId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setTitle(data.title || "");
          setSubtitle(data.description || "");
          setCoverImage(data.image || "");
          setTags(Array.isArray(data.tags) ? data.tags : []);
          setSeoDescription(data.seoDescription || "");
          setSectionId(data.sectionId ?? null);
          setSlug(data.slug || "");
          setSavedArticleId(data.id);
          // Set editor content from articleParagraphs
          const html = Array.isArray(data.articleParagraphs)
            ? data.articleParagraphs.join("")
            : data.content || "";
          setContent(html);
          // Wait for editor to mount then set content
          setTimeout(() => {
            editorRef.current?.setContent(html);
          }, 200);
        }
      })
      .catch(() => {})
      .finally(() => setEditLoading(false));
  }, [editArticleId]);

  // Action state
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [savedArticleId, setSavedArticleId] = useState<number | null>(editArticleId ?? null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tagDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // Load sections
  useEffect(() => {
    fetch("/api/admin/sections")
      .then((r) => (r.ok ? r.json() : { sections: [] }))
      .then((d) => setSections((d.sections ?? []).filter((s: Section) => s.active)))
      .catch(() => {});
  }, []);

  // Auto-generate slug from title (skip when loading an existing draft)
  const slugInitialized = useRef(!!editArticleId);
  useEffect(() => {
    if (slugInitialized.current) {
      slugInitialized.current = false;
      return;
    }
    if (title.trim()) setSlug(autoSlug(title));
  }, [title]);

  // Body lock
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const showError = useCallback((msg: string) => {
    setError(msg);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setError(""), 4000);
  }, []);

  // Word count & reading time
  const plainText = content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const wordCount = plainText ? plainText.split(/\s+/).length : 0;
  const autoReadingTime = Math.max(1, Math.ceil(wordCount / 200));
  const readingTime = readingTimeOverride === "auto" ? autoReadingTime : Number(readingTimeOverride);

  // Hashtag autocomplete – debounced search
  useEffect(() => {
    if (tagDebounce.current) clearTimeout(tagDebounce.current);
    const q = tagInput.replace(/^#/, "").trim();
    if (!q) { setTagSuggestions([]); setTagLoading(false); return; }
    setTagLoading(true);
    tagDebounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/hashtag/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setTagSuggestions(
            (data.results ?? [])
              .filter((s: TagSuggestion) => !tags.includes(s.tag))
              .slice(0, 8)
          );
        }
      } catch { /* ignore */ }
      setTagLoading(false);
    }, 250);
    return () => { if (tagDebounce.current) clearTimeout(tagDebounce.current); };
  }, [tagInput, tags]);

  // Cover image upload
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUserId) return;
    setCoverUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("userId", String(currentUserId));
      form.append("category", "cover");
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (res.ok) {
        const data = await res.json();
        setCoverImage(data.url);
      } else {
        showError("Failed to upload image");
      }
    } catch {
      showError("Upload failed");
    } finally {
      setCoverUploading(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  // Tag management
  const addTag = (tag: string) => {
    const t = tag.replace(/^#/, "").trim();
    if (t && !tags.includes(t) && tags.length < 10) {
      setTags([...tags, t]);
      setTagInput("");
      setTagSuggestions([]);
    }
  };

  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag));

  // Build payload
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
      language: "en",
      status,
      preferredEditorId: null,
    };
  };

  // Save article (create or update)
  const saveArticle = async (status: string): Promise<number | null> => {
    if (!currentUserId) return null;
    const isUpdate = !!savedArticleId;
    const res = await fetch("/api/posts", {
      method: isUpdate ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(isUpdate ? { postId: savedArticleId } : {}),
        userId: currentUserId,
        type: "article",
        slug: slug.trim() || null,
        ...buildPayload(status),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to save");
    return data.id ?? savedArticleId ?? null;
  };

  // Handlers
  const handleSaveDraft = async () => {
    if (!title.trim()) { showError("A title is required to save"); return; }
    setSavingDraft(true);
    setError("");
    try {
      const id = await saveArticle("draft");
      setSavedArticleId(id);
      triggerArticleRefresh();
      setConfirm("draft");
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Connection error");
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (!title.trim()) { showError("A title is required"); return; }
    setSubmitting(true);
    setError("");
    try {
      const id = await saveArticle("submitted");
      setSavedArticleId(id);
      triggerArticleRefresh();
      setConfirm("submitted");
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Connection error");
    } finally {
      setSubmitting(false);
    }
  };

  const sectionOptions = sections.map((s) => ({ value: String(s.id), label: s.name }));

  /* ── Article details sidebar content (shared by desktop + mobile) ── */
  const detailsContent = (
    <div className="space-y-5">
      {/* Category */}
      <div>
        <label className="text-xs font-medium text-[#737373] mb-1.5 block">Category</label>
        <AppDropdown
          value={sectionId ? String(sectionId) : ""}
          onChange={(v) => setSectionId(v ? Number(v) : null)}
          options={sectionOptions}
          placeholder="Select category"
        />
      </div>

      {/* Tags with autocomplete */}
      <div>
        <label className="text-xs font-medium text-[#737373] mb-1.5 block">Tags</label>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#fef2f2] text-xs text-[#F44444] rounded-full font-medium"
              >
                #{tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="hover:text-[#0a0a0a] transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="relative">
          <input
            ref={tagInputRef}
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && tagInput.trim()) {
                e.preventDefault();
                if (tagSuggestions.length > 0) {
                  addTag(tagSuggestions[0].tag);
                } else {
                  addTag(tagInput);
                }
              }
              if (e.key === "Escape") {
                setTagInput("");
                setTagSuggestions([]);
              }
              if (e.key === "Backspace" && !tagInput && tags.length) {
                removeTag(tags[tags.length - 1]);
              }
            }}
            placeholder="Type # to search tags..."
            className="w-full px-3 py-2 text-sm rounded-xl border border-[#e5e5e5] outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444] transition-all"
          />
          {(tagSuggestions.length > 0 || tagLoading) && tagInput.trim() && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e5e5e5] rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.12)] z-30 overflow-hidden py-1 max-h-[200px] overflow-y-auto">
              {tagLoading && tagSuggestions.length === 0 && (
                <div className="px-3 py-2 flex items-center gap-2 text-sm text-[#a3a3a3]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Searching...
                </div>
              )}
              {tagSuggestions.map((s) => (
                <button
                  key={s.tag}
                  onClick={() => addTag(s.tag)}
                  className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[#fafafa] transition-colors cursor-pointer"
                >
                  <span className="text-sm text-[#0a0a0a] font-medium">#{s.tag}</span>
                  <span className="text-xs text-[#a3a3a3]">{s.uses} uses</span>
                </button>
              ))}
              {!tagLoading && tagSuggestions.length === 0 && tagInput.replace(/^#/, "").trim() && (
                <button
                  onClick={() => addTag(tagInput)}
                  className="w-full px-3 py-2 text-left hover:bg-[#fafafa] transition-colors cursor-pointer"
                >
                  <span className="text-sm text-[#F44444] font-medium">Create &ldquo;#{tagInput.replace(/^#/, "").trim()}&rdquo;</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reading Time */}
      <div>
        <label className="text-xs font-medium text-[#737373] mb-1.5 block">Reading Time</label>
        <AppDropdown
          value={readingTimeOverride}
          onChange={setReadingTimeOverride}
          options={READING_TIME_OPTIONS.map((o) => ({
            ...o,
            label: o.value === "auto" ? `Auto (${autoReadingTime} min)` : o.label,
          }))}
        />
        <p className="text-xs text-[#a3a3a3] mt-1">{wordCount} words</p>
      </div>

      {/* SEO */}
      <div>
        <label className="text-xs font-medium text-[#737373] mb-1.5 block">SEO Description</label>
        <textarea
          value={seoDescription}
          onChange={(e) => setSeoDescription(e.target.value)}
          placeholder="Brief description for search engines..."
          rows={3}
          maxLength={160}
          className="w-full px-3 py-2 text-sm rounded-xl border border-[#e5e5e5] outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444] transition-all resize-none"
        />
        <p className="text-xs text-[#a3a3a3] mt-1">{seoDescription.length}/160</p>
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.97 }}
        animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1 }}
        transition={{ type: "spring", damping: 28, stiffness: 340 }}
        className="w-full sm:max-w-4xl bg-white sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#f0f0f0]">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1 hover:bg-[#f5f5f5] rounded-lg transition-colors cursor-pointer min-touch-target"
            >
              {isMobile ? (
                <ArrowLeft className="w-5 h-5 text-[#0a0a0a]" />
              ) : (
                <X className="w-5 h-5 text-[#737373]" />
              )}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveDraft}
              disabled={savingDraft || submitting}
              className="px-4 py-1.5 rounded-full border border-[#e5e5e5] text-sm font-medium text-[#0a0a0a] hover:bg-[#fafafa] transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              {savingDraft && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Draft
            </button>
            <button
              onClick={handleSubmitForReview}
              disabled={savingDraft || submitting}
              className="px-4 py-1.5 rounded-full bg-[#F44444] text-white text-sm font-medium hover:bg-[#d63c3c] transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isMobile ? "Submit" : "Submit for Review"}
            </button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {editLoading ? (
            <div className="flex-1 flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-[#a3a3a3]" />
            </div>
          ) : (
          <div className="flex h-full">
            {/* Main editor */}
            <div className="flex-1 min-w-0 px-4 md:px-6 py-5 space-y-4 overflow-y-auto">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Article title"
                className="w-full text-xl md:text-2xl font-bold text-[#0a0a0a] placeholder:text-[#d4d4d4] outline-none"
              />
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Add a subtitle (optional)"
                className="w-full text-sm text-[#525252] placeholder:text-[#d4d4d4] outline-none"
              />

              {/* Cover image */}
              <div>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleCoverUpload}
                />
                {coverImage ? (
                  <div className="relative rounded-xl overflow-hidden h-40 sm:h-52 group">
                    <Image src={coverImage} alt="Cover" fill className="object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <button
                        onClick={() => coverInputRef.current?.click()}
                        className="opacity-0 group-hover:opacity-100 transition-opacity px-4 py-2 bg-white/90 rounded-lg text-sm font-medium cursor-pointer"
                      >
                        Change Cover
                      </button>
                    </div>
                    <button
                      onClick={() => setCoverImage("")}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => coverInputRef.current?.click()}
                    disabled={coverUploading}
                    className="w-full h-32 border-2 border-dashed border-[#e5e5e5] rounded-xl flex flex-col items-center justify-center gap-2 hover:border-[#a3a3a3] transition-colors cursor-pointer"
                  >
                    {coverUploading ? (
                      <Loader2 className="w-5 h-5 text-[#a3a3a3] animate-spin" />
                    ) : (
                      <>
                        <ImagePlus className="w-5 h-5 text-[#a3a3a3]" />
                        <span className="text-xs text-[#a3a3a3]">Add cover image</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Rich editor */}
              {currentUserId > 0 && (
                <div className="min-h-[200px]">
                  <RichEditor
                    ref={editorRef}
                    value={content}
                    onChange={setContent}
                    userId={currentUserId}
                  />
                </div>
              )}

              {/* Footer stats */}
              <div className="flex items-center gap-4 text-xs text-[#a3a3a3] pt-2 border-t border-[#f0f0f0]">
                <span>{wordCount} words</span>
                <span>{readingTime} min read</span>
              </div>

              {/* Mobile: Article Details */}
              <div className="lg:hidden pt-4 border-t border-[#f0f0f0]">
                {detailsContent}
                <div className="h-8" />
              </div>
            </div>

            {/* Right sidebar – desktop only */}
            <div className="hidden lg:block w-64 flex-shrink-0 border-l border-[#f0f0f0] p-4 overflow-y-auto">
              {detailsContent}
            </div>
          </div>
          )}
        </div>

        {/* Error toast */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[210] bg-[#0a0a0a] text-white text-sm px-5 py-2.5 rounded-full shadow-lg"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Confirmation dialog – centered overlay on top of everything */}
      <AnimatePresence>
        {confirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: "spring", duration: 0.15, bounce: 0 }}
              className="w-full max-w-sm mx-4 bg-white rounded-2xl shadow-2xl p-6 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-14 h-14 rounded-full bg-[#22c55e]/10 flex items-center justify-center mx-auto mb-3">
                <Check className="w-7 h-7 text-[#22c55e]" />
              </div>
              <p className="text-lg font-semibold text-[#0a0a0a] mb-1">
                {confirm === "draft" ? "Draft Saved" : "Submitted for Review"}
              </p>
              <p className="text-sm text-[#737373] mb-5">
                {confirm === "draft"
                  ? "Your article has been saved as a draft. You can continue editing anytime."
                  : "Your article has been submitted for review. You\u2019ll be notified when it\u2019s approved."}
              </p>

              {coverImage && (
                <div className="relative w-full h-32 rounded-xl overflow-hidden mb-2">
                  <Image src={coverImage} alt="" fill className="object-cover" />
                </div>
              )}
              {title && <p className="font-medium text-sm text-[#0a0a0a] mb-5 truncate">{title}</p>}

              <div className="flex gap-2">
                {confirm === "draft" && (
                  <button
                    onClick={() => setConfirm(null)}
                    className="flex-1 px-4 py-2.5 rounded-full border border-[#e5e5e5] text-sm font-medium text-[#0a0a0a] hover:bg-[#fafafa] transition-colors cursor-pointer"
                  >
                    Continue Editing
                  </button>
                )}
                <button
                  onClick={() => {
                    onClose();
                    router.push(userProfile?.handle ? `/${userProfile.handle}` : "/profile");
                  }}
                  className="flex-1 px-4 py-2.5 rounded-full bg-[#F44444] text-white text-sm font-medium hover:bg-[#d63c3c] transition-colors cursor-pointer"
                >
                  View My Articles
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
