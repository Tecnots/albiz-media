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
    className: "bg-card text-foreground border border-border",
  },
  {
    key: "AUTHOR",
    label: "Author",
    description: "Publish content and articles",
    className: "bg-purple-500/10 text-purple-600 border border-purple-500/20",
  },
  {
    key: "EDITOR",
    label: "Editor",
    description: "Review articles in assigned sections",
    className: "bg-sky-500/10 text-sky-600 border border-sky-500/20",
  },
  {
    key: "CIRCLE",
    label: "Circle",
    description: "Invited premium members",
    className: "bg-red-500/10 text-[#F44444] border border-red-500/20",
  },
  {
    key: "NORMAL",
    label: "Normal",
    description: "Standard registered users",
    className: "bg-card text-muted border border-border",
  },
  {
    key: "SHORTS_CREATOR",
    label: "Uploader",
    description: "Upload and manage short-form video content",
    className: "bg-orange-500/10 text-orange-600 border border-orange-500/20",
  },
];

const PERMISSIONS: { label: string; roles: string[] }[] = [
  { label: "View feed & posts", roles: ["NORMAL", "CIRCLE", "AUTHOR", "ADMIN", "EDITOR", "SHORTS_CREATOR"] },
  { label: "Create posts", roles: ["NORMAL", "CIRCLE", "AUTHOR", "ADMIN"] },
  { label: "View Circle content", roles: ["CIRCLE", "AUTHOR", "ADMIN"] },
  { label: "Write & publish articles", roles: ["AUTHOR", "ADMIN"] },
  { label: "Access Editor Studio", roles: ["EDITOR", "ADMIN"] },
  { label: "Review & approve articles", roles: ["EDITOR", "ADMIN"] },
  { label: "Upload short-form videos", roles: ["SHORTS_CREATOR", "ADMIN"] },
  { label: "Access Shorts dashboard", roles: ["SHORTS_CREATOR", "ADMIN"] },
  { label: "Access admin panel", roles: ["AUTHOR", "ADMIN"] },
  { label: "Manage content & posts", roles: ["ADMIN"] },
  { label: "Manage users", roles: ["ADMIN"] },
  { label: "Invite users to roles", roles: ["ADMIN"] },
  { label: "View analytics", roles: ["AUTHOR", "ADMIN"] },
  { label: "Platform settings", roles: ["ADMIN"] },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Section {
  id: number;
  name: string;
  color: string;
}

interface Invite {
  id: number;
  email: string;
  role: string;
  name: string | null;
  note: string | null;
  status: string;
  metadata: { sectionIds?: number[]; canPublish?: boolean } | null;
  createdAt: string;
  expiresAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const r = ROLES.find(r => r.key === role);
  if (!r) return <span className="text-xs text-muted">{role}</span>;
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${r.className}`}>
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
  const [sections, setSections] = useState<Section[]>([]);
  const [loadingSections, setLoadingSections] = useState(false);

  // Invite form
  const [showForm, setShowForm] = useState(false);
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState("AUTHOR");
  const [formName, setFormName] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formSectionIds, setFormSectionIds] = useState<number[]>([]);
  const [formCanPublish, setFormCanPublish] = useState(false);
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

  useEffect(() => {
    fetchInvites();
    setLoadingSections(true);
    fetch("/api/admin/sections")
      .then(r => r.ok ? r.json() : { sections: [] })
      .then(d => setSections(d.sections ?? []))
      .catch(() => {})
      .finally(() => setLoadingSections(false));
  }, []);

  const toggleSection = (id: number) => {
    setFormSectionIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmail.trim()) return;
    if (formRole === "EDITOR" && formSectionIds.length === 0) {
      setSendError("Select at least one section for the editor");
      return;
    }
    setSending(true);
    setSendError("");
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formEmail,
          role: formRole,
          name: formName,
          note: formNote,
          sectionIds: formSectionIds,
          canPublish: formCanPublish,
        }),
      });
      const data = res.headers.get("content-type")?.includes("json") ? await res.json() : {};
      if (!res.ok) { setSendError(data.error || "Failed to send"); return; }
      setSendSuccess(true);
      setFormEmail(""); setFormName(""); setFormNote(""); setFormSectionIds([]); setFormCanPublish(false);
      fetchInvites();
      setTimeout(() => { setSendSuccess(false); setShowForm(false); }, 1800);
    } catch {
      setSendError("Connection error");
    } finally {
      setSending(false);
    }
  };

  const [resending, setResending] = useState<number | null>(null);
  const [resentId, setResentId] = useState<number | null>(null);

  const handleResend = async (id: number) => {
    setResending(id);
    try {
      await fetch("/api/admin/invites", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setResentId(id);
      setTimeout(() => setResentId(null), 2500);
    } finally {
      setResending(null);
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
    <div className="p-6 lg:p-8 max-w-[1200px]">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <span className="text-xl font-semibold text-[#0a0a0a]">Roles & Permissions</span>
      </div>

      {/* Permissions matrix */}
      <div className="mb-10">
        <p className="text-sm font-semibold text-[#0a0a0a] mb-4">Permissions</p>
        <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_72px_72px_72px_72px_72px_72px] border-b border-[#e5e5e5] px-5 py-3">
            <span className="text-xs font-medium text-[#737373]" />
            {ROLES.map(r => (
              <span key={r.key} className="flex justify-center">
                <RoleBadge role={r.key} />
              </span>
            ))}
          </div>
          {PERMISSIONS.map((p, i) => (
            <div
              key={p.label}
              className={`grid grid-cols-[1fr_72px_72px_72px_72px_72px_72px] px-5 py-3 items-center ${i < PERMISSIONS.length - 1 ? "border-b border-[#f5f5f5]" : ""}`}
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
                onChange={(v) => { setFormRole(v); setFormSectionIds([]); setFormCanPublish(false); }}
                options={[
                  { value: "AUTHOR", label: "Author", description: "Publish content and articles", badge: { label: "Author", className: "bg-purple-500/10 text-purple-600 border border-purple-500/20" } },
                  { value: "EDITOR", label: "Editor", description: "Review articles in assigned sections", badge: { label: "Editor", className: "bg-sky-500/10 text-sky-600 border border-sky-500/20" } },
                  { value: "SHORTS_CREATOR", label: "Uploader", description: "Upload and manage short-form videos", badge: { label: "Uploader", className: "bg-orange-500/10 text-orange-600 border border-orange-500/20" } },
                  { value: "CIRCLE", label: "Circle", description: "Invited premium members", badge: { label: "Circle", className: "bg-red-500/10 text-[#F44444] border border-red-500/20" } },
                  { value: "ADMIN", label: "Admin", description: "Full platform control", badge: { label: "Admin", className: "bg-card text-foreground border border-border" } },
                  { value: "NORMAL", label: "Normal", description: "Standard registered users", badge: { label: "Normal", className: "bg-card text-muted border border-border" } },
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
          {formRole === "EDITOR" && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[#525252] block mb-2">Sections</label>
                {loadingSections ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[#fafafa] border border-[#e5e5e5]">
                    <Loader2 className="w-3.5 h-3.5 text-[#a3a3a3] animate-spin" />
                    <span className="text-xs text-[#a3a3a3]">Loading sections…</span>
                  </div>
                ) : sections.length === 0 ? (
                  <div className="px-3 py-2.5 rounded-lg bg-[#fafafa] border border-[#e5e5e5] text-xs text-[#a3a3a3]">
                    No sections found. Create sections in admin first.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {sections.map(section => (
                      <label key={section.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[#fafafa] border border-[#e5e5e5] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formSectionIds.includes(section.id)}
                          onChange={() => toggleSection(section.id)}
                          className="rounded accent-[#0EA5E9] cursor-pointer"
                        />
                        <span className="flex items-center gap-1.5 text-sm text-[#0a0a0a]">
                          <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: section.color }} />
                          {section.name}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-[#525252] block mb-2">Permissions</label>
                <div className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-3 py-2.5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-[#0a0a0a]">Can publish articles</p>
                    <p className="text-[11px] text-[#a3a3a3] mt-0.5">Allow this editor to publish approved articles directly</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormCanPublish(v => !v)}
                    style={{
                      position: "relative",
                      flexShrink: 0,
                      width: 44,
                      height: 24,
                      borderRadius: 12,
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      backgroundColor: formCanPublish ? "#0EA5E9" : "#d4d4d4",
                      transition: "background-color 0.15s",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: 3,
                        left: 3,
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        backgroundColor: "white",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                        transform: formCanPublish ? "translateX(20px)" : "translateX(0)",
                        transition: "transform 0.15s",
                      }}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}
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
        <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden mb-4 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-[#f5f5f5] last:border-0">
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="h-3.5 bg-[#ebebeb] rounded w-40" />
                <div className="h-3 bg-[#ebebeb] rounded w-56" />
              </div>
              <div className="h-6 w-14 bg-[#ebebeb] rounded-lg" />
            </div>
          ))}
        </div>
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
                    {invite.role === "EDITOR" && invite.metadata?.sectionIds && invite.metadata.sectionIds.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {invite.metadata.sectionIds.map(sid => {
                          const s = sections.find(s => s.id === sid);
                          if (!s) return null;
                          return (
                            <span key={sid} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[#F0F9FF] text-[#0EA5E9]">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                              {s.name}
                              {invite.metadata?.canPublish ? " · publish" : ""}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <RoleBadge role={invite.role} />
                  <span className="text-xs text-[#a3a3a3] hidden sm:block">{timeAgo(invite.createdAt)}</span>
                  <button
                    onClick={() => handleResend(invite.id)}
                    disabled={resending === invite.id}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium text-[#525252] hover:bg-[#f5f5f5] transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1"
                  >
                    {resending === invite.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : resentId === invite.id ? (
                      <><Check className="w-3 h-3 text-[#22c55e]" /> Sent</>
                    ) : (
                      "Resend"
                    )}
                  </button>
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
