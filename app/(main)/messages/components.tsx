"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { Search, X, ArrowUp, ArrowDown, Check, CheckCheck, Lock, Plus, User,
  Paperclip, ImagePlus, FileText, Music, Copy, Pencil, Trash2, Bookmark, BookmarkCheck,
  Phone, Video, PhoneOff, Mic, MicOff, VideoOff, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { VerifiedBadge } from "@/app/lib/shared-components";
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

export function MessageStatus({ status }: { status: string }) {
  if (status === "read") return <CheckCheck className="w-3 h-3 text-[#F44444]" />;
  if (status === "delivered") return <CheckCheck className="w-3 h-3 text-[#a3a3a3]" />;
  if (status === "sent") return <Check className="w-3 h-3 text-[#a3a3a3]" />;
  if (status === "sending") return <div className="w-3 h-3 border border-[#d5d5d5] border-t-[#a3a3a3] rounded-full animate-spin" />;
  return null;
}

export function TypingDots() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 4 }}
      transition={{ type: "spring", duration: 0.15 }}
      className="flex justify-start"
    >
      <div className="bg-white rounded-2xl rounded-bl-md shadow-[0_1px_2px_rgba(0,0,0,0.06)] px-4 py-3 flex items-center gap-1">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#a3a3a3]"
            style={{ animation: "typingBounce 1.2s ease-in-out infinite", animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
      <style>{`@keyframes typingBounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-4px); opacity: 1; } }`}</style>
    </motion.div>
  );
}

export function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-2">
      <span className="px-3 py-0.5 rounded-full bg-[#e5e5e5]/60 text-[10px] text-[#737373] font-medium">{label}</span>
    </div>
  );
}

// --- Circle Gate ---

export function CircleGate() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full bg-[#f5f5f5] flex items-center justify-center mx-auto mb-4">
          <Lock className="w-7 h-7 text-[#a3a3a3]" />
        </div>
        <p className="text-[15px] font-semibold text-[#0a0a0a] mb-1">Circle members only</p>
        <p className="text-sm text-[#737373] mb-4">Direct messaging is available exclusively for Circle members. Upgrade your account to start conversations.</p>
        <a href="/settings" className="inline-flex px-5 py-2 rounded-full bg-[#F44444] text-white text-sm font-medium hover:bg-[#d63c3c] transition-colors">Upgrade to Circle</a>
      </div>
    </div>
  );
}

// --- Attachment Renderers ---

export function ImageAttachment({ url, name }: { url: string; name?: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <button onClick={() => setExpanded(true)} className="block max-w-[220px] rounded-lg overflow-hidden">
        <Image src={url} alt={name || "Image"} width={220} height={160} className="object-cover w-full" unoptimized />
      </button>
      {expanded && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center" onClick={() => setExpanded(false)}>
          <Image src={url} alt={name || "Image"} width={800} height={600} className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" unoptimized />
          <button className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20"><X className="w-5 h-5 text-white" /></button>
        </div>
      )}
    </>
  );
}

export function DocumentAttachment({ url, name, size }: { url: string; name?: string; size?: number }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 bg-black/5 rounded-lg px-3 py-2 min-w-[180px] hover:bg-black/10 transition-colors">
      <FileText className="w-8 h-8 text-[#3b82f6] flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{name || "Document"}</p>
        {size && <p className="text-[10px] text-[#a3a3a3]">{formatFileSize(size)}</p>}
      </div>
      <Download className="w-4 h-4 text-[#737373] flex-shrink-0" />
    </a>
  );
}

