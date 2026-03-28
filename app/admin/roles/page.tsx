"use client";

import { useState, useEffect } from "react";
import { Plus, X, Loader2, Check, RotateCcw } from "lucide-react";
import { Dropdown } from "../admin-components";

// ─── Static permissions data ───────────────────────────────────────────────────

const ROLES = [
  {
    key: "ADMIN",
    label: "Admin",
    description: "Full platform control",
    color: "#0a0a0a",
    bg: "#f0f0f0",
  },
  {
    key: "AUTHOR",
    label: "Author",
    description: "Publish content and articles",
    color: "#8B5CF6",
    bg: "#F5F3FF",
  },
  {
    key: "CIRCLE",
    label: "Circle",
    description: "Invited premium members",
    color: "#F44444",
    bg: "#FFF0F0",
  },
  {
    key: "NORMAL",
    label: "Normal",
    description: "Standard registered users",
    color: "#525252",
    bg: "#f5f5f5",
  },
];

const PERMISSIONS: { label: string; roles: string[] }[] = [
  { label: "View feed & posts", roles: ["NORMAL", "CIRCLE", "AUTHOR", "ADMIN"] },
  { label: "Create posts", roles: ["NORMAL", "CIRCLE", "AUTHOR", "ADMIN"] },
  { label: "View Circle content", roles: ["CIRCLE", "AUTHOR", "ADMIN"] },
  { label: "Write & publish articles", roles: ["AUTHOR", "ADMIN"] },
  { label: "Access admin panel", roles: ["AUTHOR", "ADMIN"] },
  { label: "Manage content & posts", roles: ["ADMIN"] },
  { label: "Manage users", roles: ["ADMIN"] },
  { label: "Invite users to roles", roles: ["ADMIN"] },
  { label: "View analytics", roles: ["AUTHOR", "ADMIN"] },
  { label: "Platform settings", roles: ["ADMIN"] },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Invite {
  id: number;
  email: string;
  role: string;
  name: string | null;
  note: string | null;
  status: string;
  createdAt: string;
  expiresAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const r = ROLES.find(r => r.key === role);
  if (!r) return <span className="text-xs text-[#737373]">{role}</span>;
  return (
    <span style={{ background: r.bg, color: r.color }} className="text-[10px] font-semibold px-2 py-0.5 rounded-full">
      {r.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: "#FFF9EC", text: "#D97706", label: "Pending" },
    accepted: { bg: "#F0FDF4", text: "#16a34a", label: "Accepted" },
    revoked: { bg: "#f5f5f5", text: "#a3a3a3", label: "Revoked" },
  };
  const s = map[status] ?? map.pending;
  return (
    <span style={{ background: s.bg, color: s.text }} className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize">
      {s.label}
    </span>
  );
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminRolesPage() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);

  // Invite form
  const [showForm, setShowForm] = useState(false);
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState("AUTHOR");
  const [formName, setFormName] = useState("");
  const [formNote, setFormNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendSuccess, setSendSuccess] = useState(false);

  // Revoke
  const [revoking, setRevoking] = useState<number | null>(null);

  const fetchInvites = () => {
    setLoadingInvites(true);
    fetch("/api/admin/invites")
      .then(r => r.ok ? r.json() : { invites: [] })
      .then(d => setInvites(d.invites ?? []))
      .catch(() => setInvites([]))
      .finally(() => setLoadingInvites(false));
  };

  useEffect(() => { fetchInvites(); }, []);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmail.trim()) return;
    setSending(true);
    setSendError("");
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formEmail, role: formRole, name: formName, note: formNote }),
      });
      const data = res.headers.get("content-type")?.includes("json") ? await res.json() : {};
      if (!res.ok) { setSendError(data.error || "Failed to send"); return; }
      setSendSuccess(true);
      setFormEmail(""); setFormName(""); setFormNote("");
      fetchInvites();
      setTimeout(() => { setSendSuccess(false); setShowForm(false); }, 1800);
    } catch {
      setSendError("Connection error");
    } finally {
      setSending(false);
    }
  };

  const handleRevoke = async (id: number) => {
    setRevoking(id);
    try {
      await fetch(`/api/admin/invites?id=${id}`, { method: "DELETE" });
      setInvites(prev => prev.map(i => i.id === id ? { ...i, status: "revoked" } : i));
    } finally {
      setRevoking(null);
    }
  };

  const pendingInvites = invites.filter(i => i.status === "pending");
  const pastInvites = invites.filter(i => i.status !== "pending");

  return (
    <div className="p-8 max-w-5xl">

      {/* Permissions matrix */}
      <div className="mb-10">
        <p className="text-sm font-semibold text-[#0a0a0a] mb-4">Permissions</p>
        <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_80px_80px_80px_80px] border-b border-[#e5e5e5] px-5 py-3">
            <span className="text-xs font-medium text-[#737373]" />
            {ROLES.map(r => (
              <span key={r.key} className="text-[11px] font-semibold text-center" style={{ color: r.color }}>{r.label}</span>
            ))}
          </div>
          {PERMISSIONS.map((p, i) => (
            <div
              key={p.label}
              className={`grid grid-cols-[1fr_80px_80px_80px_80px] px-5 py-3 items-center ${i < PERMISSIONS.length - 1 ? "border-b border-[#f5f5f5]" : ""}`}
            >
              <span className="text-xs text-[#525252]">{p.label}</span>
              {ROLES.map(r => (
                <span key={r.key} className="flex justify-center">
                  {p.roles.includes(r.key) ? (
                    <span className="w-4 h-4 rounded-full bg-[#F44444]/10 flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-[#F44444]" strokeWidth={3} />
                    </span>
                  ) : (
                    <span className="w-3 h-px bg-[#e5e5e5] block mt-2" />
                  )}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Invites section */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-[#0a0a0a]">Invitations</p>
        <button
          onClick={() => { setShowForm(v => !v); setSendError(""); setSendSuccess(false); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F44444] text-white text-xs font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer"
        >
          {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showForm ? "Cancel" : "Invite"}
        </button>
      </div>

      {/* Invite form */}
      {showForm && (
        <form onSubmit={handleSendInvite} className="bg-white border border-[#e5e5e5] rounded-xl p-5 mb-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#525252] block mb-1.5">Email</label>
              <input
                type="email"
                value={formEmail}
                onChange={e => { setFormEmail(e.target.value); setSendError(""); }}
                placeholder="person@example.com"
                className="w-full px-3 py-2 rounded-lg bg-[#fafafa] border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#525252] block mb-1.5">Role</label>
              <Dropdown
                value={formRole}
                onChange={setFormRole}
                options={[
                  { value: "AUTHOR", label: "Author", description: "Publish content and articles", badge: { label: "Author", color: "#8B5CF6", bg: "#F5F3FF" } },
                  { value: "CIRCLE", label: "Circle", description: "Invited premium members", badge: { label: "Circle", color: "#F44444", bg: "#FFF0F0" } },
                  { value: "ADMIN", label: "Admin", description: "Full platform control", badge: { label: "Admin", color: "#0a0a0a", bg: "#f0f0f0" } },
                  { value: "NORMAL", label: "Normal", description: "Standard registered users", badge: { label: "Normal", color: "#525252", bg: "#f5f5f5" } },
                ]}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#525252] block mb-1.5">Name <span className="text-[#a3a3a3] font-normal">(optional)</span></label>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="Their name"
                className="w-full px-3 py-2 rounded-lg bg-[#fafafa] border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#525252] block mb-1.5">Note <span className="text-[#a3a3a3] font-normal">(optional)</span></label>
              <input
                type="text"
                value={formNote}
                onChange={e => setFormNote(e.target.value)}
                placeholder="Shown in the email"
                className="w-full px-3 py-2 rounded-lg bg-[#fafafa] border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all"
              />
            </div>
          </div>
          {sendError && <p className="text-xs text-[#F44444]">{sendError}</p>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={sending || !formEmail.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors disabled:opacity-40 cursor-pointer"
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : sendSuccess ? <Check className="w-3.5 h-3.5" /> : null}
              {sendSuccess ? "Sent" : "Send invite"}
            </button>
          </div>
        </form>
      )}

      {/* Pending invites */}
      {loadingInvites ? (
        <div className="flex justify-center py-8"><Loader2 className="w-4 h-4 text-[#a3a3a3] animate-spin" /></div>
      ) : (
        <>
          {pendingInvites.length > 0 && (
            <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden mb-4">
              <div className="px-5 py-3 border-b border-[#f5f5f5]">
                <span className="text-xs font-medium text-[#737373]">Pending</span>
              </div>
              {pendingInvites.map(invite => (
                <div key={invite.id} className="flex items-center gap-4 px-5 py-3.5 border-b border-[#f5f5f5] last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#0a0a0a] truncate">{invite.name ?? invite.email}</p>
                    {invite.name && <p className="text-xs text-[#a3a3a3] truncate">{invite.email}</p>}
                  </div>
                  <RoleBadge role={invite.role} />
                  <span className="text-xs text-[#a3a3a3] hidden sm:block">{timeAgo(invite.createdAt)}</span>
                  <button
                    onClick={() => handleRevoke(invite.id)}
                    disabled={revoking === invite.id}
                    className="p-1.5 hover:bg-[#fafafa] rounded-lg text-[#a3a3a3] hover:text-[#F44444] transition-colors cursor-pointer"
                    title="Revoke"
                  >
                    {revoking === invite.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Past invites */}
          {pastInvites.length > 0 && (
            <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
              <div className="px-5 py-3 border-b border-[#f5f5f5] flex items-center justify-between">
                <span className="text-xs font-medium text-[#737373]">History</span>
                <button onClick={fetchInvites} className="p-1 hover:bg-[#f5f5f5] rounded text-[#a3a3a3] hover:text-[#525252] transition-colors cursor-pointer">
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>
              {pastInvites.map(invite => (
                <div key={invite.id} className="flex items-center gap-4 px-5 py-3.5 border-b border-[#f5f5f5] last:border-0 opacity-60">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#0a0a0a] truncate">{invite.name ?? invite.email}</p>
                    {invite.name && <p className="text-xs text-[#a3a3a3] truncate">{invite.email}</p>}
                  </div>
                  <RoleBadge role={invite.role} />
                  <StatusBadge status={invite.status} />
                  <span className="text-xs text-[#a3a3a3] hidden sm:block">{timeAgo(invite.createdAt)}</span>
                </div>
              ))}
            </div>
          )}

          {invites.length === 0 && !showForm && (
            <div className="text-center py-12 text-sm text-[#a3a3a3]">No invitations sent yet.</div>
          )}
        </>
      )}
    </div>
  );
}
