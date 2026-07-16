"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Loader2, RefreshCw, Ban, Trash2, ExternalLink, ChevronRight, Globe } from "lucide-react";
import { AdminPillTabs, ConfirmModal, UserAvatar } from "../admin-components";

interface DomainUser {
  id: number;
  name: string;
  handle: string;
  avatar: string | null;
  banned: boolean;
  deactivatedAt: string | null;
  customDomain: string;
  domainStatus: string;
  domainVerificationAttempts: number;
  domainFailureReason: string | null;
  domainVerifiedAt: string | null;
  domainActivatedAt: string | null;
  domainLastCheckedAt: string | null;
}

interface AuditEntry {
  id: string;
  action: string;
  actorId: number | null;
  meta: any;
  createdAt: string;
}

const STATUS_TABS = ["All", "Pending", "In progress", "Active", "Failed", "Disabled"];
const STATUS_FILTERS = ["all", "PENDING", "IN_PROGRESS", "ACTIVE", "FAILED", "DISABLED"];
const IN_PROGRESS_STATUSES = ["DNS_VERIFYING", "DNS_VERIFIED", "SSL_PROVISIONING"];

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  PENDING:          { label: "Pending",     className: "bg-[#f59e0b]/10 text-[#92400e]" },
  DNS_VERIFYING:    { label: "Verifying DNS", className: "bg-[#3b82f6]/10 text-[#1d4ed8]" },
  DNS_VERIFIED:     { label: "DNS verified", className: "bg-[#3b82f6]/10 text-[#1d4ed8]" },
  SSL_PROVISIONING: { label: "Provisioning SSL", className: "bg-[#3b82f6]/10 text-[#1d4ed8]" },
  ACTIVE:           { label: "Active",       className: "bg-[#22c55e]/10 text-[#15803d]" },
  FAILED:           { label: "Failed",       className: "bg-[#F44444]/10 text-[#b91c1c]" },
  DISABLED:         { label: "Disabled",     className: "bg-[#525252]/10 text-[#525252]" },
};

function DomainStatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { label: status, className: "bg-[#f5f5f5] text-[#525252]" };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.className}`}>{s.label}</span>;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminDomainsPage() {
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");
  const [domains, setDomains] = useState<DomainUser[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const [selected, setSelected] = useState<DomainUser | null>(null);
  const [auditHistory, setAuditHistory] = useState<AuditEntry[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const statusParam = STATUS_FILTERS[tab];
      const qs = new URLSearchParams({ page: String(p), limit: "20" });
      if (statusParam !== "all" && statusParam !== "IN_PROGRESS") qs.set("status", statusParam);
      if (search) qs.set("search", search);
      const res = await fetch(`/api/admin/domains?${qs}`);
      if (!res.ok) return;
      const data = await res.json();
      let rows: DomainUser[] = data.domains ?? [];
      if (statusParam === "IN_PROGRESS") rows = rows.filter((r) => IN_PROGRESS_STATUSES.includes(r.domainStatus));
      setDomains(rows);
      setPage(data.page ?? 1);
      setPages(data.pages ?? 1);
      setStats(data.stats ?? {});
    } finally {
      setLoading(false);
    }
  }, [tab, search]);

  useEffect(() => { load(1); }, [load]);

  const openDetail = async (u: DomainUser) => {
    setSelected(u);
    setDetailLoading(true);
    setActionError("");
    try {
      const res = await fetch(`/api/admin/domains/${u.id}`);
      const data = await res.json();
      if (res.ok) setAuditHistory(data.auditHistory ?? []);
    } finally {
      setDetailLoading(false);
    }
  };

  const runAction = async (action: "retry" | "disable" | "remove", reason?: string) => {
    if (!selected) return;
    setActionLoading(true);
    setActionError("");
    try {
      const res = action === "remove"
        ? await fetch(`/api/admin/domains/${selected.id}`, { method: "DELETE" })
        : await fetch(`/api/admin/domains/${selected.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, reason }),
          });
      const data = await res.json();
      if (!res.ok) { setActionError(data.error ?? "Action failed"); return; }
      setShowDisableConfirm(false);
      setShowRemoveConfirm(false);
      setSelected(null);
      load(page);
    } catch {
      setActionError("Something went wrong");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center gap-2 mb-1">
        <Globe className="w-5 h-5 text-[#0a0a0a]" />
        <h1 className="text-lg font-semibold text-[#0a0a0a]">Custom Domains</h1>
      </div>
      <p className="text-sm text-[#737373] mb-5">Every custom domain connected to the platform — ownership verification, SSL provisioning, and moderation.</p>

      <div className="flex items-center gap-4 mb-4">
        <AdminPillTabs tabs={STATUS_TABS} activeTab={tab} onTabChange={(i) => { setTab(i); setPage(1); }} />
        <div className="relative ml-auto w-64">
          <Search className="w-3.5 h-3.5 text-[#a3a3a3] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search domain, name, handle…"
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#e5e5e5] bg-white focus:outline-none focus:border-[#F44444]"
          />
        </div>
      </div>

      <div className="flex gap-2 mb-4 text-[11px] text-[#737373]">
        {Object.entries(stats).map(([k, v]) => (
          <span key={k} className="px-2 py-1 rounded-full bg-[#fafafa] border border-[#f0f0f0]">{STATUS_STYLE[k]?.label ?? k}: <b className="text-[#0a0a0a]">{v}</b></span>
        ))}
      </div>

      <div className="rounded-xl border border-[#e5e5e5] overflow-hidden bg-white">
        {loading ? (
          <div className="py-16 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#a3a3a3]" /></div>
        ) : domains.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#a3a3a3]">No domains match this filter.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#f0f0f0] text-left text-[10px] uppercase tracking-wider text-[#a3a3a3]">
                <th className="px-4 py-2.5 font-medium">Owner</th>
                <th className="px-4 py-2.5 font-medium">Domain</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Last checked</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {domains.map((u) => (
                <tr key={u.id} onClick={() => openDetail(u)} className="border-b border-[#f5f5f5] last:border-0 hover:bg-[#fafafa] cursor-pointer transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <UserAvatar src={u.avatar || undefined} alt={u.name} size={28} />
                      <div>
                        <p className="text-xs font-medium text-[#0a0a0a]">{u.name}</p>
                        <p className="text-[11px] text-[#a3a3a3]">@{u.handle}{u.banned && <span className="text-[#F44444] ml-1">· banned</span>}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[#0a0a0a]">{u.customDomain}</td>
                  <td className="px-4 py-3"><DomainStatusBadge status={u.domainStatus} /></td>
                  <td className="px-4 py-3 text-xs text-[#737373]">{fmtDate(u.domainLastCheckedAt)}</td>
                  <td className="px-4 py-3 text-right"><ChevronRight className="w-4 h-4 text-[#d4d4d4] inline" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between mt-3 text-xs text-[#a3a3a3]">
          <span>Page {page} of {pages}</span>
          <div className="flex gap-2">
            <button onClick={() => load(page - 1)} disabled={page === 1} className="px-2.5 py-1 rounded-lg border border-[#e5e5e5] disabled:opacity-40">Previous</button>
            <button onClick={() => load(page + 1)} disabled={page >= pages} className="px-2.5 py-1 rounded-lg border border-[#e5e5e5] disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !actionLoading && setSelected(null)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-[#f0f0f0] flex items-center gap-3">
              <UserAvatar src={selected.avatar || undefined} alt={selected.name} size={36} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#0a0a0a] truncate">{selected.name}</p>
                <p className="text-xs text-[#a3a3a3]">@{selected.handle}</p>
              </div>
              <DomainStatusBadge status={selected.domainStatus} />
            </div>

            <div className="px-5 py-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#a3a3a3]">Domain</span>
                <a href={`https://${selected.customDomain}`} target="_blank" rel="noreferrer" className="font-mono text-xs text-[#0a0a0a] hover:text-[#F44444] flex items-center gap-1">
                  {selected.customDomain} <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#a3a3a3]">Verification attempts</span>
                <span className="text-xs text-[#0a0a0a]">{selected.domainVerificationAttempts}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#a3a3a3]">DNS verified</span>
                <span className="text-xs text-[#0a0a0a]">{fmtDate(selected.domainVerifiedAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#a3a3a3]">Activated</span>
                <span className="text-xs text-[#0a0a0a]">{fmtDate(selected.domainActivatedAt)}</span>
              </div>
              {selected.domainFailureReason && (
                <div className="p-2.5 rounded-lg bg-[#F44444]/5 border border-[#F44444]/15 text-xs text-[#b91c1c]">
                  {selected.domainFailureReason}
                </div>
              )}

              <div>
                <p className="text-[10px] font-semibold tracking-wider text-[#a3a3a3] uppercase mb-2">Audit history</p>
                {detailLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#a3a3a3]" />
                ) : auditHistory.length === 0 ? (
                  <p className="text-xs text-[#c5c5c5]">No recorded events.</p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {auditHistory.map((a) => (
                      <div key={a.id} className="flex items-center justify-between text-[11px]">
                        <span className="text-[#525252]">{a.action.replace("DOMAIN_", "").replace(/_/g, " ").toLowerCase()}</span>
                        <span className="text-[#a3a3a3]">{fmtDate(a.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {actionError && <p className="text-xs text-[#F44444]">{actionError}</p>}
            </div>

            <div className="px-5 py-3.5 border-t border-[#f0f0f0] flex items-center gap-2">
              <button
                onClick={() => runAction("retry")}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[#e5e5e5] hover:bg-[#fafafa] disabled:opacity-40"
              >
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Retry verification
              </button>
              {selected.domainStatus !== "DISABLED" && (
                <button
                  onClick={() => setShowDisableConfirm(true)}
                  disabled={actionLoading}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[#e5e5e5] text-[#92400e] hover:bg-[#f59e0b]/5 disabled:opacity-40"
                >
                  <Ban className="w-3.5 h-3.5" />
                  Disable
                </button>
              )}
              <button
                onClick={() => setShowRemoveConfirm(true)}
                disabled={actionLoading}
                className="ml-auto flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg text-[#F44444] hover:bg-[#F44444]/5 disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Force remove
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showDisableConfirm}
        onClose={() => setShowDisableConfirm(false)}
        onConfirm={() => runAction("disable", "Disabled by an administrator")}
        title="Disable this domain?"
        message={`${selected?.customDomain} will immediately stop resolving to ${selected?.name}'s profile. The domain stays reserved to their account until removed.`}
        confirmText="Disable domain"
        isSubmitting={actionLoading}
      />
      <ConfirmModal
        isOpen={showRemoveConfirm}
        onClose={() => setShowRemoveConfirm(false)}
        onConfirm={() => runAction("remove")}
        title="Force-remove this domain?"
        message={`${selected?.customDomain} will be fully detached from ${selected?.name}'s account and freed up for anyone to claim.`}
        confirmText="Remove domain"
        isSubmitting={actionLoading}
      />
    </div>
  );
}
