"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, Plus, Search, Send, X, ChevronDown, Copy, Trash2, TestTube2, PauseCircle,
} from "lucide-react";

// ── types ─────────────────────────────────────────────────────────────────────

interface Campaign {
  id: string; name: string; subject: string; status: string; audienceType: string;
  recipientCount: number; deliveredCount: number; failedCount: number;
  scheduledAt: string | null; sentAt: string | null; createdAt: string;
  channels: string[]; tags: string[]; priority: number;
  createdBy: { name: string } | null;
}

interface AudienceCount { total: number; withPushTokens: number }

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: "#f5f5f5", text: "#525252", label: "Draft" },
  scheduled: { bg: "#FEF3C7", text: "#D97706", label: "Scheduled" },
  sending: { bg: "#DBEAFE", text: "#2563EB", label: "Sending" },
  sent: { bg: "#DCFCE7", text: "#16A34A", label: "Sent" },
  cancelled: { bg: "#FEE2E2", text: "#DC2626", label: "Cancelled" },
};

const AUDIENCE_LABELS: Record<string, string> = {
  all: "All users", authors: "Authors", editors: "Editors", circle: "Circle",
  uploaders: "Uploaders", verified: "Verified", premium: "Premium",
  admin: "Admins", active: "Active (30d)", inactive: "Inactive (90d)", role: "By role",
};

const AUDIENCE_TYPES = Object.keys(AUDIENCE_LABELS);

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { bg: "#f5f5f5", text: "#525252", label: status };
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ backgroundColor: s.bg, color: s.text }}>
      {s.label}
    </span>
  );
}

// ── create form ───────────────────────────────────────────────────────────────

const DEFAULT_FORM = {
  name: "", subject: "", bodyHtml: "", audienceType: "all",
  channels: ["email"] as string[],
  messageTitle: "", notificationBody: "", previewText: "",
  tags: [] as string[], internalNotes: "", scheduledAt: "",
};

function CreateDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [audienceCount, setAudienceCount] = useState<AudienceCount | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchCount = useCallback(async (aud: string) => {
    const res = await fetch(`/api/admin/campaigns/audience-count?audienceType=${aud}`);
    if (res.ok) setAudienceCount(await res.json());
  }, []);

  useEffect(() => { fetchCount(form.audienceType); }, [form.audienceType, fetchCount]);

  const toggleChannel = (ch: string) => {
    setForm(f => ({
      ...f,
      channels: f.channels.includes(ch)
        ? f.channels.filter(c => c !== ch)
        : [...f.channels, ch],
    }));
  };

  const submit = async () => {
    setError("");
    if (!form.name.trim()) { setError("Name is required"); return; }
    if (!form.subject.trim()) { setError("Subject is required"); return; }
    if (!form.bodyHtml.trim()) { setError("Body is required"); return; }
    if (form.channels.length === 0) { setError("Select at least one channel"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          scheduledAt: form.scheduledAt || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Failed to create");
        return;
      }
      onCreated();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden"
        initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 40 }}>

        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0]">
          <p className="text-sm font-semibold text-[#0a0a0a]">New broadcast</p>
          <button onClick={onClose} className="text-[#a3a3a3] hover:text-[#0a0a0a] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <p className="text-xs text-[#DC2626] bg-[#FEE2E2] px-3 py-2 rounded-lg">{error}</p>
          )}

          <Field label="Name">
            <input className="input-base" placeholder="Internal name" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </Field>

          <Field label="Subject line">
            <input className="input-base" placeholder="Email subject" value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
          </Field>

          <Field label="Preview text">
            <input className="input-base" placeholder="Short preview shown in inbox" value={form.previewText}
              onChange={e => setForm(f => ({ ...f, previewText: e.target.value }))} />
          </Field>

          <Field label="Channels">
            <div className="flex gap-2">
              {["email", "push"].map(ch => (
                <button key={ch} type="button" onClick={() => toggleChannel(ch)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${form.channels.includes(ch)
                      ? "bg-[#0a0a0a] text-white border-[#0a0a0a]"
                      : "bg-white text-[#525252] border-[#e5e5e5] hover:border-[#a3a3a3]"
                    }`}>
                  {ch}
                </button>
              ))}
            </div>
          </Field>

          {form.channels.includes("push") && (
            <>
              <Field label="Push title">
                <input className="input-base" placeholder="Notification title" value={form.messageTitle}
                  onChange={e => setForm(f => ({ ...f, messageTitle: e.target.value }))} />
              </Field>
              <Field label="Push body">
                <input className="input-base" placeholder="Notification body" value={form.notificationBody}
                  onChange={e => setForm(f => ({ ...f, notificationBody: e.target.value }))} />
              </Field>
            </>
          )}

          <Field label="Audience">
            <div className="flex flex-col gap-1">
              <select className="input-base" value={form.audienceType}
                onChange={e => setForm(f => ({ ...f, audienceType: e.target.value }))}>
                {AUDIENCE_TYPES.map(a => (
                  <option key={a} value={a}>{AUDIENCE_LABELS[a]}</option>
                ))}
              </select>
              {audienceCount && (
                <p className="text-[11px] text-[#737373]">
                  {fmt(audienceCount.total)} recipients
                  {form.channels.includes("push")
                    ? ` · ${fmt(audienceCount.withPushTokens)} with push`
                    : ""}
                </p>
              )}
            </div>
          </Field>

          <Field label="Body (HTML)">
            <textarea className="input-base font-mono text-xs min-h-[120px] resize-y" placeholder="<p>Hello…</p>"
              value={form.bodyHtml} onChange={e => setForm(f => ({ ...f, bodyHtml: e.target.value }))} />
          </Field>

          <Field label="Schedule (optional)">
            <input type="datetime-local" className="input-base" value={form.scheduledAt}
              onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} />
          </Field>

          <Field label="Internal notes">
            <textarea className="input-base min-h-[60px] resize-none" placeholder="Notes for the team"
              value={form.internalNotes} onChange={e => setForm(f => ({ ...f, internalNotes: e.target.value }))} />
          </Field>
        </div>

        {/* footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#f0f0f0]">
          <button onClick={onClose} className="px-4 py-2 text-xs text-[#525252] hover:text-[#0a0a0a] transition-colors">
            Cancel
          </button>
          <button onClick={submit} disabled={saving}
            className="px-4 py-2 bg-[#0a0a0a] text-white text-xs font-medium rounded-lg hover:bg-[#222] disabled:opacity-50 transition-colors flex items-center gap-1.5">
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
            Save as draft
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-[#525252]">{label}</p>
      {children}
    </div>
  );
}

// ── confirm dialog ────────────────────────────────────────────────────────────

function ConfirmDialog({
  title, description, confirmLabel, destructive, onConfirm, onClose, loading,
}: {
  title: string; description: string; confirmLabel: string; destructive?: boolean;
  onConfirm: () => void; onClose: () => void; loading: boolean;
}) {
  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
        initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 40 }}>
        <p className="text-sm font-semibold text-[#0a0a0a] mb-1">{title}</p>
        <p className="text-xs text-[#737373] mb-5">{description}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose}
            className="px-3 py-1.5 text-xs text-[#525252] hover:text-[#0a0a0a] transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className={`px-4 py-1.5 text-xs font-medium rounded-lg text-white transition-colors flex items-center gap-1.5 disabled:opacity-50 ${destructive ? "bg-[#DC2626] hover:bg-[#B91C1C]" : "bg-[#0a0a0a] hover:bg-[#222]"
              }`}>
            {loading && <Loader2 className="w-3 h-3 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── row ───────────────────────────────────────────────────────────────────────

function CampaignRow({
  c, onAction,
}: {
  c: Campaign;
  onAction: (action: "send" | "cancel" | "duplicate" | "delete" | "test", id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const deliveryRate = c.recipientCount > 0
    ? Math.round((c.deliveredCount / c.recipientCount) * 100) : null;

  return (
    <tr className="hover:bg-[#fafafa] transition-colors border-b border-[#f5f5f5] last:border-0">
      <td className="px-4 py-3">
        <p className="text-sm text-[#0a0a0a] truncate max-w-[220px]">{c.name}</p>
        <p className="text-[11px] text-[#a3a3a3] mt-0.5 truncate max-w-[220px]">{c.subject}</p>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={c.status} />
      </td>
      <td className="px-4 py-3 text-xs text-[#525252]">
        {AUDIENCE_LABELS[c.audienceType] ?? c.audienceType}
      </td>
      <td className="px-4 py-3 text-xs text-[#0a0a0a] tabular-nums">
        {fmt(c.recipientCount)}
      </td>
      <td className="px-4 py-3 text-xs tabular-nums">
        {deliveryRate !== null ? (
          <span className={deliveryRate >= 90 ? "text-[#16A34A]" : deliveryRate >= 70 ? "text-[#D97706]" : "text-[#DC2626]"}>
            {deliveryRate}%
          </span>
        ) : <span className="text-[#a3a3a3]">—</span>}
      </td>
      <td className="px-4 py-3 text-xs text-[#a3a3a3]">
        {c.sentAt ? fmtDate(c.sentAt) : c.scheduledAt ? `Scheduled ${fmtDate(c.scheduledAt)}` : fmtDate(c.createdAt)}
      </td>
      <td className="px-4 py-3">
        <div className="relative flex items-center gap-1 justify-end" ref={ref}>
          {c.status === "draft" && (
            <button onClick={() => onAction("send", c.id)}
              className="p-1.5 rounded-lg text-[#737373] hover:text-[#0a0a0a] hover:bg-[#f5f5f5] transition-colors"
              title="Send now">
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={() => setMenuOpen(v => !v)}
            className="p-1.5 rounded-lg text-[#737373] hover:text-[#0a0a0a] hover:bg-[#f5f5f5] transition-colors">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div className="absolute right-0 top-full mt-1 w-40 bg-white border border-[#e5e5e5] rounded-xl shadow-lg overflow-hidden z-20"
                initial={{ opacity: 0, scale: 0.96, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -4 }}
                transition={{ type: "spring", stiffness: 500, damping: 40 }}>
                <button onClick={() => { onAction("test", c.id); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#525252] hover:bg-[#f5f5f5] transition-colors">
                  <TestTube2 className="w-3.5 h-3.5" /> Send test
                </button>
                <button onClick={() => { onAction("duplicate", c.id); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#525252] hover:bg-[#f5f5f5] transition-colors">
                  <Copy className="w-3.5 h-3.5" /> Duplicate
                </button>
                {c.status === "sending" && (
                  <button onClick={() => { onAction("cancel", c.id); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#D97706] hover:bg-[#FEF3C7] transition-colors">
                    <PauseCircle className="w-3.5 h-3.5" /> Cancel
                  </button>
                )}
                {c.status === "draft" && (
                  <button onClick={() => { onAction("delete", c.id); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#DC2626] hover:bg-[#FEE2E2] transition-colors">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </td>
    </tr>
  );
}

// ── main ──────────────────────────────────────────────────────────────────────

type DialogState =
  | { type: "create" }
  | { type: "send"; id: string; name: string }
  | { type: "cancel"; id: string; name: string }
  | { type: "delete"; id: string; name: string }
  | { type: "test"; id: string; name: string }
  | null;

export default function BroadcastsTab() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/admin/campaigns?${params}`);
      if (res.ok) {
        const d = await res.json();
        setCampaigns(d.campaigns ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const performAction = async (action: "send" | "cancel" | "duplicate" | "delete" | "test", id: string) => {
    if (action === "send") {
      const c = campaigns.find(x => x.id === id);
      setDialog({ type: "send", id, name: c?.name ?? "" });
    } else if (action === "cancel") {
      const c = campaigns.find(x => x.id === id);
      setDialog({ type: "cancel", id, name: c?.name ?? "" });
    } else if (action === "delete") {
      const c = campaigns.find(x => x.id === id);
      setDialog({ type: "delete", id, name: c?.name ?? "" });
    } else if (action === "test") {
      const c = campaigns.find(x => x.id === id);
      setDialog({ type: "test", id, name: c?.name ?? "" });
    } else if (action === "duplicate") {
      try {
        const res = await fetch(`/api/admin/campaigns/${id}/duplicate`, { method: "POST" });
        if (res.ok) { showToast("Duplicated"); load(); }
      } catch { }
    }
  };

  const confirmAction = async () => {
    if (!dialog || dialog.type === "create") return;
    setActionLoading(true);
    try {
      let url = "", method = "POST";
      if (dialog.type === "send") url = `/api/admin/campaigns/${dialog.id}/send`;
      if (dialog.type === "cancel") url = `/api/admin/campaigns/${dialog.id}/cancel`;
      if (dialog.type === "delete") { url = `/api/admin/campaigns/${dialog.id}`; method = "DELETE"; }
      if (dialog.type === "test") url = `/api/admin/campaigns/${dialog.id}/test`;

      const res = await fetch(url, { method });
      if (res.ok) {
        const msgs: Record<string, string> = {
          send: "Broadcast queued", cancel: "Broadcast cancelled",
          delete: "Deleted", test: "Test sent",
        };
        showToast(msgs[dialog.type] ?? "Done");
        load();
      } else {
        const d = await res.json().catch(() => ({}));
        showToast(d.error ?? "Action failed");
      }
    } finally {
      setActionLoading(false);
      setDialog(null);
    }
  };

  const STATUSES = ["all", "draft", "scheduled", "sending", "sent", "cancelled"];

  return (
    <div className="p-6 space-y-4">
      {/* toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#a3a3a3]" />
          <input
            className="w-full pl-9 pr-3 py-2 bg-white border border-[#e5e5e5] rounded-lg text-xs text-[#0a0a0a] placeholder-[#a3a3a3] focus:outline-none focus:border-[#a3a3a3]"
            placeholder="Search broadcasts…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          {STATUSES.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${statusFilter === s
                  ? "bg-[#0a0a0a] text-white"
                  : "text-[#737373] hover:bg-[#f5f5f5]"
                }`}>
              {s}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <button onClick={() => setDialog({ type: "create" })}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#F44444] text-white text-xs font-medium rounded-lg hover:bg-[#D22] transition-colors">
            <Plus className="w-3.5 h-3.5" />
            New broadcast
          </button>
        </div>
      </div>

      {/* table */}
      <div className="bg-white border border-[#e5e5e5] rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-5 h-5 text-[#F44444] animate-spin" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <p className="text-sm text-[#525252]">No broadcasts</p>
            <p className="text-xs text-[#a3a3a3] mt-1">Create one to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#f0f0f0]">
                  {["Broadcast", "Status", "Audience", "Recipients", "Delivery", "Date", ""].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaigns.map(c => (
                  <CampaignRow key={c.id} c={c} onAction={performAction} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* dialogs */}
      <AnimatePresence>
        {dialog?.type === "create" && (
          <CreateDialog onClose={() => setDialog(null)} onCreated={load} />
        )}
        {(dialog?.type === "send" || dialog?.type === "cancel" ||
          dialog?.type === "delete" || dialog?.type === "test") && dialog && (
            <ConfirmDialog
              title={
                dialog.type === "send" ? "Send broadcast?" :
                  dialog.type === "cancel" ? "Cancel broadcast?" :
                    dialog.type === "delete" ? "Delete broadcast?" :
                      "Send test?"
              }
              description={
                dialog.type === "send" ? `"${dialog.name}" will be queued for delivery to all recipients immediately.` :
                  dialog.type === "cancel" ? `Delivery of "${dialog.name}" will be stopped. Already-sent messages won't be recalled.` :
                    dialog.type === "delete" ? `"${dialog.name}" will be permanently deleted. This cannot be undone.` :
                      `A test version of "${dialog.name}" will be sent to your email and push.`
              }
              confirmLabel={
                dialog.type === "send" ? "Send" :
                  dialog.type === "cancel" ? "Cancel broadcast" :
                    dialog.type === "delete" ? "Delete" :
                      "Send test"
              }
              destructive={dialog.type === "delete" || dialog.type === "cancel"}
              onConfirm={confirmAction}
              onClose={() => setDialog(null)}
              loading={actionLoading}
            />
          )}
      </AnimatePresence>

      {/* toast */}
      <AnimatePresence>
        {toast && (
          <motion.div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0a0a0a] text-white text-xs font-medium px-4 py-2.5 rounded-full shadow-lg z-50"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ type: "spring", stiffness: 500, damping: 40 }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>


    </div>
  );
}
