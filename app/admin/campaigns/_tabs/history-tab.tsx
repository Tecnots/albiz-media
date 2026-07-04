"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";

// ── types ─────────────────────────────────────────────────────────────────────

interface HistoryEntry {
  id: string; eventType: string; userId: number; userName: string;
  handle: string | null; avatar: string | null;
  meta: Record<string, unknown> | null; createdAt: string;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const EVENT_LABELS: Record<string, string> = {
  CAMPAIGN_CREATED:   "Created",
  CAMPAIGN_SENT:      "Sent",
  CAMPAIGN_CANCELLED: "Cancelled",
  CAMPAIGN_FAILED:    "Failed",
};

const EVENT_STYLE: Record<string, { bg: string; text: string }> = {
  CAMPAIGN_CREATED:   { bg: "#DBEAFE", text: "#2563EB" },
  CAMPAIGN_SENT:      { bg: "#DCFCE7", text: "#16A34A" },
  CAMPAIGN_CANCELLED: { bg: "#FEF3C7", text: "#D97706" },
  CAMPAIGN_FAILED:    { bg: "#FEE2E2", text: "#DC2626" },
};

// ── main ──────────────────────────────────────────────────────────────────────

export default function HistoryTab() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/campaigns/history?page=${p}&limit=50`);
      if (res.ok) {
        const d = await res.json();
        setEntries(d.entries ?? []);
        setTotal(d.total ?? 0);
        setPages(d.pages ?? 1);
      }
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const goPage = (p: number) => {
    setPage(p);
    load(p);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#a3a3a3]">{total} events</p>
      </div>

      <div className="bg-white border border-[#e5e5e5] rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-5 h-5 text-[#F44444] animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <p className="text-sm text-[#525252]">No history</p>
            <p className="text-xs text-[#a3a3a3] mt-1">Broadcast events will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-[#f5f5f5]">
            {entries.map(e => {
              const style = EVENT_STYLE[e.eventType] ?? { bg: "#f5f5f5", text: "#525252" };
              const label = EVENT_LABELS[e.eventType] ?? e.eventType;
              const name = e.meta?.name as string | undefined;
              const campaignId = e.meta?.campaignId as string | undefined;
              const channels = e.meta?.channels as string[] | undefined;
              const recipientCount = e.meta?.recipientCount as number | undefined;

              return (
                <div key={e.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
                      style={{ backgroundColor: style.bg, color: style.text }}>
                      {label}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#0a0a0a] truncate">
                      {name ?? campaignId ?? "—"}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <p className="text-[11px] text-[#a3a3a3]">
                        by <span className="text-[#525252]">{e.userName}</span>
                        {e.handle ? ` @${e.handle}` : ""}
                      </p>
                      {channels && channels.length > 0 && (
                        <div className="flex gap-1">
                          {channels.map(ch => (
                            <span key={ch} className="px-1.5 py-0.5 bg-[#f5f5f5] text-[#737373] text-[10px] rounded capitalize">
                              {ch}
                            </span>
                          ))}
                        </div>
                      )}
                      {recipientCount !== undefined && (
                        <p className="text-[11px] text-[#a3a3a3]">{recipientCount} recipients</p>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-[#a3a3a3] flex-shrink-0 whitespace-nowrap">{fmtDate(e.createdAt)}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => goPage(page - 1)}
            className="p-1.5 rounded-lg text-[#737373] hover:bg-[#f5f5f5] disabled:opacity-40 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-[#525252] tabular-nums">{page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => goPage(page + 1)}
            className="p-1.5 rounded-lg text-[#737373] hover:bg-[#f5f5f5] disabled:opacity-40 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