export function AudioAttachment({ url, name }: { url: string; name?: string }) {
  return (
    <div className="min-w-[200px]">
      <audio controls className="w-full h-8 [&::-webkit-media-controls-panel]:bg-transparent" style={{ maxHeight: 32 }}>
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
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-lg border border-[#e5e5e5] overflow-hidden"
    >
      <button onClick={() => imgRef.current?.click()} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-[#fafafa] transition-colors w-full text-left text-sm">
        <ImagePlus className="w-4 h-4 text-[#22c55e]" />Photo / Video
      </button>
      <button onClick={() => docRef.current?.click()} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-[#fafafa] transition-colors w-full text-left text-sm">
        <FileText className="w-4 h-4 text-[#3b82f6]" />Document
      </button>
      <button onClick={() => audioRef.current?.click()} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-[#fafafa] transition-colors w-full text-left text-sm">
        <Music className="w-4 h-4 text-[#f59e0b]" />Audio
      </button>
      <input ref={imgRef} type="file" accept="image/*,video/*" className="hidden" onChange={e => handleFile(e, "image")} />
      <input ref={docRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar" className="hidden" onChange={e => handleFile(e, "document")} />
      <input ref={audioRef} type="file" accept="audio/*" className="hidden" onChange={e => handleFile(e, "audio")} />
    </motion.div>
  );
}

// --- Attachment Preview (before sending) ---

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
    <div className="flex items-center gap-2 px-3 py-2 bg-[#f5f5f5] border-t border-[#e5e5e5]">
      {preview ? (
        <Image src={preview} alt="Preview" width={40} height={40} className="w-10 h-10 rounded-lg object-cover" unoptimized />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-[#e5e5e5] flex items-center justify-center">
          {type === "document" ? <FileText className="w-5 h-5 text-[#3b82f6]" /> : <Music className="w-5 h-5 text-[#f59e0b]" />}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{file.name}</p>
        <p className="text-[10px] text-[#a3a3a3]">{formatFileSize(file.size)}</p>
      </div>
      <button onClick={onRemove} className="p-1 hover:bg-[#e5e5e5] rounded-lg"><X className="w-4 h-4 text-[#737373]" /></button>
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
    // Adjust position to stay in viewport
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
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="absolute bg-white rounded-xl shadow-lg border border-[#e5e5e5] overflow-hidden min-w-[140px]"
        style={{ left: pos.x, top: pos.y }}
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onCopy} className="flex items-center gap-2 px-3 py-2 hover:bg-[#fafafa] w-full text-left text-[13px]">
          <Copy className="w-3.5 h-3.5 text-[#737373]" />Copy
        </button>
        <button onClick={onSave} className="flex items-center gap-2 px-3 py-2 hover:bg-[#fafafa] w-full text-left text-[13px]">
          {isSaved ? <BookmarkCheck className="w-3.5 h-3.5 text-[#F44444]" /> : <Bookmark className="w-3.5 h-3.5 text-[#737373]" />}
          {isSaved ? "Unsave" : "Save"}
        </button>
        {canEdit && (
          <button onClick={onEdit} className="flex items-center gap-2 px-3 py-2 hover:bg-[#fafafa] w-full text-left text-[13px]">
            <Pencil className="w-3.5 h-3.5 text-[#737373]" />Edit
          </button>
        )}
        {isMine && msg.id > 0 && (
          <button onClick={onDelete} className="flex items-center gap-2 px-3 py-2 hover:bg-[#FFF0F0] w-full text-left text-[13px] text-[#dc2626]">
            <Trash2 className="w-3.5 h-3.5" />Delete
          </button>
        )}
      </motion.div>
    </div>
  );
}

// --- Call Modal ---

export function CallModal({ user, type, onClose }: { user: any; type: "audio" | "video"; onClose: () => void }) {
  const [status, setStatus] = useState<"ringing" | "connected" | "ended">("ringing");
  const [duration, setDuration] = useState(0);

  // Auto-show "coming soon" after 3s of ringing
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
      <div className="flex flex-col items-center gap-4">
        <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-white/10 mb-2">
          {user?.avatar ? (
            <Image src={user.avatar} alt={user.name} width={96} height={96} className="object-cover w-full h-full" />
          ) : (
            <div className="w-full h-full bg-[#262626] flex items-center justify-center">
              <User className="w-10 h-10 text-[#525252]" />
            </div>
          )}
        </div>
        <p className="text-white text-lg font-semibold">{user?.name || "Unknown"}</p>
        <p className="text-white/50 text-sm">
          {status === "ringing" && (type === "audio" ? "Calling..." : "Video calling...")}
          {status === "connected" && formatDuration(duration)}
          {status === "ended" && "Call feature coming soon"}
        </p>
      </div>

      <div className="mt-16 flex items-center gap-6">
        {status === "ringing" && (
          <button onClick={onClose} className="w-14 h-14 rounded-full bg-[#dc2626] flex items-center justify-center hover:bg-[#b91c1c] transition-colors">
            <PhoneOff className="w-6 h-6 text-white" />
          </button>
        )}
        {status === "ended" && (
          <button onClick={onClose} className="px-6 py-2.5 rounded-full bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors">
            Close
          </button>
        )}
      </div>

      <button onClick={onClose} className="absolute top-4 right-4 p-2 text-white/40 hover:text-white/80">
        <X className="w-6 h-6" />
      </button>
    </div>
  );
}

// --- New Conversation Modal ---

export function NewConversationModal({ currentUserId, onSelect, onClose }: { currentUserId: number; onSelect: (user: any) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getCircleUsers(currentUserId, query || undefined)
      .then(setUsers).catch(() => setUsers([])).finally(() => setLoading(false));
  }, [query, currentUserId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 max-h-[70vh] flex flex-col overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-4 pt-4 pb-2 flex items-center gap-3">
          <button onClick={onClose} className="p-1 hover:bg-[#f5f5f5] rounded-lg"><X className="w-5 h-5 text-[#737373]" /></button>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a3a3a3]" />
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search Circle members..."
              className="w-full bg-[#f5f5f5] rounded-full pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-[#e5e5e5] border-t-[#F44444] rounded-full animate-spin" /></div>
          ) : users.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[#a3a3a3]">No Circle members found</div>
          ) : (
            users.map(u => (
              <button key={u.id} onClick={() => onSelect(u)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#fafafa] transition-colors text-left">
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-full overflow-hidden ring-1 ring-[#e5e5e5] bg-[#f0f0f0] flex items-center justify-center">
                    {u.avatar ? <Image src={u.avatar} alt={u.name} width={40} height={40} className="object-cover w-full h-full" />
                      : <span className="text-sm font-semibold text-[#a3a3a3]">{(u.name || "?").charAt(0).toUpperCase()}</span>}
                  </div>
                  {isOnline(u.lastSeenAt) && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#22c55e] ring-2 ring-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-[#0a0a0a] truncate">{u.name}</span>
                    {u.verified && <VerifiedBadge className="scale-75 flex-shrink-0" />}
                  </div>
                  <span className="text-xs text-[#737373] truncate block">{u.title}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// --- In-Chat Search Bar ---

export function ChatSearchBar({ conversationId, onNavigate, onClose }: { conversationId: number; onNavigate: (messageId: number | null, matchIds: number[]) => void; onClose: () => void }) {
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
    <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-[#e5e5e5]">
      <Search className="w-4 h-4 text-[#a3a3a3] flex-shrink-0" />
      <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search in conversation..."
        className="flex-1 text-sm outline-none min-w-0" onKeyDown={e => { if (e.key === "Enter") navigate(1); }} />
      {results.length > 0 && <span className="text-[11px] text-[#a3a3a3] flex-shrink-0 tabular-nums">{currentIdx + 1}/{results.length}</span>}
      <button onClick={() => navigate(-1)} className="p-1 hover:bg-[#f5f5f5] rounded" disabled={!results.length}><ArrowUp className="w-3.5 h-3.5 text-[#737373]" /></button>
      <button onClick={() => navigate(1)} className="p-1 hover:bg-[#f5f5f5] rounded" disabled={!results.length}><ArrowDown className="w-3.5 h-3.5 text-[#737373]" /></button>
      <button onClick={onClose} className="p-1 hover:bg-[#f5f5f5] rounded"><X className="w-4 h-4 text-[#737373]" /></button>
    </div>
  );
}
