"use client";

import { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { Node, Extension, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TipTapImageBase from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Youtube from "@tiptap/extension-youtube";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle } from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import {
  Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
  Quote, Code, Heading1, Heading2, Minus, ImagePlus, Play, Loader2, Upload,
  Undo2, Redo2, ChevronDown, X,
} from "lucide-react";

// ─── FontSize custom extension ────────────────────────────────────────────────

const FontSize = Extension.create({
  name: "fontSize",
  addOptions() { return { types: ["textStyle"] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (el: HTMLElement) => el.style.fontSize || null,
          renderHTML: (attrs: Record<string, string>) =>
            attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
        },
      },
    }];
  },
  addCommands() {
    return {
      setFontSize: (fontSize: string) => ({ chain }: any) =>
        chain().setMark("textStyle", { fontSize }).run(),
      unsetFontSize: () => ({ chain }: any) =>
        chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
    } as any;
  },
});

// ─── Google Search Widget node ────────────────────────────────────────────────

const GOOGLE_G_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>`;

const GoogleSearchWidget = Node.create({
  name: "googleSearchWidget",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      query:    { default: "" },
      title:    { default: "" },
      imageUrl: { default: "" },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-google-search]" }];
  },
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    const q = String(HTMLAttributes.query ?? "");
    const title = String(HTMLAttributes.title ?? q);
    const img = String(HTMLAttributes.imageUrl ?? "");
    const href = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
    const imgHtml = img
      ? `<img src="${img}" alt="" style="width:72px;height:72px;object-fit:cover;border-radius:6px;flex-shrink:0;" />`
      : `<div style="width:72px;height:72px;border-radius:6px;background:#f1f3f4;flex-shrink:0;display:flex;align-items:center;justify-content:center;">${GOOGLE_G_SVG}</div>`;
    const inner = `<a href="${href}" target="_blank" rel="noopener noreferrer" style="display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid #e5e5e5;border-radius:10px;text-decoration:none;background:#fff;color:inherit;">${imgHtml}<div style="min-width:0;"><div style="font-weight:600;color:#1a0dab;font-size:14px;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${title}</div><div style="display:flex;align-items:center;gap:4px;">${GOOGLE_G_SVG}<span style="font-size:11px;color:#5f6368;">www.google.com</span></div></div></a>`;
    return ["div", mergeAttributes({ "data-google-search": q, style: "margin:12px 0;" }, { innerHTML: inner })];
  },
  addNodeView() {
    return ({ node }: { node: { attrs: Record<string, string> } }) => {
      const { query, title, imageUrl } = node.attrs;
      const dom = document.createElement("div");
      dom.style.cssText = "margin:12px 0;pointer-events:none;user-select:none;";

      const inner = document.createElement("div");
      inner.style.cssText = "display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid #e5e5e5;border-radius:10px;background:#fff;";

      const imgEl = document.createElement("div");
      imgEl.style.cssText = "width:72px;height:72px;border-radius:6px;overflow:hidden;flex-shrink:0;background:#f1f3f4;display:flex;align-items:center;justify-content:center;";
      if (imageUrl) {
        const img = document.createElement("img");
        img.src = imageUrl;
        img.style.cssText = "width:100%;height:100%;object-fit:cover;";
        imgEl.appendChild(img);
      } else {
        imgEl.innerHTML = GOOGLE_G_SVG;
      }

      const info = document.createElement("div");
      info.style.cssText = "min-width:0;";
      const titleEl = document.createElement("div");
      titleEl.style.cssText = "font-weight:600;color:#1a0dab;font-size:14px;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
      titleEl.textContent = title || query;
      const meta = document.createElement("div");
      meta.style.cssText = "display:flex;align-items:center;gap:4px;";
      meta.innerHTML = `${GOOGLE_G_SVG}<span style="font-size:11px;color:#5f6368;">www.google.com</span>`;
      info.appendChild(titleEl);
      info.appendChild(meta);

      inner.appendChild(imgEl);
      inner.appendChild(info);
      dom.appendChild(inner);
      return { dom };
    };
  },
  addCommands() {
    return {
      insertGoogleSearch: (query: string, title: string, imageUrl: string) => ({ commands }: any) =>
        commands.insertContent({ type: "googleSearchWidget", attrs: { query, title, imageUrl } }),
    } as any;
  },
});

// ─── Image with style ─────────────────────────────────────────────────────────

const TipTapImage = TipTapImageBase.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: { default: "width:100%;display:block;margin:1rem auto;" },
    };
  },
});

// ─── Video upload node ────────────────────────────────────────────────────────

