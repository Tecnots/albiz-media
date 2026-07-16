"use client";

import { useEffect, useRef, useState } from "react";
import { Hash, X } from "lucide-react";
import { api } from "@/app/lib/api";

// Same debounced-popover pattern as MentionPicker, browsing/searching
// hashtags already used across Posts and Stories (via /api/hashtag/search)
// instead of a hardcoded suggestion list. Typing a tag with no existing
// match still works — the trailing "Create" row just accepts it literally,
// same char rule (`[a-zA-Z0-9_]`) the sticker's storage already enforces.
export function HashtagPicker({
  value,
  onSelect,
  onClose,
}: {
  value: string;
  onSelect: (tag: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<{ tag: string; uses: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      api.searchHashtags(query.trim())
        .then((res) => setResults(res.results ?? []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const cleanQuery = query.trim().toLowerCase().replace(/[^a-zA-Z0-9_]/g, "");
  const exactMatch = results.some((r) => r.tag === cleanQuery);

  return (
    <div
      className="absolute z-40 top-full mt-1 left-0 w-64 bg-white rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.15)] border border-[#efefef] overflow-hidden"
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#f5f5f5]">
        <Hash className="w-3.5 h-3.5 text-[#b0b0b0] flex-shrink-0" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
          placeholder="Search hashtags..."
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
        ) : (
          <>
            {results.map((r) => (
              <button
                key={r.tag}
                type="button"
                onClick={() => onSelect(r.tag)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-[#fafafa] transition-colors text-left"
              >
                <span className="text-[13px] text-[#0a0a0a]">#{r.tag}</span>
                <span className="text-[11px] text-[#b0b0b0]">{r.uses} {r.uses === 1 ? "use" : "uses"}</span>
              </button>
            ))}
            {cleanQuery && !exactMatch && (
              <button
                type="button"
                onClick={() => onSelect(cleanQuery)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#fafafa] transition-colors text-left border-t border-[#f5f5f5]"
              >
                <span className="text-[13px] text-[#F44444] font-medium">Create #{cleanQuery}</span>
              </button>
            )}
            {results.length === 0 && !cleanQuery && (
              <p className="text-center py-5 text-[12px] text-[#b0b0b0]">Type to search hashtags</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
