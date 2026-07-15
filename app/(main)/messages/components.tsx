"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback, memo } from "react";
import { Search, X, ArrowUp, ArrowDown, Check, CheckCheck, Lock, Plus,
  Paperclip, ImagePlus, FileText, Music, Copy, Pencil, Trash2, Bookmark, BookmarkCheck,
  Video, Download, Send, RefreshCw, Play, Pause, AlertCircle,
  Twitter, Facebook, Instagram as InstagramIcon, Linkedin, MessageCircle, Send as TelegramIcon, Info
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { VerifiedBadge } from "@/app/lib/shared-components";
import { api } from "@/app/lib/api";
import { Avatar } from "@/app/components/Avatar";

// --- Utilities ---

export function formatMessageTime(createdAt: string | undefined, fallbackTime: string): string {
  if (!createdAt) return fallbackTime;
  try {
    const d = new Date(createdAt);
    if (isNaN(d.getTime())) return fallbackTime;
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch { return fallbackTime; }
}

export function formatLastSeen(lastSeenAt: string | null | undefined): string {
  if (!lastSeenAt) return "Offline";
  try {
    const d = new Date(lastSeenAt);
    const diff = Date.now() - d.getTime();
    if (diff < 30_000) return "";
    if (diff < 60_000) return "Last seen just now";
    if (diff < 3600_000) return `Last seen ${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86400_000) return `Last seen ${Math.floor(diff / 3600_000)}h ago`;
    return "Offline";
  } catch { return "Offline"; }
}

export function isOnline(lastSeenAt: string | null | undefined): boolean {
  if (!lastSeenAt) return false;
  try { return Date.now() - new Date(lastSeenAt).getTime() < 30_000; } catch { return false; }
}

export function getDateLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.floor((today.getTime() - msgDate.getTime()) / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    return d.toLocaleDateString([], { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
  } catch { return ""; }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Kept in sync with the server-side allowlist in app/api/upload/route.ts.
export const VIDEO_ACCEPT = "video/mp4,video/webm,video/quicktime,video/x-m4v,video/ogg";
export const MAX_VIDEO_CLIENT_SIZE = 100 * 1024 * 1024; // 100 MB

// --- Small Components ---

export function MessageStatus({ status, light = false }: { status: string; light?: boolean }) {
  if (status === "read") return <CheckCheck className={`w-3 h-3 ${light ? "text-white/70" : "text-[#F44444]"}`} />;
  if (status === "delivered") return <CheckCheck className={`w-3 h-3 ${light ? "text-white/50" : "text-[#b0b0b0]"}`} />;
  if (status === "sent") return <Check className={`w-3 h-3 ${light ? "text-white/50" : "text-[#b0b0b0]"}`} />;
  if (status === "sending") return (
    <div className={`w-2.5 h-2.5 border rounded-full animate-spin ${light ? "border-white/20 border-t-white/50" : "border-[#e0e0e0] border-t-[#a3a3a3]"}`} />
  );
  // Retryable delivery failure — a background sweep keeps retrying (see
  // lib/workers/social-sync-worker.ts), so this reads as transient, not final.
  if (status === "retrying") return <AlertCircle className={`w-3 h-3 ${light ? "text-white/70" : "text-[#b45309]"}`} />;
  return null;
}

export function TypingDots() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className="flex justify-start mb-1"
    >
      <div className="bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)] rounded-2xl rounded-bl-[5px] px-4 py-3 flex items-center gap-1.5">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[#b0b0b0]"
            style={{ animation: "typingBounce 1.2s ease-in-out infinite", animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <style>{`@keyframes typingBounce { 0%,60%,100%{transform:translateY(0);opacity:.4} 30%{transform:translateY(-4px);opacity:1} }`}</style>
    </motion.div>
  );
}

export function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-4">
      <span className="bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] rounded-full px-3.5 py-1.5 text-[12px] text-[#737373] font-medium">
        {label}
      </span>
    </div>
  );
}

// --- Emoji Picker ---

const EMOJI_GRID = [
  "😀", "😂", "😍", "😊", "😉", "😘", "🥰", "😎", "🤔", "😅",
  "😢", "😭", "😡", "😱", "🥳", "😴", "🤗", "🙄", "😇", "🤩",
  "👍", "👎", "👏", "🙏", "💪", "🤝", "👌", "✌️", "🤞", "🫶",
  "❤️", "🔥", "🎉", "✨", "💯", "🎂", "☕", "🍕", "⚽", "🚀",
];

export function EmojiPicker({ onSelect, onClose }: { onSelect: (emoji: string) => void; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.1)] border border-[#efefef] p-2 grid grid-cols-8 gap-0.5 w-[264px]"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {EMOJI_GRID.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => { onSelect(emoji); onClose(); }}
          className="w-7 h-7 flex items-center justify-center text-[17px] rounded-lg hover:bg-[#f5f5f5] transition-colors"
        >
          {emoji}
        </button>
      ))}
    </motion.div>
  );
}

// --- Circle Gate ---

export function CircleGate() {
  return (
    <div className="flex-1 flex items-center justify-center p-8 bg-white">
      <div className="text-center max-w-xs">
        <div className="w-14 h-14 rounded-full bg-[#fef2f2] flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6 text-[#F44444]" />
        </div>
        <p className="text-[15px] font-semibold text-[#0a0a0a] mb-1.5">Circle members only</p>
        <p className="text-[13px] text-[#737373] mb-5 leading-relaxed">Direct messaging is available exclusively for Circle members.</p>
        <Link href="/settings" className="inline-flex px-5 py-2.5 rounded-xl bg-[#F44444] text-white text-[13px] font-semibold hover:bg-[#e03c3c] transition-colors">
          Upgrade to Circle
        </Link>
      </div>
    </div>
  );
}

// --- Attachment Renderers ---

export function ImageAttachment({ url, name }: { url: string; name?: string }) {
  const [expanded, setExpanded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="w-[200px] h-[130px] rounded-xl bg-[#f5f5f5] flex flex-col items-center justify-center gap-1.5 text-[#a3a3a3]">
        <AlertCircle className="w-5 h-5" />
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium underline underline-offset-2">
          Image unavailable — open link
        </a>
      </div>
    );
  }

  return (
    <>
      <button onClick={() => setExpanded(true)} className="block max-w-[200px] rounded-xl overflow-hidden ring-1 ring-black/[0.06]" aria-label={name ? `View image: ${name}` : "View image"}>
        <Image src={url} alt={name || "Image"} width={200} height={150} className="object-cover w-full" unoptimized onError={() => setFailed(true)} />
      </button>
      {expanded && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center" onClick={() => setExpanded(false)}>
          <Image src={url} alt={name || "Image"} width={800} height={600} className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl" unoptimized />
          <button className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      )}
    </>
  );
}

export function DocumentAttachment({ url, name, size }: { url: string; name?: string; size?: number }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2.5 bg-black/[0.05] rounded-xl px-3 py-2 min-w-[160px] hover:bg-black/[0.08] transition-colors"
    >
      <FileText className="w-7 h-7 text-[#3b82f6] flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium truncate">{name || "Document"}</p>
        {size && <p className="text-[10px] text-[#a3a3a3]">{formatFileSize(size)}</p>}
      </div>
      <Download className="w-3.5 h-3.5 text-[#a3a3a3] flex-shrink-0" />
    </a>
  );
}

// Voice / audio message player. Custom transport (play, pause, resume, replay,
// seek) with a duration + progress readout that stays legible on both the red
// "mine" bubble and the white incoming bubble.
export function AudioAttachment({ url, name, mine = false }: { url: string; name?: string; mine?: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const toggle = () => {
    const a = audioRef.current;
    if (!a || state === "error") return;
    if (playing) {
      a.pause();
    } else {
      a.play().catch(() => setState("error"));
    }
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = audioRef.current;
    if (!a || !isFinite(duration) || duration <= 0) return;
    a.currentTime = (Number(e.target.value) / 100) * duration;
    setCurrent(a.currentTime);
  };

  // Some browsers report Infinity duration for streamed webm until it ends;
  // fall back to the played time so the readout is never "Infinity".
  const total = isFinite(duration) && duration > 0 ? duration : current;
  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0;
  const accent = mine ? "text-white" : "text-[#F44444]";
  const sub = mine ? "text-white/60" : "text-[#a3a3a3]";
  const track = mine ? "bg-white/25" : "bg-[#efefef]";
  const fill = mine ? "bg-white" : "bg-[#F44444]";

  if (state === "error") {
    return (
      <div className={`flex items-center gap-2 min-w-[200px] ${sub}`}>
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium underline underline-offset-2 truncate">
          Audio unavailable — open link
        </a>
      </div>
    );
  }

  return (
    <div className="min-w-[200px] max-w-[260px]">
      <div className="flex items-center gap-2.5">
        <button
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${mine ? "bg-white/20 hover:bg-white/30" : "bg-[#fef2f2] hover:bg-[#fee2e2]"} transition-colors`}
        >
          {state === "loading" ? (
            <span className={`w-3.5 h-3.5 border-[1.5px] rounded-full animate-spin ${mine ? "border-white/40 border-t-white" : "border-[#F44444]/30 border-t-[#F44444]"}`} />
          ) : playing ? (
            <Pause className={`w-4 h-4 ${accent}`} />
          ) : (
            <Play className={`w-4 h-4 ${accent} translate-x-[1px]`} />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="relative flex items-center h-4">
            <div className={`absolute left-0 right-0 h-1 rounded-full ${track}`} />
            <div className={`absolute left-0 h-1 rounded-full ${fill}`} style={{ width: `${pct}%` }} />
            <input
              type="range" min={0} max={100} value={pct} onChange={seek}
              aria-label="Seek"
              className="absolute left-0 right-0 w-full h-4 opacity-0 cursor-pointer"
              disabled={state !== "ready"}
            />
          </div>
          <div className={`flex justify-between text-[10px] tabular-nums mt-1 ${sub}`}>
            <span>{formatDuration(current)}</span>
            <span>{total > 0 ? formatDuration(total) : "--:--"}</span>
          </div>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const a = e.currentTarget;
          const d = a.duration;
          if (isFinite(d) && d > 0) { setDuration(d); setState("ready"); return; }
          // webm/opus from MediaRecorder reports Infinity until forced — seek far
          // past the end to make the browser compute the real duration, then reset.
          const onSeeked = () => { a.removeEventListener("seeked", onSeeked); a.currentTime = 0; setState("ready"); };
          a.addEventListener("seeked", onSeeked);
          try { a.currentTime = 1e101; } catch { setState("ready"); }
        }}
        onCanPlay={() => setState((s) => (s === "loading" ? "ready" : s))}
        onDurationChange={(e) => { const d = e.currentTarget.duration; if (isFinite(d) && d > 0) setDuration(d); }}
        onTimeUpdate={(e) => { const t = e.currentTarget.currentTime; if (isFinite(t)) setCurrent(t); }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={(e) => { setPlaying(false); setCurrent(0); e.currentTarget.currentTime = 0; }}
        onError={() => setState("error")}
        className="hidden"
      />
    </div>
  );
}

export function VideoAttachment({ url, name }: { url: string; name?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  // Defer mounting the real <video src> until the bubble is near the viewport,
  // so a long conversation with many videos doesn't fire dozens of concurrent
  // range requests / decoders at once.
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) { setInView(true); observer.disconnect(); }
      },
      { rootMargin: "400px" },
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="max-w-[240px] rounded-xl overflow-hidden ring-1 ring-black/[0.06] bg-black relative">
      {inView ? (
        <video
          src={url}
          controls
          playsInline
          preload="metadata"
          aria-label={name || "Video"}
          className="block w-full max-h-[280px] bg-black"
          onLoadedData={() => setState("ready")}
          onError={() => setState("error")}
        />
      ) : (
        <div className="w-[240px] aspect-video" />
      )}
      {inView && state === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
        </div>
      )}
      {inView && state === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/90 text-white/70">
          <AlertCircle className="w-5 h-5" />
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium underline underline-offset-2">
            Video unavailable — open link
          </a>
        </div>
      )}
    </div>
  );
}

