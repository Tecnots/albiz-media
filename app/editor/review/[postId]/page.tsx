"use client";

import { useEffect, useState, use, useRef } from "react";
import { ArrowLeft, Loader2, Check, AlertCircle, ChevronDown, Calendar, X } from "lucide-react";
import Link from "next/link";
import { sanitizeHtml } from '@/lib/html-sanitize';

interface EditorNote {
  id: number;
  note: string;
  type: string;
  priority: string;
  resolvedAt: string | null;
  resolvedBy: number | null;
  createdAt: string;
  editor: { id: number; name: string; avatar: string };
}

interface Article {
  id: number;
  title: string | null;
  description: string | null;
  image: string | null;
  status: string;
  sectionId: number | null;
  canPublish: boolean;
  tags: string[];
  language: string;
  createdAt: string;
  date: string;
  publishAt: string | null;
  scheduleJobId: string | null;
  user: { id: number; name: string; avatar: string; handle: string; title: string };
  section: { id: number; name: string; color: string } | null;
  articleContent: { paragraphs: string[] } | null;
  editorNotes: EditorNote[];
}

const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  revision_requested: "Revision requested",
  approved: "Approved",
  scheduled: "Scheduled",
  published: "Published",
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  submitted: { bg: "#EFF6FF", text: "#3B82F6" },
  under_review: { bg: "#FFFBEB", text: "#D97706" },
  revision_requested: { bg: "#FFF5F5", text: "#F44444" },
  approved: { bg: "#F0FDF4", text: "#16a34a" },
  scheduled: { bg: "#EEF2FF", text: "#6366F1" },
  published: { bg: "#F0FDF4", text: "#16a34a" },
};

const NOTE_TYPES = [
  { value: "general",   label: "General",   color: "#525252", bg: "#f5f5f5" },
  { value: "factual",   label: "Factual",   color: "#D97706", bg: "#FFFBEB" },
  { value: "style",     label: "Style",     color: "#8B5CF6", bg: "#F5F3FF" },
  { value: "grammar",   label: "Grammar",   color: "#0EA5E9", bg: "#F0F9FF" },
  { value: "structure", label: "Structure", color: "#F44444", bg: "#FFF5F5" },
];

const TEMPLATES = [
  "The lead paragraph is too long — aim for 2–3 sentences.",
  "This statistic needs a source or citation.",
  "Rewrite in active voice — avoid passive constructions.",
  "Section heading doesn't match the content below it.",
  "Good structure overall — tighten the closing paragraph.",
  "This claim needs further evidence or examples.",
  "The transition between paragraphs feels abrupt.",
  "Great piece — minor polish needed before publish.",
];

// Keyword → note type heuristic. First matching type wins (order matters).
// Single words match whole-word only; entries with a space/hyphen match as a phrase.
const TYPE_KEYWORDS: { type: string; words: string[] }[] = [
  {
    type: "factual",
    words: [
      "source", "sources", "sourced", "citation", "citations", "cite", "cited",
      "reference", "references", "referenced", "attribution", "attribute", "attributed",
      "statistic", "statistics", "stat", "stats", "data", "figure", "figures",
      "fact", "facts", "factual", "claim", "claims", "evidence", "proof",
      "verify", "verified", "unverified", "accuracy", "accurate", "inaccurate",
      "number", "numbers", "percentage", "percent", "quote", "quotes", "quotation",
      "study", "studies", "research", "report", "reports", "confirm", "confirmed",
      "misleading", "wrong", "incorrect", "outdated", "back up", "backed up",
    ],
  },
  {
    type: "grammar",
    words: [
      "grammar", "grammatical", "spelling", "spell", "spelled", "misspell", "misspelled",
      "typo", "typos", "punctuation", "comma", "commas", "period", "apostrophe",
      "tense", "tenses", "plural", "singular", "capitalization", "capitalize",
      "capitalized", "hyphen", "hyphenation", "semicolon", "colon", "syntax",
      "agreement", "preposition", "article", "subject-verb",
    ],
  },
  {
    type: "structure",
    words: [
      "structure", "structural", "heading", "headings", "headline", "subheading",
      "subheadings", "section", "sections", "paragraph", "paragraphs", "transition",
      "transitions", "flow", "order", "ordering", "sequence", "intro", "introduction",
      "conclusion", "ending", "outline", "organize", "organized", "organization",
      "layout", "lede", "lead", "format", "formatting", "break", "breaks",
      "bullet", "bullets", "list", "lists", "pacing", "scattered", "disjointed",
    ],
  },
  {
    type: "style",
    words: [
      "tone", "voice", "passive", "active", "wording", "phrasing", "phrase",
      "concise", "conciseness", "verbose", "verbosity", "wordy", "redundant",
      "repetitive", "repetition", "style", "clarity", "clear", "unclear",
      "awkward", "clunky", "readability", "readable", "jargon", "cliche", "cliché",
      "formal", "informal", "casual", "vague", "rewrite", "reword", "tighten",
      "simplify", "flowery", "rambling", "filler", "fluff", "word choice",
    ],
  },
];

