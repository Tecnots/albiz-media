"use client";

import { useEffect, useRef, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Youtube from "@tiptap/extension-youtube";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
  Quote, Code, Heading1, Heading2, Minus, ImagePlus, Play, Loader2,
} from "lucide-react";
import { useState } from "react";

interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  userId: number;
}

export function RichEditor({ value, onChange, userId }: RichEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
        codeBlock: { HTMLAttributes: { class: "bg-[#f5f5f5] rounded-lg px-4 py-3 text-sm font-mono" } },
        blockquote: { HTMLAttributes: { class: "border-l-4 border-[#e5e5e5] pl-4 italic text-[#737373]" } },
      }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-[#F44444] underline cursor-pointer" } }),
      Image.configure({ HTMLAttributes: { class: "rounded-xl max-w-full my-4" } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Youtube.configure({ width: 640, height: 400, HTMLAttributes: { class: "rounded-xl overflow-hidden my-4 w-full" } }),
      Placeholder.configure({ placeholder: "Start writing your article…" }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[400px] text-[#262626] text-base leading-7",
      },
    },
    immediatelyRender: false,
  });

  // Sync external value changes (e.g. when editing an existing article)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value]);

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    setUploadingImage(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("userId", String(userId));
      form.append("category", "posts");
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (res.ok) {
        const { url } = await res.json();
        editor.chain().focus().setImage({ src: url, alt: file.name }).run();
      }
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [editor, userId]);

  const handleInsertVideo = useCallback(() => {
    if (!editor || !videoUrl.trim()) return;
    editor.chain().focus().setYoutubeVideo({ src: videoUrl.trim() }).run();
    setVideoUrl("");
    setShowVideoModal(false);
  }, [editor, videoUrl]);

  const addLink = useCallback(() => {
    const url = window.prompt("Enter URL:");
    if (!url || !editor) return;
    if (editor.state.selection.empty) {
      editor.chain().focus().insertContent(`<a href="${url}">${url}</a>`).run();
    } else {
      editor.chain().focus().toggleLink({ href: url }).run();
    }
  }, [editor]);

  if (!editor) return null;

  const btn = (active: boolean) =>
    `p-2 rounded-lg transition-colors ${active ? "bg-[#0a0a0a] text-white" : "hover:bg-[#f5f5f5] text-[#525252]"}`;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 border-y border-[#e5e5e5] py-2 mb-6 overflow-x-auto flex-wrap">
        {/* Headings */}
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={btn(editor.isActive("heading", { level: 1 }))}>
          <Heading1 className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btn(editor.isActive("heading", { level: 2 }))}>
          <Heading2 className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-[#e5e5e5] mx-1" />

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
        <button type="button" onClick={addLink} className={btn(editor.isActive("link"))}>
          <LinkIcon className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-[#e5e5e5] mx-1" />

        {/* Blocks */}
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

        {/* Lists */}
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive("bulletList"))}>
          <List className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive("orderedList"))}>
          <ListOrdered className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-[#e5e5e5] mx-1" />

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

        <div className="w-px h-5 bg-[#e5e5e5] mx-1" />

        {/* Media */}
        <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleImageUpload} className="hidden" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingImage}
          className={`${btn(false)} disabled:opacity-40`}
          title="Insert image"
        >
          {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
        </button>
        <button type="button" onClick={() => setShowVideoModal(true)} className={btn(false)} title="Embed video">
          <Play className="w-4 h-4" />
        </button>
      </div>

      {/* Editor content */}
      <EditorContent editor={editor} />

      {/* Video embed modal */}
      {showVideoModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowVideoModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <p className="text-sm font-semibold text-[#0a0a0a] mb-1">Embed video</p>
            <p className="text-xs text-[#737373] mb-4">Paste a YouTube or Vimeo URL</p>
            <input
              type="url"
              value={videoUrl}
              onChange={e => setVideoUrl(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleInsertVideo(); }}
              placeholder="https://youtube.com/watch?v=..."
              className="w-full px-3 py-2.5 rounded-xl bg-[#fafafa] border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowVideoModal(false)} className="px-4 py-2 rounded-lg border border-[#e5e5e5] text-[#525252] text-sm hover:bg-[#fafafa] transition-colors cursor-pointer">Cancel</button>
              <button onClick={handleInsertVideo} disabled={!videoUrl.trim()} className="px-4 py-2 rounded-lg bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors disabled:opacity-40 cursor-pointer">Embed</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
