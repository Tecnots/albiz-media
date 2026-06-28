"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Send, X, Trash2, ChevronDown } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  subject: string;
  audienceType: string;
  status: string;
  scheduledAt: string | null;
  sentAt: string | null;
  recipientCount: number;
  deliveredCount: number;
  failedCount: number;
  createdAt: string;
  createdBy: { name: string };
}

const AUDIENCE_LABELS: Record<string, string> = {
  all: "All users",
  authors: "Authors",
  editors: "Editors",
  circle: "Circle",
  verified: "Verified",
  admin: "Admins",
  role: "By role",
};

const STATUS_STYLES: Record<string, string> = {
  draft:     "bg-[#f0f0f0] text-[#525252]",
  sending:   "bg-[#fef9ec] text-[#92400e]",
  sent:      "bg-[#f0fdf4] text-[#166534]",
  cancelled: "bg-[#fafafa] text-[#a3a3a3]",
  failed:    "bg-[#fff1f2] text-[#b91c1c]",
};

function formatRelative(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const EMPTY_FORM = { name: "", subject: "", bodyHtml: "", audienceType: "all" };

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [confirm, setConfirm] = useState<{
    type: "send" | "cancel" | "delete";
    campaign: Campaign;
  } | null>(null);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/campaigns");
      const data = await res.json();
      setCampaigns(data.campaigns ?? []);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    if (!form.name.trim() || !form.subject.trim() || !form.bodyHtml.trim()) {
      setCreateError("All fields are required.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        setCreateError(d.error ?? "Failed to create campaign.");
        return;
      }
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      await load();
    } catch {
      setCreateError("Network error — try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    setConfirming(true);
    try {
      const { type, campaign } = confirm;
      let res: Response;
      if (type === "send") {
        res = await fetch(`/api/admin/campaigns/${campaign.id}/send`, { method: "POST" });
      } else if (type === "cancel") {
        res = await fetch(`/api/admin/campaigns/${campaign.id}/cancel`, { method: "POST" });
      } else {
        res = await fetch(`/api/admin/campaigns/${campaign.id}`, { method: "DELETE" });
      }
      if (res.ok) {
        setConfirm(null);
        await load();
      }
    } catch {
      // non-fatal
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#fafafa]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-[#e5e5e5] flex-shrink-0">
        <div>
          <p className="text-sm font-semibold text-[#0a0a0a]">Campaigns</p>
          <p className="text-xs text-[#a3a3a3] mt-0.5">{campaigns.length} total</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0a0a0a] text-white text-sm font-medium hover:bg-[#1a1a1a] transition-colors"
        >
          <Plus className="w-4 h-4" />
          New campaign
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="px-6 py-8 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-white rounded-xl border border-[#e5e5e5] animate-pulse" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-6">
            <p className="text-[#525252] text-sm font-medium">No campaigns yet</p>
            <p className="text-[#a3a3a3] text-xs mt-1">Create a campaign to send bulk emails to your audience.</p>
            <button
              onClick={() => setCreateOpen(true)}
              className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg border border-[#e5e5e5] bg-white text-sm text-[#525252] hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors"
            >
              <Plus className="w-4 h-4" />
              New campaign
            </button>
          </div>
        ) : (
          <div className="px-6 py-4 space-y-2">
            {campaigns.map((c) => (
              <CampaignRow
                key={c.id}
                campaign={c}
                onSend={() => setConfirm({ type: "send", campaign: c })}
                onCancel={() => setConfirm({ type: "cancel", campaign: c })}
                onDelete={() => setConfirm({ type: "delete", campaign: c })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-[#e5e5e5] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e5e5]">
              <p className="text-sm font-semibold text-[#0a0a0a]">New campaign</p>
              <button
                onClick={() => { setCreateOpen(false); setCreateError(""); setForm(EMPTY_FORM); }}
                className="p-1 rounded-lg text-[#a3a3a3] hover:text-[#0a0a0a] hover:bg-[#f0f0f0] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-[#525252] block mb-1.5">Campaign name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. June newsletter"
                  className="w-full px-3 py-2.5 rounded-lg border border-[#e5e5e5] bg-[#fafafa] text-sm text-[#0a0a0a] outline-none focus:border-[#0a0a0a] focus:ring-1 focus:ring-[#0a0a0a]/10 transition-all placeholder:text-[#c4c4c4]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[#525252] block mb-1.5">Subject line</label>
                <input
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="What recipients see in their inbox"
                  className="w-full px-3 py-2.5 rounded-lg border border-[#e5e5e5] bg-[#fafafa] text-sm text-[#0a0a0a] outline-none focus:border-[#0a0a0a] focus:ring-1 focus:ring-[#0a0a0a]/10 transition-all placeholder:text-[#c4c4c4]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[#525252] block mb-1.5">Audience</label>
                <div className="relative">
                  <select
                    value={form.audienceType}
                    onChange={(e) => setForm({ ...form, audienceType: e.target.value })}
                    className="w-full appearance-none px-3 py-2.5 rounded-lg border border-[#e5e5e5] bg-[#fafafa] text-sm text-[#0a0a0a] outline-none focus:border-[#0a0a0a] focus:ring-1 focus:ring-[#0a0a0a]/10 transition-all pr-8 cursor-pointer"
                  >
                    {Object.entries(AUDIENCE_LABELS).filter(([k]) => k !== "role").map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a3a3a3] pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-[#525252] block mb-1.5">Body (HTML)</label>
                <textarea
                  value={form.bodyHtml}
                  onChange={(e) => setForm({ ...form, bodyHtml: e.target.value })}
                  placeholder="<p>Your email content here...</p>"
                  rows={8}
                  className="w-full px-3 py-2.5 rounded-lg border border-[#e5e5e5] bg-[#fafafa] text-sm text-[#0a0a0a] outline-none focus:border-[#0a0a0a] focus:ring-1 focus:ring-[#0a0a0a]/10 transition-all placeholder:text-[#c4c4c4] resize-none"
                />
                <p className="text-[11px] text-[#a3a3a3] mt-1">HTML is rendered inside Albiz&apos;s branded email wrapper.</p>
              </div>

              {createError && (
                <p className="text-xs text-[#dc2626]">{createError}</p>
              )}

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setCreateOpen(false); setCreateError(""); setForm(EMPTY_FORM); }}
                  className="px-4 py-2 rounded-lg border border-[#e5e5e5] text-sm text-[#525252] hover:text-[#0a0a0a] hover:border-[#0a0a0a] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-lg bg-[#0a0a0a] text-white text-sm font-medium hover:bg-[#1a1a1a] disabled:opacity-50 transition-colors"
                >
                  {creating ? "Saving…" : "Save as draft"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-[#e5e5e5] p-6">
            <p className="text-sm font-semibold text-[#0a0a0a] mb-1">
              {confirm.type === "send" && "Send campaign?"}
              {confirm.type === "cancel" && "Cancel campaign?"}
              {confirm.type === "delete" && "Delete campaign?"}
            </p>
            <p className="text-xs text-[#737373] mb-5">
              {confirm.type === "send" &&
                `This will queue emails to all ${AUDIENCE_LABELS[confirm.campaign.audienceType] ?? confirm.campaign.audienceType} and cannot be undone.`}
              {confirm.type === "cancel" &&
                "Remaining queued emails will not be sent. Already delivered emails are unaffected."}
              {confirm.type === "delete" &&
                `"${confirm.campaign.name}" will be permanently deleted.`}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setConfirm(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[#e5e5e5] text-sm text-[#525252] hover:text-[#0a0a0a] hover:border-[#0a0a0a] transition-colors"
              >
                Never mind
              </button>
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50 ${
                  confirm.type === "delete" || confirm.type === "cancel"
                    ? "bg-[#dc2626] hover:bg-[#b91c1c]"
                    : "bg-[#0a0a0a] hover:bg-[#1a1a1a]"
                }`}
              >
                {confirming
                  ? "Working…"
                  : confirm.type === "send"
                  ? "Send"
                  : confirm.type === "cancel"
                  ? "Cancel campaign"
                  : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CampaignRow({
  campaign,
  onSend,
  onCancel,
  onDelete,
}: {
  campaign: Campaign;
  onSend: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const isDraft    = campaign.status === "draft";
  const isSending  = campaign.status === "sending";
  const isSent     = campaign.status === "sent";
  const isCancelled = campaign.status === "cancelled";

  const total     = campaign.recipientCount;
  const delivered = campaign.deliveredCount;
  const failed    = campaign.failedCount;
  const processed = delivered + failed;

  return (
    <div className="bg-white border border-[#e5e5e5] rounded-xl px-5 py-4 flex items-center gap-4 hover:border-[#d4d4d4] transition-colors">
      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-[#0a0a0a] truncate">{campaign.name}</span>
          <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_STYLES[campaign.status] ?? "bg-[#f0f0f0] text-[#525252]"}`}>
            {campaign.status}
          </span>
          <span className="text-[11px] text-[#a3a3a3] bg-[#fafafa] border border-[#f0f0f0] px-1.5 py-0.5 rounded-full">
            {AUDIENCE_LABELS[campaign.audienceType] ?? campaign.audienceType}
          </span>
        </div>
        <p className="text-xs text-[#737373] truncate mt-0.5">{campaign.subject}</p>

        {/* Stats row */}
        <div className="flex items-center gap-3 mt-2">
          {isSending && total > 0 && (
            <>
              <div className="w-24 h-1 rounded-full bg-[#f0f0f0] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#0a0a0a] transition-all"
                  style={{ width: `${Math.round((processed / total) * 100)}%` }}
                />
              </div>
              <span className="text-[11px] text-[#737373]">{processed} / {total}</span>
            </>
          )}
          {(isSent || isCancelled) && total > 0 && (
            <span className="text-[11px] text-[#737373]">
              {delivered} delivered
              {failed > 0 && <span className="text-[#dc2626] ml-1">· {failed} failed</span>}
              {" · "}{total} total
            </span>
          )}
          {isDraft && (
            <span className="text-[11px] text-[#a3a3a3]">Draft · {formatRelative(campaign.createdAt)}</span>
          )}
          {(isSent || isCancelled) && campaign.sentAt && (
            <span className="text-[11px] text-[#a3a3a3]">{formatRelative(campaign.sentAt)}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {isDraft && (
          <>
            <button
              onClick={onSend}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0a0a0a] text-white text-xs font-medium hover:bg-[#1a1a1a] transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              Send
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg text-[#a3a3a3] hover:text-[#dc2626] hover:bg-[#fff1f2] transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
        {isSending && (
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e5e5e5] text-xs text-[#525252] hover:border-[#dc2626] hover:text-[#dc2626] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}