const VideoUpload = Node.create({
  name: "videoUpload",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      src: { default: null },
      style: { default: "width:100%;display:block;margin:1rem auto;" },
    };
  },
  parseHTML() { return [{ tag: "video[src]" }]; },
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ["video", mergeAttributes(HTMLAttributes, {
      controls: true,
      class: "rounded-xl w-full my-4 max-h-[480px] bg-[#0a0a0a]",
    })];
  },
  addCommands() {
    return {
      setVideo: (src: string) => ({ commands }: any) =>
        commands.insertContent({ type: "videoUpload", attrs: { src } }),
    } as never;
  },
});

// ─── Constants ────────────────────────────────────────────────────────────────

const FONT_GROUPS: { group: string; fonts: { label: string; value: string }[] }[] = [
  {
    group: "Sans-serif",
    fonts: [
      { label: "Arial", value: "Arial, sans-serif" },
      { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
      { label: "Verdana", value: "Verdana, sans-serif" },
      { label: "Tahoma", value: "Tahoma, Geneva, sans-serif" },
      { label: "Trebuchet MS", value: "'Trebuchet MS', sans-serif" },
      { label: "Gill Sans", value: "'Gill Sans', 'Gill Sans MT', sans-serif" },
      { label: "Optima", value: "Optima, Segoe, sans-serif" },
      { label: "Calibri", value: "Calibri, Candara, sans-serif" },
      { label: "Candara", value: "Candara, Calibri, sans-serif" },
    ],
  },
  {
    group: "Serif",
    fonts: [
      { label: "Georgia", value: "Georgia, serif" },
      { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
      { label: "Palatino", value: "'Palatino Linotype', Palatino, serif" },
      { label: "Garamond", value: "Garamond, 'EB Garamond', serif" },
      { label: "Book Antiqua", value: "'Book Antiqua', Palatino, serif" },
      { label: "Didot", value: "Didot, 'Bodoni MT', serif" },
      { label: "Baskerville", value: "Baskerville, 'Baskerville Old Face', serif" },
    ],
  },
  {
    group: "Monospace",
    fonts: [
      { label: "Courier New", value: "'Courier New', Courier, monospace" },
      { label: "Lucida Console", value: "'Lucida Console', Monaco, monospace" },
      { label: "Consolas", value: "Consolas, 'Courier New', monospace" },
    ],
  },
  {
    group: "Decorative",
    fonts: [
      { label: "Impact", value: "Impact, Charcoal, sans-serif" },
      { label: "Comic Sans MS", value: "'Comic Sans MS', cursive" },
      { label: "Cursive", value: "cursive" },
      { label: "Fantasy", value: "fantasy" },
    ],
  },
];

const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px", "36px"];

const INPUT_LANGUAGES = [
  { label: "Arabic", code: "ar-t-i0-und" },
  { label: "Hindi", code: "hi-t-i0-und" },
  { label: "Tamil", code: "ta-t-i0-und" },
  { label: "Telugu", code: "te-t-i0-und" },
  { label: "Bengali", code: "bn-t-i0-und" },
  { label: "Marathi", code: "mr-t-i0-und" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RichEditorHandle {
  replaceRange: (from: number, to: number, text: string) => void;
  setContent: (html: string) => void;
}

interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  userId: number;
  onSelectionChange?: (text: string, rect: DOMRect | null, from: number, to: number) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const RichEditor = forwardRef<RichEditorHandle, RichEditorProps>(function RichEditorInner(
  { value, onChange, userId, onSelectionChange }, ref
) {
  const imgInputRef = useRef<HTMLInputElement>(null);
  const vidInputRef = useRef<HTMLInputElement>(null);

  const [uploadingImg, setUploadingImg] = useState(false);
  const [uploadingVid, setUploadingVid] = useState(false);
  const [mediaActive, setMediaActive] = useState(false);

  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const [showVideoModal, setShowVideoModal] = useState(false);
  const [videoTab, setVideoTab] = useState<"youtube" | "upload">("youtube");
  const [youtubeUrl, setYoutubeUrl] = useState("");

  // View mode
  const [viewMode, setViewMode] = useState<"compose" | "html">("compose");
  const [htmlValue, setHtmlValue] = useState("");

  // Font state (mirrors selection)
  const [fontFamily, setFontFamily] = useState("");
  const [fontSize, setFontSize] = useState("16px");
  const [customFont, setCustomFont] = useState("");
  const [showCustomFont, setShowCustomFont] = useState(false);

  // Google Search Widget
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<{ title: string; image: string } | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // Input Tool
  const [inputTool, setInputTool] = useState<string | null>(null);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionRect, setSuggestionRect] = useState<{ top: number; left: number } | null>(null);

  const pendingWordRef = useRef("");
  const inputToolRef = useRef<string | null>(null);
  const langDropdownRef = useRef<HTMLDivElement>(null);
  const langBtnRef = useRef<HTMLButtonElement>(null);
  const [langDropdownPos, setLangDropdownPos] = useState<{ top: number; left: number } | null>(null);

  // Keep ref in sync with state for keydown handler closure
  useEffect(() => { inputToolRef.current = inputTool; }, [inputTool]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
        codeBlock: { HTMLAttributes: { class: "bg-[#f5f5f5] rounded-lg px-4 py-3 text-sm font-mono" } },
        blockquote: { HTMLAttributes: { class: "border-l-4 border-[#e5e5e5] pl-4 italic text-[#737373]" } },
      }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-[#F44444] underline cursor-pointer" } }),
      TipTapImage.configure({ inline: false, HTMLAttributes: { class: "rounded-xl max-w-full my-4" } }),
      VideoUpload,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Youtube.configure({ width: 640, height: 400, HTMLAttributes: { class: "rounded-xl overflow-hidden my-4 w-full" } }),
      Placeholder.configure({ placeholder: "Start writing your article…" }),
      TextStyle,
      FontFamily,
      FontSize,
      GoogleSearchWidget,
    ],
    content: value || "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { class: "focus:outline-none min-h-[400px] text-[#262626] text-base leading-7" },
    },
    immediatelyRender: false,
  });

  useImperativeHandle(ref, () => ({
    replaceRange: (from, to, text) => {
      editor?.chain().focus().setTextSelection({ from, to }).insertContent(text).run();
    },
    setContent: (html) => {
      editor?.commands.setContent(html, { emitUpdate: true });
    },
  }), [editor]);

  // Selection → improve toolbar
  useEffect(() => {
    if (!editor || !onSelectionChange) return;
    const handleSelection = () => {
      const { from, to } = editor.state.selection;
      if (from === to) { onSelectionChange("", null, from, to); return; }
      const selectedText = editor.state.doc.textBetween(from, to, " ");
      const sel = window.getSelection();
      const rect = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).getBoundingClientRect() : null;
      onSelectionChange(selectedText, rect, from, to);
    };
    editor.on("selectionUpdate", handleSelection);
    return () => { editor.off("selectionUpdate", handleSelection); };
  }, [editor, onSelectionChange]);

  // Sync incoming value when editing existing article
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current && value !== "<p></p>") {
      editor.commands.setContent(value || "");
    }
  }, [value]);

  // Track media node selection
  useEffect(() => {
    if (!editor) return;
    const update = () => setMediaActive(editor.isActive("image") || editor.isActive("videoUpload"));
    editor.on("transaction", update);
    editor.on("selectionUpdate", update);
    return () => { editor.off("transaction", update); editor.off("selectionUpdate", update); };
  }, [editor]);

  // Sync view mode ↔ html textarea
  const switchingRef = useRef(false);
  const handleViewMode = useCallback((mode: "compose" | "html") => {
    if (!editor || switchingRef.current) return;
    switchingRef.current = true;
    if (mode === "html") {
      setHtmlValue(editor.getHTML());
    } else {
      editor.commands.setContent(htmlValue);
    }
    setViewMode(mode);
    switchingRef.current = false;
  }, [editor, htmlValue]);

  // ─── Input Tool keydown handler ────────────────────────────────────────────

  useEffect(() => {
    if (!editor) return;
    const editorDom = editor.view.dom;

    const fetchSuggestions = async (word: string, itc: string) => {
      if (!word.trim()) return;
      try {
        const res = await fetch(
          `/api/input-tools?text=${encodeURIComponent(word)}&itc=${encodeURIComponent(itc)}`
        );
        const data = await res.json();
        // Response shape: ["SUCCESS", [[word, [sug1, sug2...]], ...]]
        const words: string[] = data?.[1]?.[0]?.[1] ?? [];
        if (words.length > 0) {
          setSuggestions(words.slice(0, 5));
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const rect = sel.getRangeAt(0).getBoundingClientRect();
            setSuggestionRect({ top: rect.bottom + 6, left: rect.left });
          }
        }
      } catch { /* silently ignore */ }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!inputToolRef.current) return;

      if (e.key === "Escape") {
        setSuggestions([]);
        setSuggestionRect(null);
        pendingWordRef.current = "";
        return;
      }

      if (e.key === " " || e.key === "Enter") {
        const word = pendingWordRef.current;
        if (word.trim()) {
          e.preventDefault();
          fetchSuggestions(word, inputToolRef.current);
        }
        return;
      }

      if (e.key === "Backspace") {
        pendingWordRef.current = pendingWordRef.current.slice(0, -1);
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        pendingWordRef.current += e.key;
      }
    };

    editorDom.addEventListener("keydown", handleKeyDown);
    return () => editorDom.removeEventListener("keydown", handleKeyDown);
  }, [editor]);

  const applySuggestion = useCallback((suggestion: string) => {
    if (!editor) return;
    const word = pendingWordRef.current;
    if (word) {
      const { from } = editor.state.selection;
      editor.chain().focus()
        .setTextSelection({ from: from - word.length, to: from })
        .insertContent(suggestion + " ")
        .run();
    }
    pendingWordRef.current = "";
    setSuggestions([]);
    setSuggestionRect(null);
  }, [editor]);

  // Close lang dropdown on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(e.target as HTMLElement) &&
          langBtnRef.current && !langBtnRef.current.contains(e.target as HTMLElement)) {
        setShowLangDropdown(false);
        setLangDropdownPos(null);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // ─── Image upload ──────────────────────────────────────────────────────────

  const handleImageFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    setUploadingImg(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("userId", String(userId));
      form.append("category", "posts");
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (res.ok) {
        const { url } = await res.json();
        editor.commands.focus();
        editor.chain().setImage({ src: url, alt: file.name }).run();
      }
    } finally {
      setUploadingImg(false);
      if (imgInputRef.current) imgInputRef.current.value = "";
    }
  }, [editor, userId]);

  // ─── Video upload ──────────────────────────────────────────────────────────

  const handleVideoFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    setUploadingVid(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("userId", String(userId));
      form.append("category", "videos");
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (res.ok) {
        const { url } = await res.json();
        editor.commands.focus();
        (editor.chain() as any).setVideo(url).run();
        setShowVideoModal(false);
      }
    } finally {
      setUploadingVid(false);
      if (vidInputRef.current) vidInputRef.current.value = "";
    }
  }, [editor, userId]);

  // ─── YouTube embed ─────────────────────────────────────────────────────────

  const handleYoutubeEmbed = useCallback(() => {
    if (!editor || !youtubeUrl.trim()) return;
    editor.chain().focus().setYoutubeVideo({ src: youtubeUrl.trim() }).run();
    setYoutubeUrl("");
    setShowVideoModal(false);
  }, [editor, youtubeUrl]);

  // ─── Link ─────────────────────────────────────────────────────────────────

  const openLinkModal = useCallback(() => {
    setLinkUrl(editor?.getAttributes("link").href ?? "");
    setShowLinkModal(true);
  }, [editor]);

  const applyLink = useCallback(() => {
    if (!editor) return;
    if (!linkUrl.trim()) {
      editor.chain().focus().unsetLink().run();
    } else if (editor.state.selection.empty) {
      editor.chain().focus().insertContent(`<a href="${linkUrl.trim()}">${linkUrl.trim()}</a>`).run();
    } else {
      editor.chain().focus().setLink({ href: linkUrl.trim() }).run();
    }
    setShowLinkModal(false);
    setLinkUrl("");
  }, [editor, linkUrl]);

  // ─── Google Search ─────────────────────────────────────────────────────────

  const fetchSearchResult = useCallback(async (query: string) => {
    if (!query.trim()) { setSearchResult(null); return; }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/google-search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSearchResult(data.title ? data : null);
    } catch {
      setSearchResult(null);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const insertSearchWidget = useCallback(() => {
    if (!editor || !searchQuery.trim()) return;
    (editor.chain().focus() as any).insertGoogleSearch(
      searchQuery.trim(),
      searchResult?.title ?? searchQuery.trim(),
      searchResult?.image ?? ""
    ).run();
    setSearchQuery("");
    setSearchResult(null);
    setShowSearchModal(false);
  }, [editor, searchQuery, searchResult]);

  if (!editor) return null;

  const btn = (active: boolean, extra = "") =>
    `p-2 rounded-lg transition-colors cursor-pointer ${active ? "bg-[#0a0a0a] text-white" : "hover:bg-[#f5f5f5] text-[#525252]"} ${extra}`;

  const selectCls = "text-xs bg-transparent border border-[#e5e5e5] rounded-lg px-2 py-1.5 text-[#525252] outline-none focus:border-[#0a0a0a] cursor-pointer hover:border-[#c5c5c5] transition-colors";

  return (
    <div className="relative">
      <input ref={imgInputRef} type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
      <input ref={vidInputRef} type="file" accept="video/*" onChange={handleVideoFile} className="hidden" />

      {/* ── View mode tabs ── */}
      <div className="flex items-center gap-1 mb-3">
        <button
          type="button"
          onClick={() => handleViewMode("compose")}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${viewMode === "compose" ? "bg-[#F44444] text-white" : "text-[#737373] hover:text-[#F44444]"}`}
        >
          Compose
        </button>
        <button
          type="button"
          onClick={() => handleViewMode("html")}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${viewMode === "html" ? "bg-[#F44444] text-white" : "text-[#737373] hover:text-[#F44444]"}`}
        >
          HTML
        </button>
      </div>

      {/* ── HTML view ── */}
      {viewMode === "html" ? (
        <textarea
          value={htmlValue}
          onChange={e => { setHtmlValue(e.target.value); onChange(e.target.value); }}
          className="w-full min-h-[400px] p-4 text-xs font-mono text-[#262626] bg-[#fafafa] border border-[#e5e5e5] rounded-xl outline-none focus:border-[#0a0a0a] transition-all resize-y leading-6"
          spellCheck={false}
        />
      ) : (
        <>
          {/* ── Toolbar ── */}
          <div className="flex items-center gap-0.5 border-b border-[#e5e5e5] py-2 mb-4 overflow-x-auto flex-nowrap scrollbar-none">

            {/* Undo / Redo */}
            <button type="button" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo (Ctrl+Z)" className={btn(false, "disabled:opacity-30")}>
              <Undo2 className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo (Ctrl+Shift+Z)" className={btn(false, "disabled:opacity-30")}>
              <Redo2 className="w-4 h-4" />
            </button>

            <div className="w-px h-5 bg-[#e5e5e5] mx-1 flex-shrink-0" />

            {/* Font Family */}
            <select
              value={fontFamily}
              onChange={e => {
                const v = e.target.value;
                setFontFamily(v);
                setShowCustomFont(false);
                if (v) editor.chain().focus().setFontFamily(v).run();
                else editor.chain().focus().unsetFontFamily().run();
              }}
              className={selectCls}
              title="Font family"
            >
              <option value="">Default</option>
              {FONT_GROUPS.map(g => (
                <optgroup key={g.group} label={g.group}>
                  {g.fonts.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>

            {/* Custom font input toggle */}
            <button
              type="button"
              onClick={() => setShowCustomFont(s => !s)}
              title="Add custom font"
              className={`text-[11px] px-2 py-1.5 rounded-lg border transition-colors cursor-pointer flex-shrink-0 ${showCustomFont ? "border-[#F44444] text-[#F44444]" : "border-[#e5e5e5] text-[#a3a3a3] hover:border-[#c5c5c5] hover:text-[#525252]"}`}
            >
              + font
            </button>
            {showCustomFont && (
              <input
                type="text"
                value={customFont}
                onChange={e => setCustomFont(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && customFont.trim()) {
                    const v = customFont.trim();
                    setFontFamily(v);
                    editor.chain().focus().setFontFamily(v).run();
                    setShowCustomFont(false);
                    setCustomFont("");
                  }
                  if (e.key === "Escape") { setShowCustomFont(false); setCustomFont(""); }
                }}
                placeholder="e.g. Roboto, sans-serif"
                className="w-40 px-2 py-1.5 text-xs border border-[#F44444] rounded-lg outline-none text-[#0a0a0a] placeholder:text-[#c5c5c5]"
                autoFocus
              />
            )}

            {/* Font Size */}
            <select
              value={fontSize}
              onChange={e => {
                const v = e.target.value;
                setFontSize(v);
                (editor.chain().focus() as any).setFontSize(v).run();
              }}
              className={`${selectCls} w-[68px]`}
              title="Font size"
            >
              {FONT_SIZES.map(s => <option key={s} value={s}>{s.replace("px", "")}</option>)}
            </select>

            <div className="w-px h-5 bg-[#e5e5e5] mx-1 flex-shrink-0" />

            {/* Headings */}
            <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={btn(editor.isActive("heading", { level: 1 }))}>
              <Heading1 className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btn(editor.isActive("heading", { level: 2 }))}>
              <Heading2 className="w-4 h-4" />
            </button>

            <div className="w-px h-5 bg-[#e5e5e5] mx-1 flex-shrink-0" />

            {/* Inline formatting */}
            <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive("bold"))}>
              <Bold className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive("italic"))}>
              <Italic className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={btn(editor.isActive("underline"))}>
              <UnderlineIcon className="w-4 h-4" />
            </button>
            <button type="button" onClick={openLinkModal} className={btn(editor.isActive("link"))}>
              <LinkIcon className="w-4 h-4" />
            </button>

            <div className="w-px h-5 bg-[#e5e5e5] mx-1 flex-shrink-0" />

            {/* Block elements */}
            <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btn(editor.isActive("blockquote"))}>
              <Quote className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={btn(editor.isActive("codeBlock"))}>
              <Code className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()} className={btn(false)}>
              <Minus className="w-4 h-4" />
            </button>

            <div className="w-px h-5 bg-[#e5e5e5] mx-1 flex-shrink-0" />

            {/* Lists */}
            <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive("bulletList"))}>
              <List className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive("orderedList"))}>
              <ListOrdered className="w-4 h-4" />
            </button>

            <div className="w-px h-5 bg-[#e5e5e5] mx-1 flex-shrink-0" />

            {/* Alignment */}
            <button type="button" onClick={() => editor.chain().focus().setTextAlign("left").run()} className={btn(editor.isActive({ textAlign: "left" }))}>
              <AlignLeft className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().setTextAlign("center").run()} className={btn(editor.isActive({ textAlign: "center" }))}>
              <AlignCenter className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().setTextAlign("right").run()} className={btn(editor.isActive({ textAlign: "right" }))}>
              <AlignRight className="w-4 h-4" />
            </button>

            <div className="w-px h-5 bg-[#e5e5e5] mx-1 flex-shrink-0" />

            {/* Media */}
            <button type="button" onClick={() => imgInputRef.current?.click()} disabled={uploadingImg} title="Insert image" className={btn(false, "disabled:opacity-40")}>
              {uploadingImg ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
            </button>
            <button type="button" onClick={() => { setVideoTab("youtube"); setShowVideoModal(true); }} disabled={uploadingVid} title="Insert video" className={btn(false, "disabled:opacity-40")}>
              {uploadingVid ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            </button>

            {/* Google Search Widget */}
            <button type="button" onClick={() => setShowSearchModal(true)} title="Insert Google Search widget" className={btn(false)}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </button>

            {/* Input Tool */}
            <div className="flex-shrink-0" ref={langDropdownRef}>
              <button
                ref={langBtnRef}
                type="button"
                onClick={() => {
                  if (inputTool) {
                    setInputTool(null);
                    setSuggestions([]);
                    setSuggestionRect(null);
                    pendingWordRef.current = "";
                  } else {
                    const rect = langBtnRef.current?.getBoundingClientRect();
                    if (rect) setLangDropdownPos({ top: rect.bottom + 4, left: rect.left });
                    setShowLangDropdown(s => !s);
                  }
                }}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  inputTool
                    ? "bg-[#F44444] text-white"
                    : "hover:bg-[#f5f5f5] text-[#525252] border border-[#e5e5e5]"
                }`}
                title="Input Tool — phonetic transliteration"
              >
                {inputTool ? INPUT_LANGUAGES.find(l => l.code === inputTool)?.label ?? "Input" : "Input"}
                {inputTool ? <X className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
              </button>
            </div>
          </div>

          {/* Input Tool hint bar */}
          {inputTool && (
            <div className="flex items-center gap-2 px-3 py-1.5 mb-3 bg-[#fafafa] border border-[#e5e5e5] rounded-lg">
              <span className="text-[11px] text-[#737373]">
                {INPUT_LANGUAGES.find(l => l.code === inputTool)?.label} — type in English then press Space
              </span>
            </div>
          )}

          {/* Media size/align controls */}
          {mediaActive && (() => {
            const isImg = editor.isActive("image");
            const current = isImg
              ? (editor.getAttributes("image").style ?? "")
              : (editor.getAttributes("videoUpload").style ?? "");
            const setStyle = (style: string) => {
              if (isImg) editor.chain().focus().updateAttributes("image", { style }).run();
              else editor.chain().focus().updateAttributes("videoUpload", { style }).run();
            };
            const sizes: [string, string, string][] = [
              ["S", "25%", "width:25%;display:block;margin:1rem auto;"],
              ["M", "50%", "width:50%;display:block;margin:1rem auto;"],
              ["L", "75%", "width:75%;display:block;margin:1rem auto;"],
              ["Full", "100%", "width:100%;display:block;margin:1rem auto;"],
            ];
            const aligns: [string, string, string][] = [
              ["Left", "float:left", "width:40%;display:block;float:left;margin:0.5rem 1rem 0.5rem 0;"],
              ["Center", "margin:1rem auto", "width:100%;display:block;margin:1rem auto;"],
              ["Right", "float:right", "width:40%;display:block;float:right;margin:0.5rem 0 0.5rem 1rem;"],
            ];
            return (
              <div className="flex items-center gap-1.5 px-3 py-2 mb-3 bg-[#fafafa] border border-[#e5e5e5] rounded-xl">
                <span className="text-[10px] font-medium text-[#a3a3a3] mr-1">Size</span>
                {sizes.map(([label, pct, style]) => (
                  <button key={label} type="button" onClick={() => setStyle(style)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${current.includes(pct) ? "bg-[#0a0a0a] text-white" : "text-[#525252] hover:bg-[#f0f0f0]"}`}>
                    {label}
                  </button>
                ))}
                <div className="w-px h-4 bg-[#e5e5e5] mx-1" />
                <span className="text-[10px] font-medium text-[#a3a3a3] mr-1">Align</span>
                {aligns.map(([label, check, style]) => (
                  <button key={label} type="button" onClick={() => setStyle(style)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${current.includes(check) ? "bg-[#0a0a0a] text-white" : "text-[#525252] hover:bg-[#f0f0f0]"}`}>
                    {label}
                  </button>
                ))}
              </div>
            );
          })()}

          <EditorContent editor={editor} />
        </>
      )}

      {/* ── Input Tool suggestion popup ── */}
      {suggestions.length > 0 && suggestionRect && (
        <div
          className="fixed z-[300] bg-white border border-[#e5e5e5] rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.1)] overflow-hidden min-w-[120px]"
          style={{ top: suggestionRect.top, left: suggestionRect.left }}
        >
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={e => { e.preventDefault(); applySuggestion(s); }}
              className="block w-full text-left px-4 py-2 text-sm text-[#0a0a0a] hover:bg-[#fafafa] transition-colors border-b border-[#f5f5f5] last:border-0"
            >
              {s}
            </button>
          ))}
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); setSuggestions([]); setSuggestionRect(null); }}
            className="block w-full text-center px-4 py-1 text-[10px] text-[#a3a3a3] hover:bg-[#fafafa] transition-colors"
          >
            dismiss
          </button>
        </div>
      )}

      {/* ── Link modal ── */}
      {showLinkModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowLinkModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <p className="text-sm font-semibold text-[#0a0a0a] mb-1">Insert link</p>
            <p className="text-xs text-[#737373] mb-4">Leave empty to remove an existing link</p>
            <input
              type="url"
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") applyLink(); if (e.key === "Escape") setShowLinkModal(false); }}
              placeholder="https://example.com"
              className="w-full px-3 py-2.5 rounded-xl bg-[#fafafa] border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowLinkModal(false)} className="px-4 py-2 rounded-lg border border-[#e5e5e5] text-[#525252] text-sm hover:bg-[#fafafa] transition-colors cursor-pointer">Cancel</button>
              <button onClick={applyLink} className="px-4 py-2 rounded-lg bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer">Apply</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Video modal ── */}
      {showVideoModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowVideoModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <p className="text-sm font-semibold text-[#0a0a0a] mb-4">Insert video</p>
            <div className="flex gap-1 p-1 bg-[#f5f5f5] rounded-lg mb-5">
              <button type="button" onClick={() => setVideoTab("youtube")} className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${videoTab === "youtube" ? "bg-white text-[#0a0a0a] shadow-sm" : "text-[#737373] hover:text-[#0a0a0a]"}`}>YouTube / Vimeo</button>
              <button type="button" onClick={() => setVideoTab("upload")} className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${videoTab === "upload" ? "bg-white text-[#0a0a0a] shadow-sm" : "text-[#737373] hover:text-[#0a0a0a]"}`}>Upload video</button>
            </div>
            {videoTab === "youtube" ? (
              <>
                <input type="url" value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleYoutubeEmbed(); }} placeholder="https://youtube.com/watch?v=..." className="w-full px-3 py-2.5 rounded-xl bg-[#fafafa] border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all mb-4" autoFocus />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowVideoModal(false)} className="px-4 py-2 rounded-lg border border-[#e5e5e5] text-[#525252] text-sm hover:bg-[#fafafa] transition-colors cursor-pointer">Cancel</button>
                  <button onClick={handleYoutubeEmbed} disabled={!youtubeUrl.trim()} className="px-4 py-2 rounded-lg bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors disabled:opacity-40 cursor-pointer">Embed</button>
                </div>
              </>
            ) : (
              <>
                <button type="button" onClick={() => vidInputRef.current?.click()} disabled={uploadingVid} className="w-full h-28 rounded-xl border-2 border-dashed border-[#e5e5e5] hover:border-[#d5d5d5] flex flex-col items-center justify-center gap-2 text-[#737373] hover:text-[#525252] transition-colors cursor-pointer disabled:opacity-40 mb-4">
                  {uploadingVid ? (<><Loader2 className="w-5 h-5 animate-spin" /><span className="text-xs">Uploading…</span></>) : (<><Upload className="w-5 h-5" /><span className="text-xs">Click to pick a video file</span><span className="text-[10px] text-[#a3a3a3]">MP4, MOV, WebM</span></>)}
                </button>
                <div className="flex justify-end">
                  <button onClick={() => setShowVideoModal(false)} className="px-4 py-2 rounded-lg border border-[#e5e5e5] text-[#525252] text-sm hover:bg-[#fafafa] transition-colors cursor-pointer">Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Google Search preview modal ── */}
      {showSearchModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setShowSearchModal(false); setSearchQuery(""); setSearchResult(null); }} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2.5 px-6 pt-5 pb-4">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" className="flex-shrink-0">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <p className="text-sm font-medium text-[#0a0a0a]">Add a Google Search preview</p>
            </div>

            {/* Search input */}
            <div className="px-6 pb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") fetchSearchResult(searchQuery);
                  if (e.key === "Escape") { setShowSearchModal(false); setSearchQuery(""); setSearchResult(null); }
                }}
                placeholder="Search Google or paste a URL…"
                className="w-full px-0 py-1.5 text-sm text-[#0a0a0a] border-0 border-b-2 border-[#F44444] outline-none placeholder:text-[#a3a3a3] bg-transparent"
                autoFocus
              />
              <p className="text-[11px] text-[#a3a3a3] mt-1.5">You may also paste in a Google Search page URL</p>
            </div>

            {/* Preview area */}
            <div className="px-6 pb-4 min-h-[100px] flex items-center justify-center">
              {searchLoading ? (
                <Loader2 className="w-5 h-5 text-[#a3a3a3] animate-spin" />
              ) : searchResult ? (
                <div className="w-full flex items-center gap-3 p-3 bg-[#f8f9fa] rounded-xl border border-[#e5e5e5]">
                  {searchResult.image ? (
                    <img src={searchResult.image} alt="" className="w-[80px] h-[80px] object-cover rounded-lg flex-shrink-0" />
                  ) : (
                    <div className="w-[80px] h-[80px] rounded-lg bg-[#e8eaed] flex-shrink-0 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#1a0dab] leading-snug truncate">{searchResult.title}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      <span className="text-[11px] text-[#5f6368]">www.google.com</span>
                    </div>
                  </div>
                </div>
              ) : searchQuery.trim() ? (
                <button
                  onClick={() => fetchSearchResult(searchQuery)}
                  className="text-xs text-[#1a73e8] hover:underline cursor-pointer"
                >
                  Search for &ldquo;{searchQuery}&rdquo;
                </button>
              ) : null}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-[#f0f0f0]">
              <button
                onClick={() => { setShowSearchModal(false); setSearchQuery(""); setSearchResult(null); }}
                className="px-4 py-2 text-xs font-medium text-[#5f6368] hover:text-[#0a0a0a] transition-colors cursor-pointer uppercase tracking-wide"
              >
                Cancel
              </button>
              <button
                onClick={insertSearchWidget}
                disabled={!searchQuery.trim()}
                className="px-4 py-2 text-xs font-medium text-[#1a73e8] hover:text-[#1558b0] transition-colors disabled:opacity-40 cursor-pointer uppercase tracking-wide"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Input Tool language dropdown (fixed to avoid toolbar clip) ── */}
      {showLangDropdown && langDropdownPos && (
        <div
          className="fixed z-[300] bg-white border border-[#e5e5e5] rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.1)] overflow-hidden w-32"
          style={{ top: langDropdownPos.top, left: langDropdownPos.left }}
          ref={langDropdownRef}
        >
          {INPUT_LANGUAGES.map(lang => (
            <button
              key={lang.code}
              type="button"
              onClick={() => {
                setInputTool(lang.code);
                setShowLangDropdown(false);
                setLangDropdownPos(null);
                pendingWordRef.current = "";
                editor.commands.focus();
              }}
              className="w-full text-left px-3 py-2 text-xs text-[#0a0a0a] hover:bg-[#fafafa] transition-colors"
            >
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