// --- Attachment Picker ---

export function AttachmentPicker({ onSelect }: { onSelect: (file: File, type: string) => void }) {
  const imgRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files?.[0];
    if (file) onSelect(file, type);
    e.target.value = "";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.1)] border border-[#efefef] overflow-hidden min-w-[150px]"
    >
      <button onClick={() => imgRef.current?.click()} className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-[#fafafa] transition-colors w-full text-left text-[13px] text-[#0a0a0a]">
        <ImagePlus className="w-4 h-4 text-[#22c55e]" />Photo
      </button>
      <button onClick={() => videoRef.current?.click()} className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-[#fafafa] transition-colors w-full text-left text-[13px] text-[#0a0a0a]">
        <Video className="w-4 h-4 text-[#F44444]" />Video
      </button>
      <button onClick={() => docRef.current?.click()} className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-[#fafafa] transition-colors w-full text-left text-[13px] text-[#0a0a0a]">
        <FileText className="w-4 h-4 text-[#3b82f6]" />Document
      </button>
      <button onClick={() => audioRef.current?.click()} className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-[#fafafa] transition-colors w-full text-left text-[13px] text-[#0a0a0a]">
        <Music className="w-4 h-4 text-[#f59e0b]" />Audio
      </button>
      <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e, "image")} />
      <input ref={videoRef} type="file" accept={VIDEO_ACCEPT} className="hidden" onChange={e => handleFile(e, "video")} />
      <input ref={docRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar" className="hidden" onChange={e => handleFile(e, "document")} />
      <input ref={audioRef} type="file" accept="audio/*" className="hidden" onChange={e => handleFile(e, "audio")} />
    </motion.div>
  );
}

// --- Attachment Preview ---

// Compose-stage preview only — validates and previews the picked file. Once
// sent, upload progress/retry/cancel live on the optimistic message bubble.
export function AttachmentPreview({ file, type, onRemove, error }: {
  file: File; type: string; onRemove: () => void; error?: string | null;
}) {
  const [preview, setPreview] = useState<string>("");
  const [duration, setDuration] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);

  const isVoice = type === "audio" && file.name.startsWith("voice-message");
  const label = isVoice ? "Voice message" : file.name;

  useEffect(() => {
    if (
      (type === "image" && file.type.startsWith("image/")) ||
      (type === "video" && file.type.startsWith("video/")) ||
      type === "audio"
    ) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file, type]);

  const toggleAudio = () => {
    const a = audioRef.current;
    if (!a) return;
    if (audioPlaying) a.pause();
    else a.play().catch(() => {});
  };

  return (
    <div className="flex items-center gap-3 px-5 py-3 bg-white border-t border-[#efefef]">
      {preview && type === "image" ? (
        <Image src={preview} alt="Preview" width={44} height={44} className="w-11 h-11 rounded-lg object-cover ring-1 ring-black/[0.06]" unoptimized />
      ) : preview && type === "video" ? (
        <div className="relative w-11 h-11 rounded-lg overflow-hidden ring-1 ring-black/[0.06] bg-black flex-shrink-0">
          <video src={preview} className="w-full h-full object-cover" muted preload="metadata" onLoadedMetadata={e => setDuration(e.currentTarget.duration)} />
          <Play className="absolute inset-0 m-auto w-4 h-4 text-white/90" />
        </div>
      ) : type === "audio" ? (
        <button
          onClick={toggleAudio}
          aria-label={audioPlaying ? "Pause preview" : "Play preview"}
          className="w-11 h-11 rounded-full bg-[#fef2f2] hover:bg-[#fee2e2] flex items-center justify-center flex-shrink-0 transition-colors"
        >
          {audioPlaying ? <Pause className="w-[18px] h-[18px] text-[#F44444]" /> : <Play className="w-[18px] h-[18px] text-[#F44444] translate-x-[1px]" />}
        </button>
      ) : (
        <div className="w-11 h-11 rounded-lg bg-[#f5f5f5] flex items-center justify-center flex-shrink-0">
          {type === "document" ? <FileText className="w-[18px] h-[18px] text-[#3b82f6]" /> : type === "video" ? <Video className="w-[18px] h-[18px] text-[#F44444]" /> : <Music className="w-[18px] h-[18px] text-[#f59e0b]" />}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-[#0a0a0a] truncate">{label}</p>
        {error ? (
          <p className="text-[11px] text-[#F44444]">{error}</p>
        ) : (
          <p className="text-[11px] text-[#a3a3a3]">
            {formatFileSize(file.size)}{duration != null && ` · ${formatDuration(duration)}`}
          </p>
        )}
      </div>
      <button onClick={onRemove} aria-label="Remove attachment" className="w-7 h-7 flex items-center justify-center hover:bg-[#f5f5f5] rounded-lg transition-colors flex-shrink-0">
        <X className="w-3.5 h-3.5 text-[#a3a3a3]" />
      </button>
      {type === "audio" && preview && (
        <audio
          ref={audioRef}
          src={preview}
          preload="metadata"
          onLoadedMetadata={e => { const d = e.currentTarget.duration; if (isFinite(d)) setDuration(d); }}
          onPlay={() => setAudioPlaying(true)}
          onPause={() => setAudioPlaying(false)}
          onEnded={() => setAudioPlaying(false)}
          className="hidden"
        />
      )}
    </div>
  );
}

// --- Message Context Menu ---

export function MessageContextMenu({
  msg, isMine, position, currentUserId,
  onEdit, onDelete, onSave, onCopy, onClose,
}: {
  msg: any; isMine: boolean; position: { x: number; y: number }; currentUserId: number;
  onEdit: () => void; onDelete: () => void; onSave: () => void; onCopy: () => void; onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(position);

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      let x = position.x, y = position.y;
      if (x + rect.width > window.innerWidth - 8) x = window.innerWidth - rect.width - 8;
      if (y + rect.height > window.innerHeight - 8) y = window.innerHeight - rect.height - 8;
      if (x < 8) x = 8;
      if (y < 8) y = 8;
      setPos({ x, y });
    }
  }, [position]);

  useEffect(() => {
    const handleClick = () => onClose();
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [onClose]);

  const isSaved = msg.savedByUser === currentUserId;
  const canEdit = isMine && msg.id > 0 && (Date.now() - new Date(msg.createdAt || 0).getTime() < 15 * 60 * 1000);

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="absolute bg-white rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-[#efefef] overflow-hidden min-w-[140px]"
        style={{ left: pos.x, top: pos.y }}
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onCopy} className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-[#fafafa] w-full text-left text-[13px] text-[#0a0a0a]">
          <Copy className="w-3.5 h-3.5 text-[#a3a3a3]" />Copy
        </button>
        <button onClick={onSave} className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-[#fafafa] w-full text-left text-[13px] text-[#0a0a0a]">
          {isSaved
            ? <BookmarkCheck className="w-3.5 h-3.5 text-[#F44444]" />
            : <Bookmark className="w-3.5 h-3.5 text-[#a3a3a3]" />
          }
          {isSaved ? "Unsave" : "Save"}
        </button>
        {canEdit && (
          <button onClick={onEdit} className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-[#fafafa] w-full text-left text-[13px] text-[#0a0a0a]">
            <Pencil className="w-3.5 h-3.5 text-[#a3a3a3]" />Edit
          </button>
        )}
        {isMine && msg.id > 0 && (
          <>
            <div className="mx-3.5 border-t border-[#f5f5f5]" />
            <button onClick={onDelete} className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-[#fef2f2] w-full text-left text-[13px] text-[#F44444]">
              <Trash2 className="w-3.5 h-3.5" />Delete
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}

// --- Message Bubble (memoized) ---
// Extracted and memoized so a poll that updates one message doesn't re-render
// the whole thread. Renders normal, deleted, story-reply, and attachment
// messages, plus optimistic upload progress and a failed-send retry affordance.

export interface MessageBubbleProps {
  msg: any;
  isSearchMatch: boolean;
  isSearchFocus: boolean;
  isNew: boolean;
  onContextMenu: (e: React.MouseEvent, msg: any) => void;
  onRetry: (msg: any) => void;
  onCancelUpload: (msg: any) => void;
}

function bubblePropsEqual(a: MessageBubbleProps, b: MessageBubbleProps): boolean {
  const x = a.msg, y = b.msg;
  return (
    x.id === y.id &&
    x.text === y.text &&
    x.status === y.status &&
    x.edited === y.edited &&
    x.deleted === y.deleted &&
    x.editedAt === y.editedAt &&
    x.attachmentUrl === y.attachmentUrl &&
    x.uploadProgress === y.uploadProgress &&
    x.time === y.time &&
    x.fromMe === y.fromMe &&
    a.isSearchMatch === b.isSearchMatch &&
    a.isSearchFocus === b.isSearchFocus &&
    a.isNew === b.isNew
  );
}

export const MessageBubble = memo(function MessageBubble({
  msg, isSearchMatch, isSearchFocus, isNew, onContextMenu, onRetry, onCancelUpload,
}: MessageBubbleProps) {
  const isMine = msg.fromMe;

  if (msg.deleted) {
    return (
      <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
        <span className="px-3 py-1.5 text-[12px] italic text-[#b0b0b0]">Message deleted</span>
      </div>
    );
  }

  const timeStr = formatMessageTime(msg.createdAt, msg.time);
  const hasAttachment = !!msg.attachmentUrl;
  const uploading = msg.status === "sending" && typeof msg.uploadProgress === "number";
  const failed = msg.status === "failed";
  const isMediaThumb = msg.attachmentType === "image" || msg.attachmentType === "video";

  let storyReply: { type: string; storyImage: string; text: string } | null = null;
  try {
    if (msg.text?.startsWith("{")) {
      const p = JSON.parse(msg.text);
      if (p.type === "story_reply") storyReply = p;
    }
  } catch {}

  return (
    <motion.div
      id={`msg-${msg.id}`}
      initial={isNew ? { opacity: 0, y: 6, scale: 0.98 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 32, mass: 0.8 }}
      className={`flex ${isMine ? "justify-end" : "justify-start"} mb-1`}
      onContextMenu={(e) => onContextMenu(e, msg)}
    >
      <div className={`${storyReply ? "" : "max-w-[75%] md:max-w-[65%]"} rounded-2xl overflow-hidden ${
        isSearchFocus
          ? "ring-2 ring-[#F44444] ring-offset-1 ring-offset-white"
          : isSearchMatch
          ? "ring-1 ring-[#F44444]/40"
          : ""
      } ${isMine
          ? "bg-[#F44444] text-white rounded-br-[5px]"
          : "bg-white text-[#0a0a0a] rounded-bl-[5px] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
      } ${failed ? "opacity-90" : ""}`}>
        {storyReply ? (
          <div className="w-[180px] md:w-[220px]">
            <div className="relative w-full aspect-[9/16] rounded-t-2xl overflow-hidden bg-black">
              <Image src={storyReply.storyImage} alt="Story" fill sizes="(max-width: 768px) 180px, 220px" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50" />
              <span className="absolute top-2.5 left-3 text-[9px] text-white/60 font-semibold uppercase tracking-wider">Story Reply</span>
            </div>
            <div className="px-3 py-2 flex items-end justify-between gap-2">
              <span className="text-[13px] font-medium leading-snug">{storyReply.text}</span>
              <span className={`text-[10px] flex-shrink-0 font-medium ${isMine ? "text-white/60" : "text-[#a3a3a3]"}`}>{timeStr}</span>
            </div>
          </div>
        ) : (
          <div className="px-4 py-3">
            {hasAttachment && (
              <div className="mb-2 relative">
                {msg.attachmentType === "image" && <ImageAttachment url={msg.attachmentUrl} name={msg.attachmentName} />}
                {msg.attachmentType === "video" && <VideoAttachment url={msg.attachmentUrl} name={msg.attachmentName} />}
                {msg.attachmentType === "document" && <DocumentAttachment url={msg.attachmentUrl} name={msg.attachmentName} size={msg.attachmentSize} />}
                {msg.attachmentType === "audio" && <AudioAttachment url={msg.attachmentUrl} name={msg.attachmentName} mine={isMine} />}
                {uploading && isMediaThumb && (
                  <div className="absolute inset-0 bg-black/40 rounded-xl flex flex-col items-center justify-center gap-1">
                    <div className="w-7 h-7 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span className="text-[10px] text-white font-medium tabular-nums">{msg.uploadProgress}%</span>
                    <button
                      onClick={() => onCancelUpload(msg)}
                      aria-label="Cancel upload"
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white/90"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
            {msg.text && (!hasAttachment || msg.text !== msg.attachmentName) && (
              <p className="text-[14px] md:text-[15px] leading-relaxed">{msg.text}</p>
            )}

            {failed ? (
              <button
                onClick={() => onRetry(msg)}
                className={`flex items-center gap-1 mt-1.5 text-[11px] font-medium ${isMine ? "text-white/90" : "text-[#F44444]"}`}
              >
                <AlertCircle className="w-3 h-3" /> Failed · Tap to retry
              </button>
            ) : uploading && hasAttachment && !isMediaThumb ? (
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex-1 h-1 rounded-full bg-white/25 overflow-hidden">
                  <div className="h-full bg-white rounded-full transition-[width]" style={{ width: `${msg.uploadProgress}%` }} />
                </div>
                <span className="text-[10px] tabular-nums text-white/80">{msg.uploadProgress}%</span>
                <button onClick={() => onCancelUpload(msg)} aria-label="Cancel upload" className="text-white/80 hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className={`flex items-center justify-end gap-1 mt-1.5 ${isMine ? "text-white/60" : "text-[#a3a3a3]"}`}>
                {msg.edited && <span className="text-[10px] italic">edited</span>}
                <span className="text-[11px] font-medium">{timeStr}</span>
                {/* Media uploads show progress in the overlay; others show status. */}
                {!uploading && isMine && <MessageStatus status={msg.status || "sent"} light={true} />}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}, bubblePropsEqual);

// --- Conversation List Row (memoized) ---
// Primitive props only, so a poll that leaves this thread unchanged skips its
// re-render entirely — keeps large conversation lists smooth.

export interface ConversationRowProps {
  convoId: number;
  name: string;
  avatar?: string | null;
  handle?: string;
  verified?: boolean;
  encrypted?: boolean;
  lastMessage: string;
  time: string;
  unreadCount: number;
  online: boolean;
  typing: boolean;
  isActive: boolean;
  onSelect: (id: number) => void;
}

export const ConversationRow = memo(function ConversationRow({
  convoId, name, avatar, verified, encrypted, lastMessage, time, unreadCount, online, typing, isActive, onSelect,
}: ConversationRowProps) {
  return (
    <button
      onClick={() => onSelect(convoId)}
      className={`w-full flex items-center gap-4 px-6 py-4 text-left transition-colors border-b border-[#f5f5f5] border-l-2 ${
        isActive ? "bg-[#fef2f2] border-l-[#F44444]" : "border-l-transparent hover:bg-[#fafafa]"
      }`}
    >
      <div className="relative flex-shrink-0">
        <Avatar src={avatar || ""} name={name} size={56} className="ring-1 ring-black/[0.06]" />
        {online && (
          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#22c55e] ring-2 ring-white" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`text-[15px] truncate ${unreadCount > 0 ? "font-semibold text-[#0a0a0a]" : "font-medium text-[#0a0a0a]"}`}>
              {name}
            </span>
            {verified && <VerifiedBadge className="scale-90 flex-shrink-0" />}
            {encrypted && <Lock className="w-3 h-3 text-[#22c55e] flex-shrink-0" />}
          </div>
          <span className="text-[12px] text-[#b0b0b0] flex-shrink-0">{time}</span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-1">
          {typing ? (
            <span className="text-[13px] text-[#F44444] font-medium">typing...</span>
          ) : (
            <span className={`text-[13px] truncate ${unreadCount > 0 ? "text-[#525252] font-medium" : "text-[#a3a3a3]"}`}>
              {lastMessage}
            </span>
          )}
          {unreadCount > 0 && (
            <span className="min-w-[22px] h-[22px] px-1 rounded-full bg-[#F44444] text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
});

// --- New Conversation Modal ---

export function NewConversationModal({ currentUserId, onSelect, onClose }: {
  currentUserId: number;
  onSelect: (user: any) => void;
  onClose: () => void;
}) {
  const PAGE = 20;
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [status, setStatus] = useState<"loading" | "loadingMore" | "ready" | "error">("loading");
  const [hasMore, setHasMore] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const reqIdRef = useRef(0);

  // Debounce keystrokes so we don't fire a request per character.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async (q: string, skip: number, append: boolean) => {
    const reqId = ++reqIdRef.current;
    setStatus(append ? "loadingMore" : "loading");
    try {
      const result = await api.getCircleUsers({
        excludeUserId: currentUserId, q: q || undefined, skip, limit: PAGE,
      });
      if (reqId !== reqIdRef.current) return; // a newer request superseded this one
      const rows: any[] = Array.isArray(result?.users) ? result.users : [];
      setUsers(prev => (append ? [...prev, ...rows] : rows));
      setHasMore(!!result?.hasMore);
      setStatus("ready");
    } catch {
      if (reqId !== reqIdRef.current) return;
      if (!append) setUsers([]);
      setStatus("error");
    }
  }, [currentUserId]);

  // Reload from the top whenever the debounced query changes.
  useEffect(() => { load(debouncedQuery, 0, false); }, [debouncedQuery, load]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el || !hasMore || status === "loading" || status === "loadingMore") return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) {
      load(debouncedQuery, users.length, true);
    }
  };

  const searching = status === "loading";
  const showFullSpinner = searching && users.length === 0;
  const showError = status === "error" && users.length === 0;
  const showEmpty = status === "ready" && users.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ type: "spring", stiffness: 500, damping: 35 }}
        className="bg-white w-full sm:max-w-sm sm:mx-4 sm:rounded-2xl rounded-t-2xl max-h-[70vh] flex flex-col overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.15)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 pt-4 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#f5f5f5] transition-colors">
              <X className="w-4 h-4 text-[#737373]" />
            </button>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#b0b0b0]" />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search members..."
                className="w-full bg-[#f5f5f5] rounded-xl pl-8 pr-8 py-2 text-[13px] text-[#0a0a0a] placeholder:text-[#b0b0b0] outline-none focus:ring-2 focus:ring-[#F44444]/10"
              />
              {searching && users.length > 0 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-[#efefef] border-t-[#F44444] rounded-full animate-spin" />
              )}
            </div>
          </div>
        </div>
        <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto">
          {showFullSpinner ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-[#efefef] border-t-[#F44444] rounded-full animate-spin" />
            </div>
          ) : showError ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <p className="text-[13px] text-[#b0b0b0]">Couldn&apos;t load members</p>
              <button
                onClick={() => load(debouncedQuery, 0, false)}
                className="text-[13px] text-[#F44444] font-medium hover:underline"
              >
                Retry
              </button>
            </div>
          ) : showEmpty ? (
            <p className="text-center py-8 text-[13px] text-[#b0b0b0]">
              {debouncedQuery ? "No members found" : "No members available"}
            </p>
          ) : (
            <>
              {users.map(u => (
                <button key={u.id} onClick={() => onSelect(u)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#fafafa] transition-colors text-left">
                  <div className="relative flex-shrink-0">
                    <Avatar src={u.avatar} name={u.name} size={36} className="ring-1 ring-black/[0.06]" />
                    {isOnline(u.lastSeenAt) && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#22c55e] ring-[1.5px] ring-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[13px] font-medium text-[#0a0a0a] truncate">{u.name}</span>
                      {u.verified && <VerifiedBadge className="scale-75 flex-shrink-0" />}
                    </div>
                    <span className="text-[11px] text-[#a3a3a3] truncate block">{u.title}</span>
                  </div>
                </button>
              ))}
              {status === "loadingMore" && (
                <div className="flex justify-center py-4">
                  <div className="w-4 h-4 border-2 border-[#efefef] border-t-[#F44444] rounded-full animate-spin" />
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// --- In-Chat Search Bar ---

export function ChatSearchBar({ conversationId, onNavigate, onClose }: {
  conversationId: number;
  onNavigate: (messageId: number | null, matchIds: number[]) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<number[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); onNavigate(null, []); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      api.searchMessages(conversationId, query.trim()).then(data => {
        const ids = data.results.map((r: any) => r.id);
        setResults(ids); setCurrentIdx(0); onNavigate(ids[0] ?? null, ids);
      }).catch(() => {});
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, conversationId]);

  const navigate = (dir: 1 | -1) => {
    if (!results.length) return;
    const next = (currentIdx + dir + results.length) % results.length;
    setCurrentIdx(next); onNavigate(results[next], results);
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-[#efefef]">
      <Search className="w-3.5 h-3.5 text-[#b0b0b0] flex-shrink-0" />
      <input
        autoFocus
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search messages..."
        className="flex-1 text-[13px] text-[#0a0a0a] placeholder:text-[#b0b0b0] outline-none min-w-0"
        onKeyDown={e => { if (e.key === "Enter") navigate(1); }}
      />
      {results.length > 0 && (
        <span className="text-[11px] text-[#b0b0b0] flex-shrink-0 tabular-nums">{currentIdx + 1}/{results.length}</span>
      )}
      <button onClick={() => navigate(-1)} className="w-6 h-6 flex items-center justify-center hover:bg-[#f5f5f5] rounded transition-colors" disabled={!results.length}>
        <ArrowUp className="w-3 h-3 text-[#737373]" />
      </button>
      <button onClick={() => navigate(1)} className="w-6 h-6 flex items-center justify-center hover:bg-[#f5f5f5] rounded transition-colors" disabled={!results.length}>
        <ArrowDown className="w-3 h-3 text-[#737373]" />
      </button>
      <button onClick={onClose} className="w-6 h-6 flex items-center justify-center hover:bg-[#f5f5f5] rounded transition-colors">
        <X className="w-3.5 h-3.5 text-[#a3a3a3]" />
      </button>
    </div>
  );
}

// ─── Social Inbox Components ────────────────────────────────────────────────

const PLATFORM_META: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  whatsapp:  { label: "WhatsApp",  color: "#25d366", bg: "#25d36612", icon: MessageCircle },
  instagram: { label: "Instagram", color: "#e1306c", bg: "#e1306c12", icon: InstagramIcon },
  facebook:  { label: "Facebook",  color: "#1877f2", bg: "#1877f212", icon: Facebook },
  messenger: { label: "Messenger", color: "#0084ff", bg: "#0084ff12", icon: MessageCircle },
  twitter:   { label: "X",         color: "#0a0a0a", bg: "#0a0a0a0c", icon: Twitter },
  telegram:  { label: "Telegram",  color: "#229ed9", bg: "#229ed912", icon: TelegramIcon },
  linkedin:  { label: "LinkedIn",  color: "#0a66c2", bg: "#0a66c212", icon: Linkedin },
};

export function PlatformBadge({ platform, size = "sm" }: { platform: string; size?: "xs" | "sm" }) {
  const meta = PLATFORM_META[platform.toLowerCase()] ?? { label: platform, color: "#737373", bg: "#73737315" };
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ${size === "xs" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]"}`}
      style={{ color: meta.color, backgroundColor: meta.bg }}
    >
      {meta.label}
    </span>
  );
}

// Social messages don't carry an explicit attachment type — infer it from the
// stored file's extension instead of adding a schema column for it.
function socialAttachmentKind(url: string): "image" | "video" | "audio" | "file" {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "heic"].includes(ext)) return "image";
  if (["mp4", "mov", "webm", "m4v"].includes(ext)) return "video";
  if (["mp3", "ogg", "oga", "opus", "m4a", "wav"].includes(ext)) return "audio";
  return "file";
}

function SocialAttachment({ url }: { url: string }) {
  const kind = socialAttachmentKind(url);
  if (kind === "image") return <ImageAttachment url={url} />;
  if (kind === "video") return <VideoAttachment url={url} />;
  if (kind === "audio") return <AudioAttachment url={url} />;
  return <DocumentAttachment url={url} />;
}

function threadTime(iso: string): string {
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return "now";
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h`;
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch { return ""; }
}

function AvatarInitials({ handle, platform }: { handle: string | null; platform: string }) {
  const letter = (handle ?? platform).charAt(0).toUpperCase();
  const meta = PLATFORM_META[platform.toLowerCase()] ?? { color: "#737373", bg: "#73737315" };
  return (
    <div className="w-full h-full flex items-center justify-center text-[13px] font-semibold" style={{ color: meta.color, backgroundColor: meta.bg }}>
      {letter}
    </div>
  );
}

export function SocialInbox({
  userId, selectedThreadId, onSelectThread, filterPlatform, onFilterPlatform, hasConnections,
}: {
  userId: number;
  selectedThreadId: number | null;
  onSelectThread: (thread: any) => void;
  filterPlatform: string | null;
  onFilterPlatform: (p: string | null) => void;
  /** Whether the user has at least one connected platform — undefined while still loading. */
  hasConnections?: boolean;
}) {
  const [threads, setThreads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = async (forceSync = false) => {
    if (!userId) return;
    try {
      setLoading(true);
      const res = await api.getSocialThreads(userId, filterPlatform || undefined, forceSync);
      setThreads(res.threads || []);
      setSyncError(res.syncError || null);
    } catch {
      setSyncError("Failed to connect");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [userId, filterPlatform]);

  // Telegram is intentionally excluded — there's no OAuth config for it (see
  // app/api/social/connect/[platform]/route.ts), so no connection can ever
  // exist and this filter chip would always show zero results.
  const platforms = ["whatsapp", "instagram", "facebook", "messenger", "twitter", "linkedin"];

  // Already-loaded, client-side filter — same pattern as the native "Direct"
  // tab's conversation-list search (app/(main)/messages/page.tsx's listSearch),
  // no separate search endpoint needed since threads are small in number and fully in memory.
  const query = search.trim().toLowerCase();
  const visibleThreads = query
    ? threads.filter(t =>
        (t.externalHandle ?? "").toLowerCase().includes(query) ||
        (t.externalUserId ?? "").toLowerCase().includes(query) ||
        (t.lastMessage?.text ?? "").toLowerCase().includes(query)
      )
    : threads;

  return (
    <div className="flex flex-col h-full bg-white">
      {syncError && (
        <div className="mx-3 my-2 px-3 py-2 bg-[#fef2f2] border border-[#fecaca] rounded-xl flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-[#F44444] flex-shrink-0" />
          <span className="flex-1 text-[11px] text-[#F44444] font-medium leading-snug">{syncError}</span>
          <button onClick={() => setSyncError(null)} className="text-[#F44444]/60 hover:text-[#F44444] transition-colors" aria-label="Dismiss error">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Search */}
      {hasConnections !== false && (
        <div className="px-3 pt-2.5 flex-shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 bg-[#f5f5f5] rounded-lg">
            <Search className="w-3.5 h-3.5 text-[#b0b0b0] flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search conversations..."
              aria-label="Search conversations"
              className="flex-1 bg-transparent text-[13px] text-[#0a0a0a] placeholder:text-[#b0b0b0] outline-none min-w-0"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-[#a3a3a3] hover:text-[#737373] transition-colors" aria-label="Clear search">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Platform filter */}
      <div className="px-3 py-2.5 flex items-center gap-1.5 overflow-x-auto border-b border-[#efefef] flex-shrink-0 no-scrollbar">
        <button
          onClick={() => onFilterPlatform(null)}
          className={`flex-shrink-0 px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
            filterPlatform === null
              ? "bg-[#F44444] text-white"
              : "bg-[#f5f5f5] text-[#737373] hover:bg-[#efefef]"
          }`}
        >
          All
        </button>
        {platforms.map(p => {
          const meta = PLATFORM_META[p];
          if (!meta) return null;
          const Icon = meta.icon;
          const active = filterPlatform === p;
          return (
            <button
              key={p}
              onClick={() => onFilterPlatform(active ? null : p)}
              className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                active ? "" : "bg-[#f5f5f5] text-[#737373] hover:bg-[#efefef]"
              }`}
              style={active ? { backgroundColor: meta.bg, color: meta.color } : {}}
              aria-pressed={active}
            >
              <Icon className="w-3 h-3" />
              {meta.label}
            </button>
          );
        })}
        <button onClick={() => load(true)} className="ml-auto p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors flex-shrink-0" aria-label="Refresh conversations">
          <RefreshCw className={`w-3.5 h-3.5 text-[#a3a3a3] ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto">
        {loading && threads.length === 0 && (
          <div className="space-y-px py-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-[#ebebeb] flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="h-3 bg-[#ebebeb] rounded" style={{ width: `${45 + (i % 4) * 12}%` }} />
                  <div className="h-2.5 bg-[#ebebeb] rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && hasConnections === false && (
          <ConnectPlatformBanner userId={userId} />
        )}
        {!loading && hasConnections !== false && visibleThreads.length === 0 && (
          <div className="px-6 py-16 text-center flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#fef2f2] flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-[#F44444]" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-[#0a0a0a]">{query ? "No matches" : "No conversations yet"}</p>
              <p className="text-[12px] text-[#a3a3a3] mt-0.5 max-w-[180px] mx-auto leading-relaxed">
                {query ? "Try a different search term." : "New messages from your connected accounts will show up here."}
              </p>
            </div>
          </div>
        )}
        {visibleThreads.map(thread => (
          <button
            key={thread.id}
            onClick={() => {
              onSelectThread(thread);
              if (thread.unreadCount > 0) {
                setThreads(prev => prev.map(t => t.id === thread.id ? { ...t, unreadCount: 0 } : t));
                api.markSocialThreadRead(thread.id).catch(console.error);
              }
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
              thread.id === selectedThreadId ? "bg-[#fef2f2]" : "hover:bg-[#fafafa]"
            }`}
          >
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-full overflow-hidden ring-1 ring-black/[0.06]">
                {thread.externalAvatarUrl ? (
                  <img src={thread.externalAvatarUrl} alt={thread.externalHandle ?? ""} className="w-full h-full object-cover" />
                ) : (
                  <AvatarInitials handle={thread.externalHandle} platform={thread.platform} />
                )}
              </div>
              <div
                className="absolute -bottom-0.5 -right-0.5 w-[14px] h-[14px] rounded-full ring-[1.5px] ring-white flex items-center justify-center"
                style={{ backgroundColor: PLATFORM_META[thread.platform]?.color ?? "#737373" }}
              >
                {(() => {
                  const Icon = PLATFORM_META[thread.platform]?.icon;
                  return Icon ? <Icon className="w-2 h-2 text-white" /> : null;
                })()}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className={`text-[13px] truncate ${thread.unreadCount > 0 ? "font-semibold text-[#0a0a0a]" : "font-medium text-[#0a0a0a]"}`}>
                  {thread.externalHandle ?? thread.externalUserId ?? "Unknown"}
                </span>
                <span className="text-[11px] text-[#b0b0b0] flex-shrink-0">{threadTime(thread.lastMessageAt)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[12px] truncate ${thread.unreadCount > 0 ? "text-[#525252] font-medium" : "text-[#a3a3a3]"}`}>
                  {thread.lastMessage?.direction === "outbound" && <span className="text-[#b0b0b0] mr-1">You:</span>}
                  {thread.lastMessage?.text ? thread.lastMessage.text : thread.lastMessage?.attachmentUrl ? (
                    <span className="inline-flex items-center gap-1"><Paperclip className="w-3 h-3" />Attachment</span>
                  ) : ""}
                </span>
                {thread.unreadCount > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#F44444] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    {thread.unreadCount > 9 ? "9+" : thread.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function SocialThreadView({ thread, userId, onBack }: { thread: any; userId: number; onBack: () => void }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadMessages = async () => {
    try {
      const res = await api.getSocialMessages(thread.id);
      setMessages(res.messages ?? []);
    } catch {} finally {
      setMessagesLoading(false);
    }
  };

  useEffect(() => { setMessagesLoading(true); loadMessages(); }, [thread.id]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);
  useEffect(() => { if (!showSearch) setSearch(""); }, [showSearch]);

  // Already-loaded, client-side filter — messages for a single thread are
  // fully in memory (no pagination here), so no separate search endpoint is needed.
  const query = search.trim().toLowerCase();
  const visibleMessages = query ? messages.filter(m => (m.text ?? "").toLowerCase().includes(query)) : messages;

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setSendError(null);
    const optimistic = { id: -(Date.now()), text, direction: "outbound", createdAt: new Date().toISOString() };
    setMessages(prev => [...prev, optimistic]);
    setSending(true);
    try {
      const data = await api.sendSocialMessage(thread.id, text);
      if (data.warning) setSendError(`Platform delivery may have failed`);
      loadMessages();
    } catch {
      setSendError("Failed to send. Try again.");
    } finally {
      setSending(false);
    }
  };

  const meta = PLATFORM_META[thread.platform?.toLowerCase()] ?? { label: thread.platform, color: "#737373", bg: "#73737315" };

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-[#efefef] flex-shrink-0">
        <button onClick={onBack} className="md:hidden w-8 h-8 flex items-center justify-center hover:bg-[#f5f5f5] rounded-lg transition-colors -ml-1" aria-label="Back to conversations">
          <X className="w-[15px] h-[15px] text-[#737373]" />
        </button>
        <div className="relative">
          <div className="w-9 h-9 rounded-full overflow-hidden ring-1 ring-black/[0.06]">
            {thread.externalAvatarUrl
              ? <img src={thread.externalAvatarUrl} alt={thread.externalHandle ?? ""} className="w-full h-full object-cover" />
              : <AvatarInitials handle={thread.externalHandle} platform={thread.platform} />
            }
          </div>
          <div
            className="absolute -bottom-0.5 -right-0.5 w-[14px] h-[14px] rounded-full ring-[1.5px] ring-white flex items-center justify-center"
            style={{ backgroundColor: meta.color }}
          >
            {meta.icon && <meta.icon className="w-2 h-2 text-white" />}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-[#0a0a0a] truncate">{thread.externalHandle ?? thread.externalUserId ?? "Unknown"}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <PlatformBadge platform={thread.platform} size="xs" />
            {thread.platformHandle && <span className="text-[11px] text-[#a3a3a3] truncate">{thread.platformHandle}</span>}
          </div>
        </div>
        <button onClick={() => setShowSearch(v => !v)} className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${showSearch ? "bg-[#fef2f2] text-[#F44444]" : "hover:bg-[#f5f5f5] text-[#a3a3a3]"}`} aria-label="Search in conversation" aria-pressed={showSearch}>
          <Search className="w-[14px] h-[14px]" />
        </button>
        <button onClick={loadMessages} className="w-8 h-8 flex items-center justify-center hover:bg-[#f5f5f5] rounded-lg transition-colors" aria-label="Refresh conversation">
          <RefreshCw className="w-[14px] h-[14px] text-[#a3a3a3]" />
        </button>
      </div>

      {/* In-thread search */}
      {showSearch && (
        <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-[#efefef] flex-shrink-0">
          <Search className="w-3.5 h-3.5 text-[#b0b0b0] flex-shrink-0" />
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search messages..."
            aria-label="Search messages in this conversation"
            className="flex-1 text-[13px] text-[#0a0a0a] placeholder:text-[#b0b0b0] outline-none min-w-0"
          />
          {search && (
            <span className="text-[11px] text-[#b0b0b0] flex-shrink-0 tabular-nums">{visibleMessages.length} match{visibleMessages.length === 1 ? "" : "es"}</span>
          )}
          <button onClick={() => setShowSearch(false)} className="w-6 h-6 flex items-center justify-center hover:bg-[#f5f5f5] rounded transition-colors" aria-label="Close search">
            <X className="w-3.5 h-3.5 text-[#a3a3a3]" />
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0 no-scrollbar">
        {messagesLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-5 h-5 border-2 border-[#efefef] border-t-[#F44444] rounded-full animate-spin" />
          </div>
        ) : visibleMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <p className="text-[13px] text-[#b0b0b0]">{query ? "No matching messages" : "No messages in this thread"}</p>
          </div>
        )}
        <div className="flex flex-col gap-1">
          {visibleMessages.map((msg: any, i: number) => {
            const isMine = msg.direction === "outbound";
            const timeStr = formatMessageTime(msg.createdAt, "");
            const showDate = i === 0 || getDateLabel(msg.createdAt) !== getDateLabel(visibleMessages[i - 1]?.createdAt);
            const isLastOutbound = isMine && i === visibleMessages.map((m: any) => m.direction).lastIndexOf("outbound");
            // Status ladder: sending (optimistic, not yet saved) → retrying
            // (send failed transiently, background sweep keeps trying — see
            // lib/workers/social-sync-worker.ts) → read (only the platforms
            // that report receipts — Instagram/Messenger/WhatsApp — ever set
            // msg.read; everywhere else it just stays false, so this quietly
            // never shows "read" there) → sent (the honest default everywhere else).
            const msgStatus = !isMine ? null
              : msg.id < 0 ? "sending"
              : msg.deliveryFailed ? "retrying"
              : isLastOutbound && msg.read ? "read"
              : "sent";
            return (
              <div key={msg.id ?? i}>
                {showDate && <DateSeparator label={getDateLabel(msg.createdAt)} />}
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 32 }}
                  className={`flex mb-0.5 ${isMine ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[72%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed ${
                    isMine
                      ? "bg-[#F44444] text-white rounded-br-[5px]"
                      : "bg-[#f5f5f5] text-[#0a0a0a] rounded-bl-[5px]"
                  }`}>
                    {msg.attachmentUrl && (
                      <div className={msg.text ? "mb-2" : ""}>
                        <SocialAttachment url={msg.attachmentUrl} />
                      </div>
                    )}
                    {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
                    <p className={`flex items-center justify-end gap-1 text-[10px] font-medium mt-1 ${isMine ? "text-white/60" : "text-[#a3a3a3]"}`}>
                      {timeStr}
                      {msgStatus && <MessageStatus status={msgStatus} light={isMine} />}
                    </p>
                  </div>
                </motion.div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-[#efefef] bg-white flex-shrink-0">
        {sendError && <p className="text-[11px] text-[#F44444] mb-2">{sendError}</p>}
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={`Reply on ${meta.label}...`}
            className="flex-1 bg-[#f5f5f5] rounded-xl px-4 py-2.5 text-[13px] text-[#0a0a0a] placeholder:text-[#b0b0b0] outline-none focus:ring-2 focus:ring-[#F44444]/10"
          />
          <motion.button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            aria-label="Send message"
            whileTap={{ scale: 0.88 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
            className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
              input.trim() ? "bg-[#F44444] hover:bg-[#e03c3c]" : "bg-[#f5f5f5]"
            }`}
          >
            {sending
              ? <div className="w-3.5 h-3.5 border-[1.5px] border-[#a3a3a3] border-t-[#525252] rounded-full animate-spin" />
              : <Send className={`w-[14px] h-[14px] ml-0.5 ${input.trim() ? "text-white" : "text-[#b0b0b0]"}`} />
            }
          </motion.button>
        </div>
      </div>
    </div>
  );
}

export function ConnectPlatformBanner({ userId }: { userId: number }) {
  const platforms = [
    { id: "whatsapp", label: "WhatsApp" },
    { id: "instagram", label: "Instagram" },
    { id: "messenger", label: "Messenger" },
    { id: "twitter", label: "X / Twitter" },
    { id: "linkedin", label: "LinkedIn" },
    // Telegram is intentionally omitted here: there's no OAuth config for it
    // (app/api/social/connect/[platform] has no "telegram" entry), so this
    // link would 400. Sending-side Telegram code is left in place — it just
    // can't be reached until a real connect flow exists for it.
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white">
      <p className="text-[15px] font-semibold text-[#0a0a0a] mb-1">Connect a platform</p>
      <p className="text-[13px] text-[#737373] mb-6 max-w-[220px] leading-relaxed">
        Link your social accounts to manage all conversations from one place.
      </p>
      <div className="flex flex-col gap-2 w-full max-w-[200px]">
        {platforms.map(p => {
          const meta = PLATFORM_META[p.id] ?? { color: "#737373", bg: "#73737315" };
          return (
            <a
              key={p.id}
              href={`/api/social/connect/${p.id}?userId=${userId}`}
              className="flex items-center justify-between px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-opacity hover:opacity-80"
              style={{ color: meta.color, backgroundColor: meta.bg }}
            >
              <span>{p.label}</span>
              <Plus className="w-3.5 h-3.5" />
            </a>
          );
        })}
      </div>
    </div>
  );
}
