"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Search, ChevronLeft, ChevronRight } from "lucide-react";

// ── types ─────────────────────────────────────────────────────────────────────

interface LogRow {
  id: string; campaignId: string; campaignName: string; email: string; name: string;
  status: string; channels: string[]; sentAt: string | null; error: string | null; createdAt: string;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  sent: { bg: "#DCFCE7", text: "#16A34A" },
  failed: { bg: "#FEE2E2", text: "#DC2626" },
  pending: { bg: "#FEF3C7", text: "#D97706" },
  skipped: { bg: "#f5f5f5", text: "#525252" },
};

// ── main ──────────────────────────────────────────────────────────────────────

export default function LogsTab() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "50" });
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/admin/campaigns/logs?${params}`);
      if (res.ok) {
        const d = await res.json();
        setLogs(d.logs ?? []);
        setTotal(d.total ?? 0);
        setPages(d.pages ?? 1);
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const goPage = (p: number) => {
    setPage(p);
    load(p);
  };

  const STATUSES = ["all", "sent", "failed", "pending", "skipped"];

  return (
    <div className="p-6 space-y-4">
      {/* toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#a3a3a3]" />
          <input
            className="w-full pl-9 pr-3 py-2 bg-white border border-[#e5e5e5] rounded-lg text-xs text-[#0a0a0a] placeholder-[#a3a3a3] focus:outline-none focus:border-[#a3a3a3]"
            placeholder="Search by email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          {STATUSES.map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${statusFilter === s ? "bg-[#0a0a0a] text-white" : "text-[#737373] hover:bg-[#f5f5f5]"
                }`}>
              {s}
            </button>
          ))}
        </div>
        <p className="ml-auto text-xs text-[#a3a3a3] tabular-nums">{total} entries</p>
      </div>

      {/* table */}
      <div className="bg-white border border-[#e5e5e5] rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-5 h-5 text-[#F44444] animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <p className="text-sm text-[#525252]">No delivery logs</p>
            <p className="text-xs text-[#a3a3a3] mt-1">Logs appear after broadcasts are sent</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#f0f0f0]">
                  {["Recipient", "Broadcast", "Status", "Channels", "Sent", "Error"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map(row => {
                  const s = STATUS_STYLE[row.status] ?? { bg: "#f5f5f5", text: "#525252" };
                  return (
                    <tr key={row.id} className="border-b border-[#f5f5f5] last:border-0 hover:bg-[#fafafa] transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-xs text-[#0a0a0a] truncate max-w-[180px]">{row.email}</p>
                        {row.name && <p className="text-[11px] text-[#a3a3a3]">{row.name}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#525252] max-w-[160px] truncate">{row.campaignName}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
                          style={{ backgroundColor: s.bg, color: s.text }}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {row.channels.map(ch => (
                            <span key={ch} className="px-1.5 py-0.5 bg-[#f5f5f5] text-[#525252] text-[10px] rounded capitalize">
                              {ch}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#a3a3a3] whitespace-nowrap">{fmtDate(row.sentAt)}</td>
                      <td className="px-4 py-3 text-xs text-[#F44444] max-w-[200px] truncate" title={row.error ?? ""}>
                        {row.error ?? ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* pagination */}
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
