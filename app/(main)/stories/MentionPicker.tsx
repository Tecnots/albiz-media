"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
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

// Lightweight inline search popover for the Story mention sticker — same
// debounce pattern as ChatSearchBar, same result-row look as
// NewConversationModal, but a popover rather than a full modal sheet since
// mention-tagging is meant to feel like a quick, in-place action.
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

  return (
    <div
      className="absolute z-40 top-full mt-1 left-0 w-64 bg-white rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.15)] border border-[#efefef] overflow-hidden"
      onMouseDown={(e) => e.stopPropagation()}
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
        <button type="button" onClick={onClose} className="flex-shrink-0 text-[#b0b0b0] hover:text-[#737373]">
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
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#fafafa] transition-colors text-left"
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
  );
}
