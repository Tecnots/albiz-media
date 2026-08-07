"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import { api } from "@/app/lib/api";
import { VerifiedBadge } from "@/app/lib/shared-components";

interface MentionUser {
  id: number;
  name: string;
  handle: string;
  avatar: string | null;
  verified: boolean;
}

// Lightweight inline search popover for the Story mention sticker. Renders
// via a portal to avoid positioning issues caused by the parent sticker's
// CSS transform (translate/rotate/scale). The panel is positioned relative
// to the viewport using getBoundingClientRect of the trigger element.
export function MentionPicker({
  excludeUserId,
  onSelect,
  onClose,
}: {
  excludeUserId?: number;
  onSelect: (user: MentionUser) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MentionUser[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Calculate position based on trigger element
  useEffect(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const panelWidth = 264;
    const panelHeight = 320;
    // Position below the trigger, centered horizontally
    let left = rect.left + rect.width / 2 - panelWidth / 2;
    let top = rect.bottom + 4;
    // Keep within viewport
    if (left < 8) left = 8;
    if (left + panelWidth > window.innerWidth - 8) left = window.innerWidth - panelWidth - 8;
    if (top + panelHeight > window.innerHeight - 8) {
      // Position above if not enough space below
      top = rect.top - panelHeight - 4;
    }
    setPos({ top, left });
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      api.searchUsers(query.trim(), excludeUserId)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, excludeUserId]);

  const panel = pos ? (
    <div
      ref={panelRef}
      className="fixed z-[300] w-[264px] bg-white rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.15)] border border-[#efefef] overflow-hidden"
      style={{ top: pos.top, left: pos.left }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#f5f5f5]">
        <Search className="w-3.5 h-3.5 text-[#b0b0b0] flex-shrink-0" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people..."
          className="flex-1 text-[13px] text-[#0a0a0a] placeholder:text-[#b0b0b0] outline-none min-w-0"
        />
        <button type="button" onClick={onClose} className="flex-shrink-0 text-[#b0b0b0] hover:text-[#737373] cursor-pointer">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="max-h-56 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-5">
            <div className="w-4 h-4 border-2 border-[#efefef] border-t-[#F44444] rounded-full animate-spin" />
          </div>
        ) : results.length === 0 ? (
          <p className="text-center py-5 text-[12px] text-[#b0b0b0]">{query.trim() ? "No one found" : "Type a name to search"}</p>
        ) : (
          results.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => onSelect(u)}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#fafafa] transition-colors text-left cursor-pointer"
            >
              <div className="w-7 h-7 rounded-full overflow-hidden ring-1 ring-black/[0.06] bg-[#f5f5f5] flex items-center justify-center flex-shrink-0">
                {u.avatar
                  ? <Image src={u.avatar} alt={u.name} width={28} height={28} className="object-cover w-full h-full" />
                  : <span className="text-[11px] font-semibold text-[#a3a3a3]">{(u.name || "?").charAt(0).toUpperCase()}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-[12px] font-medium text-[#0a0a0a] truncate">{u.name}</span>
                  {u.verified && <VerifiedBadge className="scale-[0.6] flex-shrink-0" />}
                </div>
                <span className="text-[11px] text-[#a3a3a3] truncate block">@{u.handle}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  ) : null;

  return (
    <span ref={triggerRef}>
      {typeof document !== "undefined" && panel && createPortal(panel, document.body)}
    </span>
  );
}