function detectType(text: string): string | null {
  const lower = text.toLowerCase();
  const tokens = new Set(lower.split(/[^a-z0-9]+/).filter(Boolean));
  for (const { type, words } of TYPE_KEYWORDS) {
    for (const w of words) {
      const matched = w.includes(" ") || w.includes("-")
        ? lower.includes(w)        // phrase: substring match
        : tokens.has(w);           // single word: whole-word match
      if (matched) return type;
    }
  }
  return null;
}

// Cheap fuzzy: every query word must appear somewhere in the template.
function matchTemplate(template: string, query: string): boolean {
  const t = template.toLowerCase();
  return query.toLowerCase().split(/\s+/).filter(Boolean).every(w => t.includes(w));
}

const FREQ_KEY = "editor_note_frequency";

function recordNoteUse(text: string) {
  if (typeof window === "undefined") return;
  const trimmed = text.trim();
  if (trimmed.length < 8) return; // skip trivial notes
  try {
    const map: Record<string, number> = JSON.parse(localStorage.getItem(FREQ_KEY) || "{}");
    map[trimmed] = (map[trimmed] || 0) + 1;
    localStorage.setItem(FREQ_KEY, JSON.stringify(map));
  } catch {
    // ignore quota / parse errors
  }
}

function getFrequentNotes(limit = 4): string[] {
  if (typeof window === "undefined") return [];
  try {
    const map: Record<string, number> = JSON.parse(localStorage.getItem(FREQ_KEY) || "{}");
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([text]) => text);
  } catch {
    return [];
  }
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ReviewPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = use(params);
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [note, setNote] = useState("");
  const [noteType, setNoteType] = useState("general");
  const [notePriority, setNotePriority] = useState("minor");
  const [typeManual, setTypeManual] = useState(false);
  const [frequentNotes, setFrequentNotes] = useState<string[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [personalTemplates, setPersonalTemplates] = useState<string[]>([]);
  const defaultType = useRef("general");
  const defaultPriority = useRef("minor");
  const templatesRef = useRef<HTMLDivElement>(null);
  const notesEndRef = useRef<HTMLDivElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [sendingNote, setSendingNote] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [unscheduling, setUnscheduling] = useState(false);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [actionDone, setActionDone] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/editor/article/${postId}`)
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(d => setArticle(d.article))
      .catch(() => setError("Article not found or you don't have access."))
      .finally(() => setLoading(false));
  }, [postId]);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (templatesRef.current && !templatesRef.current.contains(e.target as Node)) {
        setShowTemplates(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  useEffect(() => {
    setFrequentNotes(getFrequentNotes());

    fetch("/api/editor/preferences")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.preferences) return;
        defaultType.current = d.preferences.defaultNoteType;
        defaultPriority.current = d.preferences.defaultNotePriority;
        // Seed the composer with the editor's defaults (composer is still empty here).
        setNoteType(d.preferences.defaultNoteType);
        setNotePriority(d.preferences.defaultNotePriority);
      });

    fetch("/api/editor/templates")
      .then(r => r.ok ? r.json() : { templates: [] })
      .then(d => setPersonalTemplates((d.templates ?? []).map((t: { text: string }) => t.text)));
  }, []);

  // Auto-detect note type from what the editor writes, unless they picked one.
  // Emptying the box clears the manual override so the next note auto-detects again.
  const handleNoteChange = (value: string) => {
    setNote(value);
    if (!value.trim()) {
      setTypeManual(false);
      setNoteType(defaultType.current);
      return;
    }
    if (!typeManual) {
      const detected = detectType(value);
      setNoteType(detected ?? "general");
    }
  };

  const pickType = (value: string) => {
    setNoteType(value);
    setTypeManual(true);
  };

  // Reset compose state after a note leaves the box — back to the editor's defaults.
  const clearCompose = () => {
    setNote("");
    setTypeManual(false);
    setNoteType(defaultType.current);
    setNotePriority(defaultPriority.current);
  };

  // Personal templates first, then the built-in set.
  const allTemplates = [...personalTemplates, ...TEMPLATES];
  const filteredTemplates = note.trim()
    ? allTemplates.filter(t => matchTemplate(t, note))
    : allTemplates;

  const scrollToBottom = () => {
    setTimeout(() => notesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const appendNote = (newNote: EditorNote) => {
    setArticle(prev => prev ? { ...prev, editorNotes: [...prev.editorNotes, newNote] } : prev);
    scrollToBottom();
  };

  const buildPayload = (action: string) => ({
    action,
    note: note.trim() || undefined,
    type: noteType,
    priority: notePriority,
  });

  const submitReview = async (action: "start_review" | "request_revision" | "approve") => {
    if (action === "request_revision" && !note.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/editor/article/${postId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(action)),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed"); return; }
      setActionDone(action);
      setArticle(prev => prev ? { ...prev, status: data.status } : prev);
      if (data.note) appendNote(data.note);
      if (note.trim()) { recordNoteUse(note); setFrequentNotes(getFrequentNotes()); }
      clearCompose();
    } finally {
      setSubmitting(false);
    }
  };

  const sendStandaloneNote = async () => {
    if (!note.trim()) return;
    setSendingNote(true);
    try {
      const res = await fetch(`/api/editor/article/${postId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload("note_only")),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed"); return; }
      if (data.note) appendNote(data.note);
      recordNoteUse(note); setFrequentNotes(getFrequentNotes());
      clearCompose();
      setActionDone("note_sent");
      setTimeout(() => setActionDone(null), 2500);
    } finally {
      setSendingNote(false);
    }
  };

  const publish = async () => {
    setPublishing(true);
    try {
      const res = await fetch(`/api/editor/article/${postId}/publish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed"); return; }
      setActionDone("publish");
      setArticle(prev => prev ? { ...prev, status: "published" } : prev);
    } finally {
      setPublishing(false);
    }
  };

  const scheduleArticle = async () => {
    if (!scheduleDate) return;
    setScheduling(true);
    try {
      const publishAt = new Date(scheduleDate).toISOString();
      const res = await fetch(`/api/editor/article/${postId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publishAt }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed"); return; }
      setShowSchedulePicker(false);
      setScheduleDate("");
      setActionDone("scheduled");
      setArticle(prev => prev ? { ...prev, status: "scheduled", publishAt: data.publishAt } : prev);
    } finally {
      setScheduling(false);
    }
  };

  const unscheduleArticle = async () => {
    setUnscheduling(true);
    try {
      const res = await fetch(`/api/editor/article/${postId}/unschedule`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed"); return; }
      setActionDone("unscheduled");
      setArticle(prev => prev ? { ...prev, status: "approved", publishAt: null } : prev);
    } finally {
      setUnscheduling(false);
    }
  };

  const toggleResolve = async (noteId: number, currentlyResolved: boolean) => {
    setResolvingId(noteId);
    try {
      const res = await fetch(`/api/editor/article/${postId}/note/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved: !currentlyResolved }),
      });
      const data = await res.json();
      if (!res.ok) return;
      setArticle(prev => prev
        ? {
            ...prev,
            editorNotes: prev.editorNotes.map(n =>
              n.id === noteId ? { ...n, resolvedAt: data.note.resolvedAt, resolvedBy: data.note.resolvedBy } : n
            ),
          }
        : prev
      );
    } finally {
      setResolvingId(null);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-[#a3a3a3] animate-spin" />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="p-8">
        <Link href="/editor/queue" className="flex items-center gap-1.5 text-xs text-[#a3a3a3] hover:text-[#525252] mb-6">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to queue
        </Link>
        <p className="text-sm text-[#737373]">{error || "Article not found."}</p>
      </div>
    );
  }

  const sc = STATUS_COLORS[article.status] ?? STATUS_COLORS.submitted;
  const canAct = article.status !== "published";
  const resolvedCount = article.editorNotes.filter(n => n.resolvedAt).length;

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* ── Top bar ── */}
      <div className="flex-shrink-0 border-b border-[#f0f0f0] px-8 py-4">
        <Link href="/editor/queue" className="flex items-center gap-1.5 text-xs text-[#a3a3a3] hover:text-[#525252] mb-3 w-fit">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to queue
        </Link>
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-[#0a0a0a] leading-snug truncate">{article.title ?? "Untitled"}</h1>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-[#f0f0f0] overflow-hidden flex-shrink-0">
                  {article.user.avatar && <img src={article.user.avatar} alt="" className="w-full h-full object-cover" />}
                </div>
                <span className="text-xs text-[#525252]">{article.user.name}</span>
              </div>
              {article.section && (
                <span className="flex items-center gap-1 text-xs text-[#737373]">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: article.section.color }} />
                  {article.section.name}
                </span>
              )}
              {article.tags.slice(0, 3).map(tag => (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-[#f5f5f5] text-[#737373]">{tag}</span>
              ))}
            </div>
          </div>
          <span className="flex-shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full" style={{ background: sc.bg, color: sc.text }}>
            {STATUS_LABELS[article.status] ?? article.status}
          </span>
        </div>
      </div>

      {/* ── Body: article left + notes right ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Article content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 lg:p-8 max-w-[1400px]">
            {article.image && (
              <img src={article.image} alt="" className="w-full rounded-xl mb-6 object-cover max-h-72" />
            )}
            {article.description && (
              <p className="text-sm text-[#737373] mb-5 leading-relaxed">{article.description}</p>
            )}
            {article.articleContent?.paragraphs && article.articleContent.paragraphs.length > 0 ? (
              <div
                className="prose prose-sm max-w-none text-[#0a0a0a] leading-relaxed [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4 [&_li]:mb-1 [&_blockquote]:border-l-2 [&_blockquote]:border-[#e5e5e5] [&_blockquote]:pl-4 [&_blockquote]:text-[#737373] [&_a]:text-[#0EA5E9] [&_strong]:font-semibold"
                dangerouslySetInnerHTML={{ __html: article.articleContent.paragraphs.map(sanitizeHtml).join("") }}
              />
            ) : (
              <p className="text-sm text-[#a3a3a3]">No content.</p>
            )}
          </div>
        </div>

        {/* Notes panel */}
        <div className="w-[420px] flex-shrink-0 border-l border-[#f0f0f0] flex flex-col bg-white">

          {/* Notes header */}
          <div className="flex-shrink-0 px-5 py-4 border-b border-[#f0f0f0] flex items-center justify-between">
            <span className="text-sm font-semibold text-[#0a0a0a]">Notes</span>
            {article.editorNotes.length > 0 && (
              <span className="text-xs text-[#a3a3a3]">
                {resolvedCount} of {article.editorNotes.length} resolved
              </span>
            )}
          </div>

          {/* Notes thread */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {article.editorNotes.length === 0 && (
              <p className="text-sm text-[#a3a3a3] text-center mt-12">No notes yet.</p>
            )}
            {article.editorNotes.map(n => {
              const nt = NOTE_TYPES.find(t => t.value === n.type) ?? NOTE_TYPES[0];
              const isResolved = !!n.resolvedAt;
              return (
                <div
                  key={n.id}
                  className={`rounded-xl border transition-all ${
                    isResolved
                      ? "border-[#f0f0f0] bg-[#fafafa] opacity-50"
                      : n.priority === "major"
                        ? "border-[#FFD4D4] bg-white border-l-[3px] border-l-[#F44444]"
                        : "border-[#ebebeb] bg-white"
                  }`}
                >
                  {/* Card header */}
                  <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-2">
                    <div className="w-7 h-7 rounded-full bg-[#e5e5e5] overflow-hidden flex-shrink-0 flex items-center justify-center text-xs font-semibold text-[#525252]">
                      {n.editor.avatar
                        ? <img src={n.editor.avatar} alt="" className="w-full h-full object-cover" />
                        : n.editor.name?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#0a0a0a]">{n.editor.name}</span>
                        <span className="text-[10px] text-[#a3a3a3]">{timeAgo(n.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: nt.bg, color: nt.color }}
                        >
                          {nt.label}
                        </span>
                        {n.priority === "major" && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FFF0F0] text-[#F44444]">
                            Major
                          </span>
                        )}
                        {isResolved && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F0FDF4] text-[#16a34a]">
                            Resolved
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Note text */}
                  <p className={`px-4 pb-3 text-sm text-[#374151] leading-relaxed ${isResolved ? "line-through text-[#a3a3a3]" : ""}`}>
                    {n.note}
                  </p>

                  {/* Resolve button */}
                  <div className="px-4 pb-3.5">
                    <button
                      onClick={() => toggleResolve(n.id, isResolved)}
                      disabled={resolvingId === n.id}
                      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all cursor-pointer disabled:opacity-50 ${
                        isResolved
                          ? "border-[#e5e5e5] text-[#737373] hover:bg-[#f5f5f5]"
                          : "border-[#d1fae5] text-[#16a34a] bg-[#f0fdf4] hover:bg-[#dcfce7]"
                      }`}
                    >
                      {resolvingId === n.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : isResolved
                          ? <><span className="w-3 h-3 inline-block">↩</span> Unresolve</>
                          : <><Check className="w-3 h-3" /> Mark resolved</>
                      }
                    </button>
                  </div>
                </div>
              );
            })}
            <div ref={notesEndRef} />
          </div>

          {/* Compose area */}
          {canAct ? (
            <div className="flex-shrink-0 border-t border-[#f0f0f0] px-4 py-4 space-y-3 bg-[#fafafa]">

              {actionDone && (
                <div className="flex items-center gap-2 text-xs text-[#16a34a] bg-[#F0FDF4] border border-[#d1fae5] px-3 py-2 rounded-lg">
                  <Check className="w-3.5 h-3.5" />
                  {actionDone === "start_review" ? "Article is now under review."
                    : actionDone === "request_revision" ? "Revision requested — author notified."
                    : actionDone === "approve" ? "Article approved."
                    : actionDone === "publish" ? "Published."
                    : actionDone === "scheduled" ? "Article scheduled for publication."
                    : actionDone === "unscheduled" ? "Schedule cancelled — article is back in Approved."
                    : "Note sent to author."}
                </div>
              )}

              {/* Frequent notes — quick starters from this editor's history */}
              {frequentNotes.length > 0 && !note.trim() && (
                <div>
                  <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-2">Frequent</p>
                  <div className="flex flex-col gap-1.5">
                    {frequentNotes.map((t, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleNoteChange(t)}
                        className="text-left text-xs text-[#525252] bg-white border border-[#e5e5e5] rounded-lg px-3 py-2 hover:border-[#d4d4d4] hover:bg-[#fafafa] transition-colors truncate cursor-pointer"
                        title={t}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Note type */}
              <div>
                <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-2">
                  Type
                  {!typeManual && noteType !== "general" && (
                    <span className="ml-1.5 normal-case tracking-normal text-[#737373] font-medium lowercase">· auto</span>
                  )}
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {NOTE_TYPES.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => pickType(t.value)}
                      className="text-xs font-medium px-2.5 py-1 rounded-full border transition-all cursor-pointer"
                      style={
                        noteType === t.value
                          ? { background: t.bg, color: t.color, borderColor: t.color }
                          : { background: "white", color: "#737373", borderColor: "#e5e5e5" }
                      }
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority */}
              <div>
                <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-2">Priority</p>
                <div className="flex gap-1.5">
                  {(["minor", "major"] as const).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNotePriority(p)}
                      className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-all capitalize cursor-pointer ${
                        notePriority === p
                          ? p === "major"
                            ? "bg-[#FFF0F0] border-[#FFD4D4] text-[#F44444]"
                            : "bg-white border-[#d4d4d4] text-[#0a0a0a]"
                          : "bg-white border-[#e5e5e5] text-[#a3a3a3] hover:border-[#d4d4d4]"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Textarea */}
              <div className="relative" ref={templatesRef}>
                <textarea
                  value={note}
                  onChange={e => handleNoteChange(e.target.value)}
                  placeholder="Leave feedback for the author…"
                  rows={4}
                  className="w-full px-3.5 py-3 text-sm rounded-xl bg-white border border-[#e5e5e5] outline-none focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/10 resize-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowTemplates(v => !v)}
                  className="absolute bottom-3 right-3 flex items-center gap-1 text-[11px] text-[#a3a3a3] hover:text-[#525252] bg-white border border-[#e5e5e5] px-2 py-1 rounded-lg transition-colors"
                >
                  Templates <ChevronDown className="w-3 h-3" />
                </button>
                {showTemplates && (
                  <div className="absolute bottom-full right-0 mb-1 w-72 bg-white border border-[#e5e5e5] rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-20 max-h-64 overflow-y-auto">
                    {filteredTemplates.length === 0 ? (
                      <p className="px-4 py-3 text-xs text-[#a3a3a3]">No matching templates.</p>
                    ) : (
                      filteredTemplates.map((t, i) => (
                        <button
                          key={i}
                          type="button"
                          onMouseDown={() => { handleNoteChange(t); setShowTemplates(false); }}
                          className="w-full text-left px-4 py-2.5 text-xs text-[#374151] hover:bg-[#fafafa] transition-colors border-b border-[#f5f5f5] last:border-0 leading-relaxed"
                        >
                          {t}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {article.status === "submitted" && (
                  <button
                    onClick={() => submitReview("start_review")}
                    disabled={submitting}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F59E0B] text-white text-xs font-medium hover:bg-[#D97706] transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Start Review
                  </button>
                )}
                <button
                  onClick={sendStandaloneNote}
                  disabled={sendingNote || !note.trim()}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#e5e5e5] bg-white text-[#525252] text-xs font-medium hover:bg-[#f5f5f5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {sendingNote && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Send note
                </button>
                {article.status === "under_review" && (
                  <button
                    onClick={() => submitReview("request_revision")}
                    disabled={submitting || !note.trim()}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#F44444] text-[#F44444] text-xs font-medium hover:bg-[#FFF5F5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    Request revision
                  </button>
                )}
                {(article.status === "submitted" || article.status === "under_review") && (
                  <button
                    onClick={() => submitReview("approve")}
                    disabled={submitting}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#22c55e] text-[#16a34a] text-xs font-medium hover:bg-[#F0FDF4] transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Approve
                  </button>
                )}
                {article.canPublish && article.status === "approved" && (
                  <button
                    onClick={publish}
                    disabled={publishing}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0EA5E9] text-white text-xs font-medium hover:bg-[#0284c7] transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    {publishing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Publish now
                  </button>
                )}
                {article.canPublish && article.status === "approved" && (
                  <button
                    onClick={() => setShowSchedulePicker(v => !v)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#6366F1] text-[#6366F1] text-xs font-medium hover:bg-[#EEF2FF] transition-colors cursor-pointer"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Schedule
                  </button>
                )}
                {article.status === "scheduled" && (
                  <button
                    onClick={unscheduleArticle}
                    disabled={unscheduling}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#e5e5e5] text-[#737373] text-xs font-medium hover:bg-[#f5f5f5] transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    {unscheduling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                    Unschedule
                  </button>
                )}
              </div>

              {/* Schedule date picker */}
              {showSchedulePicker && (
                <div className="flex items-center gap-2 p-3 rounded-xl border border-[#6366F1]/30 bg-[#EEF2FF]">
                  <Calendar className="w-3.5 h-3.5 text-[#6366F1] flex-shrink-0" />
                  <input
                    type="datetime-local"
                    value={scheduleDate}
                    min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                    onChange={e => setScheduleDate(e.target.value)}
                    className="flex-1 text-xs bg-transparent outline-none text-[#0a0a0a]"
                  />
                  <button
                    onClick={scheduleArticle}
                    disabled={scheduling || !scheduleDate}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#6366F1] text-white text-xs font-medium hover:bg-[#4F46E5] transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    {scheduling && <Loader2 className="w-3 h-3 animate-spin" />}
                    Confirm
                  </button>
                  <button onClick={() => setShowSchedulePicker(false)} className="p-1 rounded-lg hover:bg-[#E0E7FF] transition-colors cursor-pointer">
                    <X className="w-3.5 h-3.5 text-[#6366F1]" />
                  </button>
                </div>
              )}

              {article.status === "scheduled" && article.publishAt && (
                <p className="text-xs text-[#6366F1]">
                  Scheduled for {new Date(article.publishAt).toLocaleString()}
                </p>
              )}

              {!article.canPublish && article.status === "approved" && (
                <p className="text-xs text-[#a3a3a3]">Approved — admin will publish this article.</p>
              )}
            </div>
          ) : (
            <div className="flex-shrink-0 border-t border-[#f0f0f0] px-5 py-4">
              <div className="flex items-center gap-2 text-sm text-[#16a34a] bg-[#F0FDF4] border border-[#d1fae5] px-4 py-3 rounded-xl">
                <Check className="w-4 h-4" />
                This article has been published.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
