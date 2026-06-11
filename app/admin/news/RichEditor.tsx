"use client";

import { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { Node, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TipTapImageBase from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Youtube from "@tiptap/extension-youtube";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
  Quote, Code, Heading1, Heading2, Minus, ImagePlus, Play, Loader2, Upload,
} from "lucide-react";

// ─── Image extension with style attribute support ────────────────────────────

const TipTapImage = TipTapImageBase.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: { default: "width:100%;display:block;margin:1rem auto;" },
    };
  },
});

// ─── Custom video node for blob-hosted videos ─────────────────────────────────

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
  parseHTML() {
    return [{ tag: "video[src]" }];
  },
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

// ─── Component ────────────────────────────────────────────────────────────────

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
    ],
    content: value || "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { class: "focus:outline-none min-h-[400px] text-[#262626] text-base leading-7" },
    },
    immediatelyRender: false,
  });

  // Expose replaceRange to parent
  useImperativeHandle(ref, () => ({
    replaceRange: (from, to, text) => {
      editor?.chain().focus().setTextSelection({ from, to }).insertContent(text).run();
    },
    setContent: (html) => {
      editor?.commands.setContent(html, { emitUpdate: true });
    },
  }), [editor]);

  // Fire onSelectionChange when text is selected
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

  // Sync when editing an existing article
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current && value !== "<p></p>") {
      editor.commands.setContent(value || "");
    }

  }, [value]);

  // Track media selection for inline controls
  useEffect(() => {
    if (!editor) return;
    const update = () => setMediaActive(editor.isActive("image") || editor.isActive("videoUpload"));
    editor.on("transaction", update);
    editor.on("selectionUpdate", update);
    return () => { editor.off("transaction", update); editor.off("selectionUpdate", update); };
  }, [editor]);

  // ─── Upload image ──────────────────────────────────────────────────────────

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
        // Re-focus then insert
        editor.commands.focus();
        editor.chain().setImage({ src: url, alt: file.name }).run();
      }
    } finally {
      setUploadingImg(false);
      if (imgInputRef.current) imgInputRef.current.value = "";
    }
  }, [editor, userId]);

  // ─── Upload video to blob ──────────────────────────────────────────────────

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

  if (!editor) return null;

  const btn = (active: boolean) =>
    `p-2 rounded-lg transition-colors cursor-pointer ${active ? "bg-[#0a0a0a] text-white" : "hover:bg-[#f5f5f5] text-[#525252]"}`;

  return (
    <div>
      {/* Hidden file inputs */}
      <input ref={imgInputRef} type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
      <input ref={vidInputRef} type="file" accept="video/*" onChange={handleVideoFile} className="hidden" />

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 border-b border-[#e5e5e5] py-2 mb-4 overflow-x-auto flex-wrap">
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={btn(editor.isActive("heading", { level: 1 }))}>
          <Heading1 className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btn(editor.isActive("heading", { level: 2 }))}>
          <Heading2 className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-[#e5e5e5] mx-1" />

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

        <div className="w-px h-5 bg-[#e5e5e5] mx-1" />

        <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btn(editor.isActive("blockquote"))}>
          <Quote className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={btn(editor.isActive("codeBlock"))}>
          <Code className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()} className={btn(false)}>
          <Minus className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-[#e5e5e5] mx-1" />

        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive("bulletList"))}>
          <List className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive("orderedList"))}>
          <ListOrdered className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-[#e5e5e5] mx-1" />

        <button type="button" onClick={() => editor.chain().focus().setTextAlign("left").run()} className={btn(editor.isActive({ textAlign: "left" }))}>
          <AlignLeft className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().setTextAlign("center").run()} className={btn(editor.isActive({ textAlign: "center" }))}>
          <AlignCenter className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().setTextAlign("right").run()} className={btn(editor.isActive({ textAlign: "right" }))}>
          <AlignRight className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-[#e5e5e5] mx-1" />

        {/* Image upload */}
        <button
          type="button"
          onClick={() => imgInputRef.current?.click()}
          disabled={uploadingImg}
          className={`${btn(false)} disabled:opacity-40`}
          title="Insert image"
        >
          {uploadingImg ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
        </button>

        {/* Video */}
        <button
          type="button"
          onClick={() => { setVideoTab("youtube"); setShowVideoModal(true); }}
          disabled={uploadingVid}
          className={`${btn(false)} disabled:opacity-40`}
          title="Insert video"
        >
          {uploadingVid ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
        </button>
      </div>

      {/* ─── Media controls (shown when image/video selected) ─── */}
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

      {/* ─── Link modal ─── */}
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

      {/* ─── Video modal ─── */}
      {showVideoModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowVideoModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <p className="text-sm font-semibold text-[#0a0a0a] mb-4">Insert video</p>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-[#f5f5f5] rounded-lg mb-5">
              <button
                type="button"
                onClick={() => setVideoTab("youtube")}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${videoTab === "youtube" ? "bg-white text-[#0a0a0a] shadow-sm" : "text-[#737373] hover:text-[#0a0a0a]"}`}
              >
                YouTube / Vimeo
              </button>
              <button
                type="button"
                onClick={() => setVideoTab("upload")}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${videoTab === "upload" ? "bg-white text-[#0a0a0a] shadow-sm" : "text-[#737373] hover:text-[#0a0a0a]"}`}
              >
                Upload video
              </button>
            </div>

            {videoTab === "youtube" ? (
              <>
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={e => setYoutubeUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleYoutubeEmbed(); }}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full px-3 py-2.5 rounded-xl bg-[#fafafa] border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all mb-4"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowVideoModal(false)} className="px-4 py-2 rounded-lg border border-[#e5e5e5] text-[#525252] text-sm hover:bg-[#fafafa] transition-colors cursor-pointer">Cancel</button>
                  <button onClick={handleYoutubeEmbed} disabled={!youtubeUrl.trim()} className="px-4 py-2 rounded-lg bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors disabled:opacity-40 cursor-pointer">Embed</button>
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => vidInputRef.current?.click()}
                  disabled={uploadingVid}
                  className="w-full h-28 rounded-xl border-2 border-dashed border-[#e5e5e5] hover:border-[#d5d5d5] flex flex-col items-center justify-center gap-2 text-[#737373] hover:text-[#525252] transition-colors cursor-pointer disabled:opacity-40 mb-4"
                >
                  {uploadingVid ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /><span className="text-xs">Uploading to Blob…</span></>
                  ) : (
                    <><Upload className="w-5 h-5" /><span className="text-xs">Click to pick a video file</span><span className="text-[10px] text-[#a3a3a3]">MP4, MOV, WebM · saved to Azure Blob</span></>
                  )}
                </button>
                <div className="flex justify-end">
                  <button onClick={() => setShowVideoModal(false)} className="px-4 py-2 rounded-lg border border-[#e5e5e5] text-[#525252] text-sm hover:bg-[#fafafa] transition-colors cursor-pointer">Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
