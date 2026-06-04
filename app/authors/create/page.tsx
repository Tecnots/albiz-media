"use client";

import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft, Eye, ImagePlus, Hash, Plus, X, Loader2,
  Wand2, Maximize2, Minimize2, HelpCircle, Scissors,
  SpellCheck, Briefcase, MessageCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuthorContext } from "../layout";
import { RichEditor, type RichEditorHandle } from "../../admin/news/RichEditor";

// ─── Flesch-Kincaid readability ───────────────────────────────────────────────

function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  word = word.replace(/^y/, "");
  const m = word.match(/[aeiouy]{1,2}/g);
  return Math.max(1, m ? m.length : 1);
}

function readabilityScore(text: string): { grade: number; label: string; color: string } | null {
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  if (words.length < 10) return null;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const syllables = words.reduce((s, w) => s + countSyllables(w), 0);
  const grade = 0.39 * (words.length / Math.max(1, sentences.length)) + 11.8 * (syllables / words.length) - 15.59;
  const g = Math.max(1, Math.round(grade * 10) / 10);
  if (g <= 6)  return { grade: g, label: "Easy",       color: "#22c55e" };
  if (g <= 9)  return { grade: g, label: "Standard",   color: "#F59E0B" };
  if (g <= 12) return { grade: g, label: "Advanced",   color: "#F97316" };
  return          { grade: g, label: "Complex",     color: "#F44444" };
}

// ─── Tag Input ────────────────────────────────────────────────────────────────

const ALL_TAGS = ["News", "Technology", "Business", "AI", "Policy", "Update", "Startups", "Finance", "Space", "Health", "Climate", "India", "Global", "Science", "Culture"];

