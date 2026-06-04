"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { Search, X, ArrowUp, ArrowDown, Check, CheckCheck, Lock, Plus, User,
  Paperclip, ImagePlus, FileText, Music, Copy, Pencil, Trash2, Bookmark, BookmarkCheck,
  Phone, Video, PhoneOff, Mic, MicOff, VideoOff, Download, Send, RefreshCw,
  Twitter, Facebook, Instagram as InstagramIcon, Linkedin, MessageCircle, Send as TelegramIcon, Info
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { VerifiedBadge, isValidSrc } from "@/app/lib/shared-components";
import { api } from "@/app/lib/api";

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

// --- Small Components ---

export function MessageStatus({ status, light = false }: { status: string; light?: boolean }) {
  if (status === "read") return <CheckCheck className={`w-3 h-3 ${light ? "text-white/70" : "text-[#F44444]"}`} />;
  if (status === "delivered") return <CheckCheck className={`w-3 h-3 ${light ? "text-white/50" : "text-[#b0b0b0]"}`} />;
  if (status === "sent") return <Check className={`w-3 h-3 ${light ? "text-white/50" : "text-[#b0b0b0]"}`} />;
  if (status === "sending") return (
    <div className={`w-2.5 h-2.5 border rounded-full animate-spin ${light ? "border-white/20 border-t-white/50" : "border-[#e0e0e0] border-t-[#a3a3a3]"}`} />
  );
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
      <div className="bg-[#f5f5f5] rounded-2xl rounded-bl-[5px] px-4 py-3 flex items-center gap-1.5">
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
    <div className="flex items-center justify-center py-3">
      <span className="text-[11px] text-[#b0b0b0] font-medium">{label}</span>
    </div>
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
  return (
    <>
      <button onClick={() => setExpanded(true)} className="block max-w-[200px] rounded-xl overflow-hidden ring-1 ring-black/[0.06]">
        <Image src={url} alt={name || "Image"} width={200} height={150} className="object-cover w-full" unoptimized />
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

export function AudioAttachment({ url, name }: { url: string; name?: string }) {
  return (
    <div className="min-w-[180px]">
      <audio controls className="w-full h-8" style={{ maxHeight: 32 }}>
        <source src={url} />
      </audio>
      {name && <p className="text-[10px] text-[#a3a3a3] mt-0.5 truncate">{name}</p>}
    </div>
  );
}

// --- Attachment Picker ---

export function AttachmentPicker({ onSelect }: { onSelect: (file: File, type: string) => void }) {
  const imgRef = useRef<HTMLInputElement>(null);
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
      <button onClick={() => docRef.current?.click()} className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-[#fafafa] transition-colors w-full text-left text-[13px] text-[#0a0a0a]">
        <FileText className="w-4 h-4 text-[#3b82f6]" />Document
      </button>
      <button onClick={() => audioRef.current?.click()} className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-[#fafafa] transition-colors w-full text-left text-[13px] text-[#0a0a0a]">
        <Music className="w-4 h-4 text-[#f59e0b]" />Audio
      </button>
      <input ref={imgRef} type="file" accept="image/*,video/*" className="hidden" onChange={e => handleFile(e, "image")} />
      <input ref={docRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar" className="hidden" onChange={e => handleFile(e, "document")} />
      <input ref={audioRef} type="file" accept="audio/*" className="hidden" onChange={e => handleFile(e, "audio")} />
    </motion.div>
  );
}

// --- Attachment Preview ---

export function AttachmentPreview({ file, type, onRemove }: { file: File; type: string; onRemove: () => void }) {
  const [preview, setPreview] = useState<string>("");
  useEffect(() => {
    if (type === "image" && file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file, type]);

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-white border-t border-[#efefef]">
      {preview ? (
        <Image src={preview} alt="Preview" width={36} height={36} className="w-9 h-9 rounded-lg object-cover ring-1 ring-black/[0.06]" unoptimized />
      ) : (
        <div className="w-9 h-9 rounded-lg bg-[#f5f5f5] flex items-center justify-center">
          {type === "document" ? <FileText className="w-4 h-4 text-[#3b82f6]" /> : <Music className="w-4 h-4 text-[#f59e0b]" />}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-[#0a0a0a] truncate">{file.name}</p>
        <p className="text-[11px] text-[#a3a3a3]">{formatFileSize(file.size)}</p>
      </div>
      <button onClick={onRemove} className="w-7 h-7 flex items-center justify-center hover:bg-[#f5f5f5] rounded-lg transition-colors">
        <X className="w-3.5 h-3.5 text-[#a3a3a3]" />
      </button>
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

// --- Call Modal ---

export function CallModal({ user, type, onClose }: { user: any; type: "audio" | "video"; onClose: () => void }) {
  const [status, setStatus] = useState<"ringing" | "connected" | "ended">("ringing");
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setStatus("ended"), 3000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (status !== "connected") return;
    const i = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(i);
  }, [status]);

  const formatDuration = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-[100] bg-[#0a0a0a] flex flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-20 h-20 rounded-full overflow-hidden ring-4 ring-white/5 mb-1">
          {user?.avatar ? (
            <Image src={user.avatar} alt={user.name} width={80} height={80} className="object-cover w-full h-full" />
          ) : (
            <div className="w-full h-full bg-[#1a1a1a] flex items-center justify-center">
              <User className="w-9 h-9 text-[#525252]" />
            </div>
          )}
        </div>
        <p className="text-white text-[17px] font-semibold">{user?.name || "Unknown"}</p>
        <p className="text-[#737373] text-[13px]">
          {status === "ringing" && (type === "audio" ? "Calling..." : "Video calling...")}
          {status === "connected" && formatDuration(duration)}
          {status === "ended" && "Call feature coming soon"}
        </p>
      </div>
      <div className="mt-14 flex items-center gap-5">
        {status === "ringing" && (
          <button onClick={onClose} className="w-14 h-14 rounded-full bg-[#F44444] flex items-center justify-center hover:bg-[#e03c3c] transition-colors">
            <PhoneOff className="w-5 h-5 text-white" />
          </button>
        )}
        {status === "ended" && (
          <button onClick={onClose} className="px-6 py-2.5 rounded-full bg-white/10 text-white text-[13px] font-medium hover:bg-white/20 transition-colors">
            Close
          </button>
        )}
      </div>
      <button onClick={onClose} className="absolute top-4 right-4 p-2 text-[#525252] hover:text-white transition-colors">
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

// --- New Conversation Modal ---

export function NewConversationModal({ currentUserId, onSelect, onClose }: {
  currentUserId: number;
  onSelect: (user: any) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getCircleUsers(currentUserId, query || undefined)
      .then(setUsers).catch(() => setUsers([])).finally(() => setLoading(false));
  }, [query, currentUserId]);

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
                className="w-full bg-[#f5f5f5] rounded-xl pl-8 pr-3 py-2 text-[13px] text-[#0a0a0a] placeholder:text-[#b0b0b0] outline-none focus:ring-2 focus:ring-[#F44444]/10"
              />
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-[#efefef] border-t-[#F44444] rounded-full animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center py-8 text-[13px] text-[#b0b0b0]">No members found</p>
          ) : (
            users.map(u => (
              <button key={u.id} onClick={() => onSelect(u)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#fafafa] transition-colors text-left">
                <div className="relative flex-shrink-0">
                  <div className="w-9 h-9 rounded-full overflow-hidden ring-1 ring-black/[0.06] bg-[#f5f5f5] flex items-center justify-center">
                    {u.avatar
                      ? <Image src={u.avatar} alt={u.name} width={36} height={36} className="object-cover w-full h-full" />
                      : <span className="text-[13px] font-semibold text-[#a3a3a3]">{(u.name || "?").charAt(0).toUpperCase()}</span>
                    }
                  </div>
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
            ))
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
  userId, selectedThreadId, onSelectThread, filterPlatform, onFilterPlatform,
}: {
  userId: number;
  selectedThreadId: number | null;
  onSelectThread: (thread: any) => void;
  filterPlatform: string | null;
  onFilterPlatform: (p: string | null) => void;
}) {
  const [threads, setThreads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);

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

  const platforms = ["whatsapp", "instagram", "facebook", "messenger", "twitter", "telegram", "linkedin"];

  return (
    <div className="flex flex-col h-full bg-white">
      {syncError && (
        <div className="mx-3 my-2 px-3 py-2 bg-[#fef2f2] border border-[#fecaca] rounded-xl flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-[#F44444] flex-shrink-0" />
          <span className="flex-1 text-[11px] text-[#F44444] font-medium leading-snug">{syncError}</span>
          <button onClick={() => setSyncError(null)} className="text-[#F44444]/60 hover:text-[#F44444] transition-colors">
            <X className="w-3 h-3" />
          </button>
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
            >
              <Icon className="w-3 h-3" />
              {meta.label}
            </button>
          );
        })}
        <button onClick={() => load(true)} className="ml-auto p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors flex-shrink-0">
          <RefreshCw className={`w-3.5 h-3.5 text-[#a3a3a3] ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto">
        {loading && threads.length === 0 && (
          <div className="flex justify-center py-10">
            <div className="w-5 h-5 border-2 border-[#efefef] border-t-[#F44444] rounded-full animate-spin" />
          </div>
        )}
        {!loading && threads.length === 0 && (
          <div className="px-6 py-16 text-center flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#fef2f2] flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-[#F44444]" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-[#0a0a0a]">No conversations</p>
              <p className="text-[12px] text-[#a3a3a3] mt-0.5 max-w-[180px] mx-auto leading-relaxed">Connect your social accounts to manage messages here.</p>
            </div>
            <button
              onClick={async () => {
                setLoading(true);
                await api.get(`/debug/seed-social?userId=${userId}`);
                load();
              }}
              className="px-4 py-2 bg-[#F44444] text-white rounded-xl text-[12px] font-semibold hover:bg-[#e03c3c] transition-colors active:scale-95"
            >
              Seed Demo Data
            </button>
          </div>
        )}
        {threads.map(thread => (
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
                  {thread.lastMessage?.text ?? ""}
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
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadMessages = async () => {
    try {
      const res = await api.getSocialMessages(thread.id);
      setMessages(res.messages ?? []);
    } catch {}
  };

  useEffect(() => { loadMessages(); }, [thread.id]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

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
        <button onClick={onBack} className="md:hidden w-8 h-8 flex items-center justify-center hover:bg-[#f5f5f5] rounded-lg transition-colors -ml-1">
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
        <button onClick={loadMessages} className="w-8 h-8 flex items-center justify-center hover:bg-[#f5f5f5] rounded-lg transition-colors">
          <RefreshCw className="w-[14px] h-[14px] text-[#a3a3a3]" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0 no-scrollbar">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <p className="text-[13px] text-[#b0b0b0]">No messages in this thread</p>
          </div>
        )}
        <div className="flex flex-col gap-1">
          {messages.map((msg: any, i: number) => {
            const isMine = msg.direction === "outbound";
            const timeStr = formatMessageTime(msg.createdAt, "");
            const showDate = i === 0 || getDateLabel(msg.createdAt) !== getDateLabel(messages[i - 1]?.createdAt);
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
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    <p className={`text-[10px] font-medium mt-1 text-right ${isMine ? "text-white/60" : "text-[#a3a3a3]"}`}>{timeStr}</p>
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
    { id: "telegram", label: "Telegram" },
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