function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const filtered = ALL_TAGS.filter(t => !tags.includes(t) && t.toLowerCase().includes(input.toLowerCase()));
  const canCreate = input.trim() && !ALL_TAGS.map(t => t.toLowerCase()).includes(input.trim().toLowerCase()) && !tags.map(t => t.toLowerCase()).includes(input.trim().toLowerCase());

  useEffect(() => {
    const handle = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const add = (tag: string) => { const t = tag.trim(); if (t && !tags.includes(t)) onChange([...tags, t]); setInput(""); setOpen(false); };

  return (
    <div ref={ref}>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map(t => (
            <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#F44444] text-white">
              {t}
              <button type="button" onClick={() => onChange(tags.filter(x => x !== t))}><X className="w-2.5 h-2.5" /></button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-[#f5f5f5] border border-[#e5e5e5] focus-within:border-[#F44444] focus-within:ring-1 focus-within:ring-[#F44444]/20 transition-all">
          <Hash className="w-3 h-3 text-[#a3a3a3] flex-shrink-0" />
          <input value={input} onChange={e => { setInput(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (filtered[0]) add(filtered[0]); else if (canCreate) add(input); } if (e.key === "Escape") setOpen(false); if (e.key === "Backspace" && !input && tags.length) onChange(tags.slice(0, -1)); }}
            placeholder="Search or create tag…" className="flex-1 text-xs bg-transparent outline-none text-[#0a0a0a] placeholder:text-[#a3a3a3]" />
        </div>
        <AnimatePresence>
          {open && (filtered.length > 0 || canCreate) && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ type: "spring", duration: 0.15, bounce: 0 }}
              className="absolute z-30 top-full mt-1 left-0 right-0 bg-white border border-[#e5e5e5] rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden">
              {filtered.map(t => (
                <button key={t} type="button" onMouseDown={() => add(t)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-[#fafafa] transition-colors">
                  <span className="text-xs text-[#737373]">{t}</span>
                </button>
              ))}
              {canCreate && (
                <button type="button" onMouseDown={() => add(input)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-[#fafafa] transition-colors border-t border-[#f5f5f5]">
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

// ─── Shortcuts overlay ────────────────────────────────────────────────────────

const SHORTCUTS = [
  { key: "Ctrl + B", label: "Bold" }, { key: "Ctrl + I", label: "Italic" },
  { key: "Ctrl + U", label: "Underline" }, { key: "Ctrl + K", label: "Insert link" },
  { key: "Ctrl + Z", label: "Undo" }, { key: "Ctrl + Shift + Z", label: "Redo" },
  { key: "# Space", label: "Heading 1" }, { key: "## Space", label: "Heading 2" },
  { key: "> Space", label: "Blockquote" }, { key: "- Space", label: "Bullet list" },
  { key: "1. Space", label: "Numbered list" }, { key: "---", label: "Divider" },
  { key: "?", label: "Open shortcuts" }, { key: "Esc", label: "Close overlays" },
];

interface Section { id: number; name: string; color: string; active: boolean; }

// ─── Improve toolbar action type ──────────────────────────────────────────────

interface ImproveState {
  text: string; from: number; to: number;
  rect: { top: number; left: number; width: number };
  loading: boolean; result: string | null; action: string | null;
}

// ─── Main page ────────────────────────────────────────────────────────────────

function WriteArticleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const { user, loading: authLoading } = useAuthorContext();

  const [loading, setLoading] = useState(!!editId);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [content, setContent] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [coverUploading, setCoverUploading] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [language, setLanguage] = useState("en");
  const [slug, setSlug] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [sections, setSections] = useState<Section[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Action states
  const [publishing, setPublishing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [publishError, setPublishError] = useState("");


  // UI modes
  const [focusMode, setFocusMode] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Word count goal
  const [wordGoal, setWordGoal] = useState<number | null>(null);
  const [wordGoalInput, setWordGoalInput] = useState("");
  const [editingGoal, setEditingGoal] = useState(false);

  // AI: title suggestions
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);
  const [loadingTitles, setLoadingTitles] = useState(false);
  const [showTitles, setShowTitles] = useState(false);

  // AI: tag suggestions
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [loadingTagSuggestions, setLoadingTagSuggestions] = useState(false);

  // AI: meta & slug
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [loadingSlug, setLoadingSlug] = useState(false);

  // AI: outline
  const [loadingOutline, setLoadingOutline] = useState(false);
  const [outlineItems, setOutlineItems] = useState<{ level: number; text: string }[]>([]);
  const [showOutline, setShowOutline] = useState(false);

  // AI: improve writing
  const [improveState, setImproveState] = useState<ImproveState | null>(null);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<RichEditorHandle>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const titlesDropdownRef = useRef<HTMLDivElement>(null);

  const autoSlug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const plainText = content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const wordCount = plainText ? plainText.split(/\s+/).length : 0;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));
  const goalPct = wordGoal ? Math.min(100, Math.round((wordCount / wordGoal) * 100)) : null;
  const readability = readabilityScore(plainText);

  // ─── Load article for editing ───────────────────────────────────────────────

  useEffect(() => {
    if (authLoading || !user) return;
    fetch("/api/admin/sections")
      .then(r => r.ok ? r.json() : { sections: [] })
      .then(d => setSections((d.sections ?? []).filter((s: Section) => s.active)))
      .catch(() => {});
    if (editId) {
      fetch(`/api/posts?userId=${user.id}&status=all`)
        .then(r => r.json())
        .then((data: any[]) => {
          const post = Array.isArray(data) ? data.find((p: any) => p.id === Number(editId)) : null;
          if (post) {
            setTitle(post.title ?? ""); setSubtitle(post.description ?? "");
            setCoverImage(post.image ?? ""); setTags(post.tags ?? []);
            setSectionId(post.sectionId ?? null); setLanguage(post.language ?? "en");
            setSlug(post.slug ?? autoSlug(post.title ?? ""));
            setSeoDescription(post.seoDescription ?? "");
            setContent(post.articleContent?.paragraphs?.[0] ?? post.content ?? "");
            setEditingId(Number(editId));
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [user, authLoading, editId]);

  // ─── Autosave timestamp label ────────────────────────────────────────────────

  // ─── Keyboard shortcuts ──────────────────────────────────────────────────────

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
      if (e.key === "?") { e.preventDefault(); setShowShortcuts(s => !s); }
      if (e.key === "Escape") { setShowShortcuts(false); setShowPreview(false); setShowTitles(false); setImproveState(null); }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);

  // ─── Close title suggestions on outside click ────────────────────────────────

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (titlesDropdownRef.current && !titlesDropdownRef.current.contains(e.target as Node) && titleRef.current && !titleRef.current.contains(e.target as Node)) {
        setShowTitles(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // ─── Cover upload ────────────────────────────────────────────────────────────

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setCoverUploading(true);
    try {
      const form = new FormData();
      form.append("file", file); form.append("userId", String(user.id)); form.append("category", "cover");
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (res.ok) { const data = await res.json(); setCoverImage(data.url); }
    } catch {} finally { setCoverUploading(false); if (coverInputRef.current) coverInputRef.current.value = ""; }
  };

  // ─── Build payload ────────────────────────────────────────────────────────────

  const buildPayload = (status: string) => {
    const html = content || "<p></p>";
    const plain = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    return { title: title.trim(), description: subtitle.trim() || plain.substring(0, 200) || "", content: subtitle.trim() || plain.substring(0, 200) || "", image: coverImage || null, tags: tags.length > 0 ? tags : [], articleParagraphs: [html], seoDescription: seoDescription.trim() || null, sectionId: sectionId ?? null, language: language || "en", status };
  };

  const saveArticle = async (status: string): Promise<number | null> => {
    if (!user) return null;
    const html = content || "<p></p>";
    if (editingId) {
      const res = await fetch("/api/posts", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId: editingId, ...buildPayload(status), articleParagraphs: [html] }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      return editingId;
    } else {
      const res = await fetch("/api/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id, type: "article", slug: slug.trim() || null, ...buildPayload(status) }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      return data.id ?? null;
    }
  };

  const handleSaveDraft = async () => {
    if (!title.trim()) { setPublishError("A title is required to save"); return; }
    setSavingDraft(true); setPublishError("");
    try { const id = await saveArticle("draft"); if (id && !editingId) setEditingId(id); router.push("/authors/my-articles"); }
    catch (err: unknown) { setPublishError(err instanceof Error ? err.message : "Connection error"); }
    finally { setSavingDraft(false); }
  };

  const handleSubmitForReview = async () => {
    if (!title.trim()) { setPublishError("A title is required"); return; }
    setSubmitting(true); setPublishError("");
    try { await saveArticle("submitted"); router.push("/authors/my-articles"); }
    catch (err: unknown) { setPublishError(err instanceof Error ? err.message : "Connection error"); }
    finally { setSubmitting(false); }
  };

  const handlePublish = async () => {
    if (!title.trim()) { setPublishError("A title is required"); return; }
    setPublishing(true); setPublishError("");
    try { await saveArticle("published"); router.push("/authors/my-articles"); }
    catch (err: unknown) { setPublishError(err instanceof Error ? err.message : "Connection error"); }
    finally { setPublishing(false); }
  };

  // ─── AI helpers ───────────────────────────────────────────────────────────

  const callAI = useCallback(async (action: string, extra?: Record<string, string>) => {
    const res = await fetch("/api/author/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, title, content, ...extra }),
    });
    if (!res.ok) throw new Error("AI request failed");
    return res.json();
  }, [title, content]);

  const handleSuggestTitles = async () => {
    setLoadingTitles(true); setShowTitles(true);
    try { const data = await callAI("suggest-titles"); setTitleSuggestions(data.result ?? []); }
    catch { setTitleSuggestions([]); }
    finally { setLoadingTitles(false); }
  };

  const handleGenerateMeta = async () => {
    if (!title.trim()) return;
    setLoadingMeta(true);
    try { const data = await callAI("generate-meta"); if (data.result) setSeoDescription(data.result); }
    catch {} finally { setLoadingMeta(false); }
  };

  const handleGenerateSlug = async () => {
    if (!title.trim()) return;
    setLoadingSlug(true);
    try { const data = await callAI("generate-slug"); if (data.result) setSlug(data.result.trim().toLowerCase().replace(/[^a-z0-9-]/g, "")); }
    catch {} finally { setLoadingSlug(false); }
  };

  const handleSuggestTags = async () => {
    if (!title.trim()) return;
    setLoadingTagSuggestions(true);
    try { const data = await callAI("suggest-tags"); setTagSuggestions((data.result ?? []).filter((t: string) => !tags.includes(t))); }
    catch {} finally { setLoadingTagSuggestions(false); }
  };

  const handleGenerateOutline = async () => {
    if (!title.trim()) return;
    setLoadingOutline(true); setShowOutline(true);
    try { const data = await callAI("generate-outline"); setOutlineItems(data.result ?? []); }
    catch { setOutlineItems([]); }
    finally { setLoadingOutline(false); }
  };

  const insertOutline = () => {
    if (!outlineItems.length) return;
    const html = outlineItems.map(({ level, text }) =>
      level === 2
        ? `<h2>${text}</h2><p></p>`
        : `<h3>${text}</h3><p></p>`
    ).join("");
    editorRef.current?.setContent(html);
    setShowOutline(false);
  };

  // ─── Selection → improve toolbar ─────────────────────────────────────────

  const handleSelectionChange = useCallback((text: string, rect: DOMRect | null, from: number, to: number) => {
    if (!text.trim() || text.trim().split(/\s+/).length < 3) { setImproveState(null); return; }
    setImproveState({
      text, from, to,
      rect: rect ? { top: rect.bottom + 8, left: rect.left + rect.width / 2, width: rect.width } : { top: 0, left: 0, width: 0 },
      loading: false, result: null, action: null,
    });
  }, []);

  const handleImprove = async (tone: string, label: string) => {
    if (!improveState) return;
    setImproveState(s => s ? { ...s, loading: true, action: label, result: null } : null);
    try {
      const res = await fetch("/api/author/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "improve-text", selectedText: improveState.text, tone, title }),
      });
      const data = await res.json();
      setImproveState(s => s ? { ...s, loading: false, result: data.result ?? null } : null);
    } catch {
      setImproveState(s => s ? { ...s, loading: false } : null);
    }
  };

  const applyImprovement = () => {
    if (!improveState?.result) return;
    editorRef.current?.replaceRange(improveState.from, improveState.to, improveState.result);
    setImproveState(null);
  };

  if (authLoading || loading) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="w-5 h-5 text-[#a3a3a3] animate-spin" /></div>;
  }

  return (
    <>
      <div className="min-h-screen bg-white">

        {/* ── Sticky top bar ─────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-20 bg-white border-b border-[#e5e5e5] px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => router.push("/authors/my-articles")} className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-[#525252]" />
              </button>
              <span className="text-sm font-medium text-[#0a0a0a]">Write Article</span>
              {title && <span className="text-xs text-[#a3a3a3] hidden sm:block">— {title.substring(0, 40)}{title.length > 40 ? "…" : ""}</span>}
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setShowShortcuts(true)} className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#a3a3a3] hover:text-[#525252]" title="Keyboard shortcuts (?)">
                <HelpCircle className="w-4 h-4" />
              </button>
              <button onClick={() => setFocusMode(f => !f)} className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#a3a3a3] hover:text-[#525252]" title={focusMode ? "Exit focus mode" : "Focus mode"}>
                {focusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button onClick={() => setShowPreview(true)} className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#737373] hover:text-[#0a0a0a]" title="Preview">
                <Eye className="w-4 h-4" />
              </button>
              <button onClick={handleSaveDraft} disabled={savingDraft}
                className="px-4 py-2 rounded-full border border-[#e5e5e5] text-[#525252] text-sm font-medium hover:bg-[#fafafa] transition-colors disabled:opacity-50 flex items-center gap-2">
                {savingDraft && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Save Draft
              </button>
              <button onClick={handleSubmitForReview} disabled={submitting}
                className="px-4 py-2 rounded-full bg-[#3B82F6] text-white text-sm font-medium hover:bg-[#2563EB] transition-colors disabled:opacity-50 flex items-center gap-2">
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Submit for Review
              </button>
              <button onClick={handlePublish} disabled={publishing}
                className="px-4 py-2 rounded-full bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors disabled:opacity-50 flex items-center gap-2">
                {publishing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Publish
              </button>
            </div>
          </div>
        </div>

        <div className="flex">
          {/* ── Main editor ──────────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 px-6 lg:px-12 py-8">

            {/* Cover image */}
            <div className="mb-6">
              {coverImage ? (
                <div className="relative rounded-xl overflow-hidden h-48 sm:h-64">
                  <Image src={coverImage} alt="Cover" width={800} height={400} sizes="(max-width: 1200px) 100vw, 800px" quality={85} priority className="object-cover w-full h-full" />
                  <button onClick={() => setCoverImage("")} className="absolute top-3 right-3 px-3 py-1.5 bg-white/90 backdrop-blur-sm text-[#0a0a0a] text-xs font-medium rounded-lg hover:bg-white transition-colors">Remove</button>
                </div>
              ) : (
                <div>
                  <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
                  <button onClick={() => coverInputRef.current?.click()} disabled={coverUploading}
                    className="w-full h-36 rounded-xl border-2 border-dashed border-[#e5e5e5] hover:border-[#d5d5d5] transition-colors flex flex-col items-center justify-center gap-2 text-[#737373] cursor-pointer disabled:opacity-50">
                    {coverUploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <ImagePlus className="w-6 h-6" />}
                    <span className="text-sm">{coverUploading ? "Uploading..." : "Add cover image"}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Title + AI suggest button */}
            <div className="relative mb-3">
              <div className="flex items-start gap-2">
                <input
                  ref={titleRef}
                  type="text"
                  value={title}
                  onChange={e => { setTitle(e.target.value); if (!editingId) setSlug(autoSlug(e.target.value)); setShowTitles(false); }}
                  placeholder="Article title"
                  className="flex-1 text-3xl font-bold text-[#0a0a0a] placeholder-[#d5d5d5] outline-none"
                  autoFocus={!editId}
                />
                <button
                  onClick={handleSuggestTitles}
                  disabled={loadingTitles}
                  title="AI title suggestions"
                  className="mt-2 flex-shrink-0 p-2 rounded-lg hover:bg-[#f5f5f5] text-[#a3a3a3] hover:text-[#525252] transition-colors disabled:opacity-50"
                >
                  {loadingTitles ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                </button>
              </div>

              {/* Title suggestions dropdown */}
              <AnimatePresence>
                {showTitles && (
                  <motion.div ref={titlesDropdownRef}
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                    transition={{ type: "spring", duration: 0.2, bounce: 0 }}
                    className="absolute left-0 right-8 top-full mt-2 bg-white border border-[#e5e5e5] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] overflow-hidden z-30"
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[#f5f5f5]">
                      <span className="text-xs font-semibold text-[#525252]">AI title suggestions</span>
                      <button onClick={() => setShowTitles(false)}><X className="w-3.5 h-3.5 text-[#a3a3a3]" /></button>
                    </div>
                    {loadingTitles ? (
                      <div className="flex items-center justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-[#a3a3a3]" /></div>
                    ) : titleSuggestions.length === 0 ? (
                      <p className="text-xs text-[#a3a3a3] text-center py-6">Write some content first to get better suggestions.</p>
                    ) : (
                      titleSuggestions.map((t, i) => (
                        <button key={i} onMouseDown={() => { setTitle(t); if (!editingId) setSlug(autoSlug(t)); setShowTitles(false); }}
                          className="w-full text-left px-4 py-3 text-sm text-[#0a0a0a] hover:bg-[#fafafa] transition-colors border-b border-[#f9f9f9] last:border-0">
                          {t}
                        </button>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <input type="text" value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="Add a subtitle..." className="w-full text-lg text-[#525252] placeholder-[#d5d5d5] outline-none mb-4" />

            {/* Generate outline button — shown when editor is empty */}
            {!content.replace(/<[^>]*>/g, "").trim() && title.trim() && (
              <button
                onClick={handleGenerateOutline}
                disabled={loadingOutline}
                className="mb-6 flex items-center gap-2 px-4 py-2 rounded-full border border-dashed border-[#e5e5e5] text-xs text-[#a3a3a3] hover:border-[#F44444] hover:text-[#F44444] transition-colors disabled:opacity-50"
              >
                {loadingOutline ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                Generate article outline
              </button>
            )}

            {/* Rich editor */}
            {user && (
              <RichEditor
                ref={editorRef}
                value={content}
                onChange={setContent}
                userId={user.id}
                onSelectionChange={handleSelectionChange}
              />
            )}

            {/* Footer bar */}
            <div className="flex items-center gap-4 py-3 border-t border-[#e5e5e5] mt-4 text-xs text-[#a3a3a3]">
              <span className={goalPct !== null && goalPct >= 100 ? "text-[#22c55e] font-medium" : ""}>{wordCount} words</span>
              <span>{readTime} min read</span>
              {readability && (
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: readability.color }} />
                  <span style={{ color: readability.color }}>{readability.label}</span>
                  <span className="text-[#d0d0d0]">· Grade {readability.grade}</span>
                </span>
              )}

              {/* Word count goal */}
              {wordGoal && goalPct !== null ? (
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-[#f0f0f0] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${goalPct}%`, backgroundColor: goalPct >= 100 ? "#22c55e" : goalPct >= 60 ? "#F59E0B" : "#F44444" }} />
                  </div>
                  <span className={goalPct >= 100 ? "text-[#22c55e]" : ""}>{goalPct}% of {wordGoal}</span>
                  <button onClick={() => { setWordGoal(null); setWordGoalInput(""); }} className="hover:text-[#F44444] transition-colors"><X className="w-3 h-3" /></button>
                </div>
              ) : editingGoal ? (
                <div className="flex items-center gap-1">
                  <input type="number" value={wordGoalInput} onChange={e => setWordGoalInput(e.target.value)} placeholder="Goal"
                    onKeyDown={e => { if (e.key === "Enter") { const n = parseInt(wordGoalInput); if (n > 0) { setWordGoal(n); setEditingGoal(false); } } if (e.key === "Escape") setEditingGoal(false); }}
                    className="w-20 px-2 py-0.5 rounded-lg bg-[#fafafa] border border-[#e5e5e5] text-xs outline-none focus:border-[#F44444] transition-all" autoFocus />
                  <button onClick={() => { const n = parseInt(wordGoalInput); if (n > 0) { setWordGoal(n); setEditingGoal(false); } }} className="text-[#F44444] font-medium hover:underline">Set</button>
                  <button onClick={() => setEditingGoal(false)} className="hover:text-[#525252]"><X className="w-3 h-3" /></button>
                </div>
              ) : (
                <button onClick={() => setEditingGoal(true)} className="hover:text-[#525252] transition-colors">Set goal</button>
              )}

              {publishError && <span className="text-[#F44444] ml-auto">{publishError}</span>}
            </div>
          </div>

          {/* ── Right settings panel ─────────────────────────────────────────── */}
          <AnimatePresence>
            {!focusMode && (
              <motion.div
                initial={{ width: 0, opacity: 0 }} animate={{ width: 256, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 280, damping: 28 }}
                className="hidden lg:block flex-shrink-0 border-l border-[#f0f0f0] overflow-hidden"
              >
                <div className="p-4 space-y-5 sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto w-64">

                  {/* Language */}
                  <div>
                    <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-2">Language</p>
                    <div className="relative">
                      <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full appearance-none px-3 py-2 rounded-lg bg-[#fafafa] border border-[#e5e5e5] text-xs text-[#0a0a0a] outline-none focus:border-[#F44444] transition-all cursor-pointer">
                        {[["en","English"],["hi","Hindi"],["ta","Tamil"],["te","Telugu"],["bn","Bengali"],["mr","Marathi"],["ar","Arabic"],["fr","French"],["de","German"],["es","Spanish"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"><svg className="w-3 h-3 text-[#a3a3a3]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></div>
                    </div>
                  </div>

                  {/* Section */}
                  <div>
                    <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-2">Section</p>
                    <div className="relative">
                      <select value={sectionId ? String(sectionId) : ""} onChange={e => setSectionId(e.target.value ? Number(e.target.value) : null)} className="w-full appearance-none px-3 py-2 rounded-lg bg-[#fafafa] border border-[#e5e5e5] text-xs text-[#0a0a0a] outline-none focus:border-[#F44444] transition-all cursor-pointer">
                        <option value="">{sections.length ? "None" : "Add in Settings →"}</option>
                        {sections.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                      </select>
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"><svg className="w-3 h-3 text-[#a3a3a3]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></div>
                    </div>
                  </div>

                  {/* Schedule */}
                  <div>
                    <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-2">Schedule</p>
                    <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[#fafafa] border border-[#e5e5e5] text-xs text-[#0a0a0a] outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all cursor-pointer" />
                  </div>

                  {/* Tags + AI suggestions */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider">Tags</p>
                      <button onClick={handleSuggestTags} disabled={loadingTagSuggestions || !title.trim()} title="AI tag suggestions" className="flex items-center gap-1 text-[10px] text-[#a3a3a3] hover:text-[#525252] transition-colors disabled:opacity-40">
                        {loadingTagSuggestions ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                        Suggest
                      </button>
                    </div>
                    <TagInput tags={tags} onChange={setTags} />
                    {tagSuggestions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {tagSuggestions.map(t => (
                          <button key={t} onMouseDown={() => { setTags(prev => prev.includes(t) ? prev : [...prev, t]); setTagSuggestions(prev => prev.filter(s => s !== t)); }}
                            className="px-2 py-0.5 rounded-full text-[11px] border border-dashed border-[#d0d0d0] text-[#737373] hover:border-[#F44444] hover:text-[#F44444] transition-colors">
                            + {t}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-[#f0f0f0]" />

                  {/* SEO */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider">SEO</p>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[10px] font-medium text-[#737373]">URL Slug</label>
                        <button onClick={handleGenerateSlug} disabled={loadingSlug || !title.trim()} title="AI slug" className="flex items-center gap-1 text-[10px] text-[#a3a3a3] hover:text-[#525252] transition-colors disabled:opacity-40">
                          {loadingSlug ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                          Generate
                        </button>
                      </div>
                      <input type="text" value={slug} onChange={e => setSlug(e.target.value)} placeholder="article-url-slug" className="w-full px-3 py-2 rounded-lg bg-[#fafafa] border border-[#e5e5e5] text-xs outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all font-mono" />
                      {slug && <p className="text-[10px] text-[#a3a3a3] mt-1 truncate">/{slug}</p>}
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[10px] font-medium text-[#737373]">Meta description</label>
                        <button onClick={handleGenerateMeta} disabled={loadingMeta || !title.trim()} title="AI meta" className="flex items-center gap-1 text-[10px] text-[#a3a3a3] hover:text-[#525252] transition-colors disabled:opacity-40">
                          {loadingMeta ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                          Generate
                        </button>
                      </div>
                      <textarea value={seoDescription} onChange={e => setSeoDescription(e.target.value)} placeholder="For search engines..." rows={3} className="w-full px-3 py-2 rounded-lg bg-[#fafafa] border border-[#e5e5e5] text-xs outline-none resize-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all" />
                      <span className={`text-[10px] mt-0.5 block ${seoDescription.length > 140 ? "text-[#F44444]" : "text-[#a3a3a3]"}`}>{seoDescription.length}/160</span>
                    </div>
                  </div>

                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Outline modal ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showOutline && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[150] bg-black/40 backdrop-blur-sm" onClick={() => setShowOutline(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              className="fixed z-[151] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f0f0]">
                <div>
                  <p className="text-sm font-semibold text-[#0a0a0a]">Article outline</p>
                  <p className="text-xs text-[#a3a3a3] mt-0.5">AI-generated structure for &ldquo;{title}&rdquo;</p>
                </div>
                <button onClick={() => setShowOutline(false)} className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors">
                  <X className="w-4 h-4 text-[#737373]" />
                </button>
              </div>

              <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
                {loadingOutline ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Loader2 className="w-5 h-5 text-[#a3a3a3] animate-spin" />
                    <p className="text-xs text-[#a3a3a3]">Generating outline…</p>
                  </div>
                ) : outlineItems.length === 0 ? (
                  <p className="text-sm text-[#a3a3a3] text-center py-8">Could not generate outline. Try adding more context to your title.</p>
                ) : (
                  <div className="space-y-1">
                    {outlineItems.map((item, i) => (
                      <div key={i} className={`flex items-start gap-3 py-2 ${item.level === 3 ? "pl-6" : ""}`}>
                        <div className="flex-shrink-0 mt-1">
                          {item.level === 2
                            ? <div className="w-2 h-2 rounded-full bg-[#F44444]" />
                            : <div className="w-1.5 h-1.5 rounded-full bg-[#d0d0d0]" />
                          }
                        </div>
                        <span className={item.level === 2
                          ? "text-sm font-semibold text-[#0a0a0a]"
                          : "text-sm text-[#525252]"
                        }>{item.text}</span>
                        <span className="ml-auto flex-shrink-0 text-[10px] font-medium text-[#c0c0c0] mt-0.5">
                          H{item.level}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!loadingOutline && outlineItems.length > 0 && (
                <div className="flex gap-2 px-6 py-4 border-t border-[#f0f0f0]">
                  <button onClick={() => { setOutlineItems([]); handleGenerateOutline(); }}
                    className="px-4 py-2 rounded-full border border-[#e5e5e5] text-xs text-[#737373] hover:bg-[#fafafa] transition-colors flex items-center gap-1.5">
                    <Wand2 className="w-3 h-3" />Regenerate
                  </button>
                  <button onClick={insertOutline}
                    className="flex-1 py-2 rounded-full bg-[#F44444] text-white text-xs font-medium hover:bg-[#d64d3c] transition-colors">
                    Insert into editor
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Improve writing floating toolbar ──────────────────────────────────── */}
      <AnimatePresence>
        {improveState && !improveState.loading && !improveState.result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 4 }}
            transition={{ type: "spring", duration: 0.18, bounce: 0 }}
            style={{ position: "fixed", top: improveState.rect.top, left: Math.max(8, Math.min(improveState.rect.left - 120, window.innerWidth - 260)), zIndex: 100 }}
            className="bg-[#0a0a0a] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.25)] flex items-center overflow-hidden"
          >
            <span className="text-[10px] text-[#737373] px-3">Improve</span>
            {[
              { tone: "shorten", label: "Shorten", icon: <Scissors className="w-3 h-3" /> },
              { tone: "grammar", label: "Fix grammar", icon: <SpellCheck className="w-3 h-3" /> },
              { tone: "professional", label: "Professional", icon: <Briefcase className="w-3 h-3" /> },
              { tone: "casual", label: "Casual", icon: <MessageCircle className="w-3 h-3" /> },
            ].map(({ tone, label, icon }) => (
              <button key={tone} onMouseDown={e => { e.preventDefault(); handleImprove(tone, label); }}
                className="flex items-center gap-1.5 px-3 py-2.5 text-xs text-white hover:bg-white/10 transition-colors border-l border-white/10">
                {icon}{label}
              </button>
            ))}
            <button onMouseDown={e => { e.preventDefault(); setImproveState(null); }} className="p-2.5 text-[#737373] hover:text-white transition-colors border-l border-white/10">
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Improve — loading */}
      <AnimatePresence>
        {improveState?.loading && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", top: improveState.rect.top, left: Math.max(8, Math.min(improveState.rect.left - 120, window.innerWidth - 260)), zIndex: 100 }}
            className="bg-[#0a0a0a] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.25)] px-4 py-2.5 flex items-center gap-2"
          >
            <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
            <span className="text-xs text-white">{improveState.action}…</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Improve — result preview */}
      <AnimatePresence>
        {improveState?.result && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[90]" onClick={() => setImproveState(null)} />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ type: "spring", duration: 0.2, bounce: 0 }}
              style={{ position: "fixed", top: Math.min(improveState.rect.top, window.innerHeight - 280), left: Math.max(8, Math.min(improveState.rect.left - 160, window.innerWidth - 360)), zIndex: 100 }}
              className="bg-white border border-[#e5e5e5] rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] w-[340px] overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-[#f0f0f0]">
                <p className="text-xs font-semibold text-[#0a0a0a]">{improveState.action}</p>
                <p className="text-[10px] text-[#a3a3a3] mt-0.5">Review the change before applying</p>
              </div>
              <div className="p-4 space-y-3 max-h-52 overflow-y-auto">
                <div>
                  <p className="text-[10px] font-medium text-[#a3a3a3] mb-1">Original</p>
                  <p className="text-xs text-[#737373] line-through leading-relaxed">{improveState.text}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-[#22c55e] mb-1">Improved</p>
                  <p className="text-xs text-[#0a0a0a] leading-relaxed">{improveState.result}</p>
                </div>
              </div>
              <div className="flex gap-2 px-4 py-3 border-t border-[#f0f0f0]">
                <button onClick={() => setImproveState(null)} className="flex-1 py-2 rounded-lg border border-[#e5e5e5] text-xs text-[#737373] hover:bg-[#fafafa] transition-colors">Discard</button>
                <button onClick={applyImprovement} className="flex-1 py-2 rounded-lg bg-[#0a0a0a] text-white text-xs font-medium hover:bg-[#262626] transition-colors">Apply</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Preview slide-over ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showPreview && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[150] bg-black/40 backdrop-blur-sm" onClick={() => setShowPreview(false)} />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="fixed right-0 top-0 bottom-0 z-[151] w-full max-w-2xl bg-white shadow-2xl overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-[#f0f0f0] px-6 py-3 flex items-center justify-between z-10">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[#737373]" />
                  <span className="text-sm font-medium text-[#0a0a0a]">Preview</span>
                </div>
                <button onClick={() => setShowPreview(false)} className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors"><X className="w-4 h-4 text-[#737373]" /></button>
              </div>
              <div className="px-8 py-8 max-w-[680px] mx-auto">
                {tags.length > 0 && <div className="flex items-center gap-2 mb-4 flex-wrap">{tags.map(t => <span key={t} className="text-[11px] font-medium text-[#F44444] uppercase tracking-wide">{t}</span>)}</div>}
                {title ? <h1 className="text-3xl font-bold text-[#0a0a0a] leading-tight mb-3">{title}</h1> : <div className="h-9 bg-[#f5f5f5] rounded mb-3 w-3/4" />}
                {subtitle && <p className="text-lg text-[#525252] leading-relaxed mb-6">{subtitle}</p>}
                <div className="flex items-center gap-2 mb-6 pb-6 border-b border-[#f0f0f0]">
                  {user?.avatar ? <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover" /> : <div className="w-8 h-8 rounded-full bg-[#F44444]/10 flex items-center justify-center"><span className="text-xs font-semibold text-[#F44444]">{user?.name?.[0]?.toUpperCase()}</span></div>}
                  <div><p className="text-sm font-semibold text-[#0a0a0a]">{user?.name}</p><p className="text-xs text-[#a3a3a3]">Draft · {readTime} min read</p></div>
                </div>
                {coverImage && <div className="rounded-2xl overflow-hidden mb-8 aspect-video relative bg-[#f5f5f5]"><Image src={coverImage} alt={title || "Cover"} fill className="object-cover" sizes="680px" quality={85} /></div>}
                {content && content !== "<p></p>" ? <div className="ProseMirror text-[#262626] text-base leading-7" dangerouslySetInnerHTML={{ __html: content }} /> : <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-4 bg-[#f5f5f5] rounded" style={{ width: `${85 - i * 7}%` }} />)}</div>}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Keyboard shortcuts overlay ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showShortcuts && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm" onClick={() => setShowShortcuts(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="fixed z-[201] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f0f0]">
                <p className="text-sm font-semibold text-[#0a0a0a]">Keyboard shortcuts</p>
                <button onClick={() => setShowShortcuts(false)} className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors"><X className="w-4 h-4 text-[#737373]" /></button>
              </div>
              <div className="p-6 grid grid-cols-2 gap-x-8 gap-y-2.5">
                {SHORTCUTS.map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-xs text-[#737373]">{label}</span>
                    <kbd className="text-[10px] font-medium text-[#525252] bg-[#f5f5f5] px-2 py-0.5 rounded-md border border-[#e5e5e5]">{key}</kbd>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default function WriteArticlePage() {
  return (
    <Suspense fallback={<div className="h-full flex items-center justify-center"><Loader2 className="w-5 h-5 text-[#a3a3a3] animate-spin" /></div>}>
      <WriteArticleContent />
    </Suspense>
  );
}
