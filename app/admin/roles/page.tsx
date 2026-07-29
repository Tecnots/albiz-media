"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, Loader2, Check, RotateCcw, ChevronRight, ArrowLeft } from "lucide-react";
import { Dropdown, AdminModal } from "../admin-components";

// ─── Role Definitions ────────────────────────────────────────

interface RoleDef {
  key: string;
  label: string;
  shortLabel: string;
  description: string;
  dashboard?: string;
  badgeClass: string;
}

const MANAGEMENT_ROLES: RoleDef[] = [
  { key: "ADMIN", label: "Super Admin", shortLabel: "Admin", description: "Full platform control and configuration", dashboard: "Admin Dashboard", badgeClass: "bg-[#0a0a0a] text-white" },
  { key: "AUTHOR", label: "Author", shortLabel: "Author", description: "Writes and submits articles for editorial review", dashboard: "Author Studio", badgeClass: "bg-purple-500/10 text-purple-600 border border-purple-500/20" },
  { key: "EDITOR", label: "Editor", shortLabel: "Editor", description: "Reviews and publishes articles in assigned sections", dashboard: "Editor Studio", badgeClass: "bg-sky-500/10 text-sky-600 border border-sky-500/20" },
  { key: "UPLOADER", label: "Uploader", shortLabel: "Uploader", description: "Creates and manages short-form video content", dashboard: "Uploader Studio", badgeClass: "bg-orange-500/10 text-orange-600 border border-orange-500/20" },
];

const CONSUMER_ROLES: RoleDef[] = [
  { key: "NORMAL", label: "Registered User", shortLabel: "User", description: "Browse content, follow users, and engage with posts", badgeClass: "bg-[#f5f5f5] text-[#525252] border border-[#e5e5e5]" },
  { key: "CIRCLE", label: "Circle User", shortLabel: "Circle", description: "Premium subscriber with full social features", badgeClass: "bg-red-500/10 text-[#F44444] border border-red-500/20" },
];

const ALL_ROLES = [...MANAGEMENT_ROLES, ...CONSUMER_ROLES];

// ─── Permission Module Definitions ───────────────────────────
// No permission key appears in both Consumer and Management modules.

interface PermSpec { key: string; label: string; }
interface PermModule { name: string; permissions: PermSpec[]; }

const CONSUMER_MODULES: PermModule[] = [
  { name: "Content Browsing", permissions: [
    { key: "view_feed", label: "Browse feed, explore, and trending" },
  ]},
  { name: "Social Engagement", permissions: [
    { key: "interact_posts", label: "Like, save, and share content" },
    { key: "comment", label: "Comment on posts and shorts" },
    { key: "follow_users", label: "Follow, block, and mute users" },
  ]},
  { name: "Content Creation", permissions: [
    { key: "create_posts", label: "Create feed posts" },
    { key: "create_stories", label: "Create stories" },
    { key: "write_articles", label: "Write and submit articles" },
  ]},
  { name: "Messaging", permissions: [
    { key: "send_messages", label: "Send direct messages" },
  ]},
  { name: "Circle", permissions: [
    { key: "view_circle", label: "View Circle-exclusive content" },
    { key: "circle_apply", label: "Apply for Circle membership" },
  ]},
];

const MANAGEMENT_MODULES: PermModule[] = [
  { name: "Admin Panel", permissions: [
    { key: "access_admin", label: "Access admin dashboard" },
  ]},
  { name: "Author Studio", permissions: [
    { key: "access_author_studio", label: "Access Author Studio" },
  ]},
  { name: "Editor Studio", permissions: [
    { key: "access_editor", label: "Access Editor Studio" },
    { key: "review_articles", label: "Review and approve articles" },
    { key: "publish_articles", label: "Publish approved articles" },
  ]},
  { name: "Uploader Studio", permissions: [
    { key: "access_shorts_dashboard", label: "Access Uploader Studio" },
    { key: "upload_shorts", label: "Upload short-form videos" },
  ]},
  { name: "User Management", permissions: [
    { key: "manage_users", label: "Manage user accounts" },
    { key: "invite_users", label: "Send role invitations" },
    { key: "approve_circle", label: "Approve Circle applications" },
  ]},
  { name: "Content Management", permissions: [
    { key: "manage_content", label: "Manage posts and articles" },
    { key: "manage_sections", label: "Manage content sections" },
    { key: "moderate_shorts", label: "Moderate short videos" },
  ]},
  { name: "Roles & Permissions", permissions: [
    { key: "manage_roles", label: "Manage roles and permissions" },
  ]},
  { name: "Analytics", permissions: [
    { key: "view_analytics", label: "View role-scoped analytics" },
    { key: "view_admin_analytics", label: "View platform-wide analytics" },
  ]},
  { name: "Advertising", permissions: [
    { key: "manage_ads", label: "Manage ad campaigns" },
  ]},
  { name: "Broadcasts", permissions: [
    { key: "manage_campaigns", label: "Create and send broadcasts" },
  ]},
  { name: "Notifications", permissions: [
    { key: "manage_notifications", label: "Manage admin notifications" },
  ]},
  { name: "Email Management", permissions: [
    { key: "manage_emails", label: "Manage email templates" },
  ]},
  { name: "Music Library", permissions: [
    { key: "manage_music", label: "Manage story music tracks" },
  ]},
  { name: "Domains", permissions: [
    { key: "manage_domains", label: "Manage custom domains" },
  ]},
  { name: "Audit Logs", permissions: [
    { key: "view_audit_logs", label: "View audit logs" },
  ]},
  { name: "Settings", permissions: [
    { key: "platform_settings", label: "Platform configuration" },
  ]},
  { name: "System", permissions: [
    { key: "manage_jobs", label: "Manage background jobs" },
  ]},
];

// ─── Types ────────────────────────────────────────────────────

interface PermissionRow {
  id: number;
  key: string;
  label: string;
  roles: string[];
}

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

// ─── Helpers ──────────────────────────────────────────────────

function RoleBadge({ roleKey, compact }: { roleKey: string; compact?: boolean }) {
  const role = ALL_ROLES.find(r => r.key === roleKey);
  if (!role) return <span className="text-xs text-[#a3a3a3]">{roleKey}</span>;
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${role.badgeClass}`}>
      {compact ? role.shortLabel : role.label}
    </span>
  );
}

function InviteStatusBadge({ status }: { status: string }) {
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

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="cursor-pointer flex-shrink-0"
      style={{
        position: "relative",
        width: 40,
        height: 22,
        borderRadius: 11,
        border: "none",
        padding: 0,
        backgroundColor: value ? "#F44444" : "#d4d4d4",
        transition: "background-color 0.15s",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: 3,
          width: 16,
          height: 16,
          borderRadius: "50%",
          backgroundColor: "white",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          transform: value ? "translateX(18px)" : "translateX(0)",
          transition: "transform 0.15s",
        }}
      />
    </button>
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

// ─── Main Component ──────────────────────────────────────────

export default function AdminRolesPage() {
  const [view, setView] = useState<"overview" | "permissions">("overview");
  const [permTab, setPermTab] = useState<"consumer" | "management">("consumer");
  const [showConfigureRole, setShowConfigureRole] = useState(false);

  // Permissions data
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [roleCounts, setRoleCounts] = useState<Record<string, number>>({});
  const [loadingPerms, setLoadingPerms] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  // Invites
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

  // Revoke / Resend
  const [revoking, setRevoking] = useState<number | null>(null);
  const [resending, setResending] = useState<number | null>(null);
  const [resentId, setResentId] = useState<number | null>(null);

  // Configure Role form
  const [crBaseRole, setCrBaseRole] = useState("AUTHOR");
  const [crDashboard, setCrDashboard] = useState(true);
  const [crModules, setCrModules] = useState<string[]>(["Author Studio"]);
  const [savingRole, setSavingRole] = useState(false);

  // ─── Data Fetching ─────────────────────────────────────────

  const fetchPermissions = useCallback(async () => {
    setLoadingPerms(true);
    try {
      const res = await fetch("/api/admin/permissions");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPermissions(data.permissions ?? []);
      setRoleCounts(data.roleCounts ?? {});
    } catch {
      /* ignore */
    } finally {
      setLoadingPerms(false);
    }
  }, []);

  const fetchInvites = useCallback(() => {
    setLoadingInvites(true);
    fetch("/api/admin/invites")
      .then(r => r.ok ? r.json() : { invites: [] })
      .then(d => setInvites(d.invites ?? []))
      .catch(() => setInvites([]))
      .finally(() => setLoadingInvites(false));
  }, []);

  useEffect(() => {
    fetchPermissions();
    fetchInvites();
    setLoadingSections(true);
    fetch("/api/admin/sections")
      .then(r => r.ok ? r.json() : { sections: [] })
      .then(d => setSections(d.sections ?? []))
      .catch(() => {})
      .finally(() => setLoadingSections(false));
  }, [fetchPermissions, fetchInvites]);

  // ─── Permission Toggle ────────────────────────────────────

  const togglePermission = async (permissionId: number, role: string, currentlyEnabled: boolean) => {
    const key = `${permissionId}-${role}`;
    setToggling(key);

    setPermissions(prev =>
      prev.map(p => {
        if (p.id !== permissionId) return p;
        const roles = currentlyEnabled
          ? p.roles.filter(r => r !== role)
          : [...p.roles, role];
        return { ...p, roles };
      })
    );

    try {
      const res = await fetch("/api/admin/permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionId, role, enabled: !currentlyEnabled }),
      });
      if (!res.ok) {
        setPermissions(prev =>
          prev.map(p => {
            if (p.id !== permissionId) return p;
            const roles = currentlyEnabled ? [...p.roles, role] : p.roles.filter(r => r !== role);
            return { ...p, roles };
          })
        );
      }
    } catch {
      setPermissions(prev =>
        prev.map(p => {
          if (p.id !== permissionId) return p;
          const roles = currentlyEnabled ? [...p.roles, role] : p.roles.filter(r => r !== role);
          return { ...p, roles };
        })
      );
    } finally {
      setToggling(null);
    }
  };

  // ─── Invite Handlers ──────────────────────────────────────

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

  // ─── Configure Role Handler ───────────────────────────────

  const handleConfigureRole = async () => {
    setSavingRole(true);
    try {
      const enabledKeys = new Set<string>();
      if (crDashboard) {
        for (const mod of MANAGEMENT_MODULES) {
          if (crModules.includes(mod.name)) {
            for (const p of mod.permissions) enabledKeys.add(p.key);
          }
        }
      }

      const updates: Promise<Response>[] = [];
      for (const perm of permissions) {
        const isManagementPerm = MANAGEMENT_MODULES.some(m => m.permissions.some(p => p.key === perm.key));
        if (!isManagementPerm) continue;
        const shouldEnable = enabledKeys.has(perm.key);
        const currentlyEnabled = perm.roles.includes(crBaseRole);
        if (shouldEnable !== currentlyEnabled) {
          updates.push(
            fetch("/api/admin/permissions", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ permissionId: perm.id, role: crBaseRole, enabled: shouldEnable }),
            })
          );
        }
      }

      if (updates.length > 0) {
        await Promise.all(updates);
        await fetchPermissions();
      }

      setShowConfigureRole(false);
      setPermTab("management");
      setView("permissions");
    } finally {
      setSavingRole(false);
    }
  };

  // ─── Computed ──────────────────────────────────────────────

  const totalUsers = Object.values(roleCounts).reduce((s, c) => s + c, 0);
  const activeRolesCount = ALL_ROLES.filter(r => (roleCounts[r.key] ?? 0) > 0).length;
  const pendingInvites = invites.filter(i => i.status === "pending");
  const pastInvites = invites.filter(i => i.status !== "pending");

  // ═══════════════════════════════════════════════════════════
  // MANAGE PERMISSIONS VIEW
  // ═══════════════════════════════════════════════════════════

  if (view === "permissions") {
    const activeModules = permTab === "consumer" ? CONSUMER_MODULES : MANAGEMENT_MODULES;
    const activeRoles = permTab === "consumer" ? ALL_ROLES : MANAGEMENT_ROLES;
    const colCount = activeRoles.length;
    const gridCols = `1fr repeat(${colCount}, 72px)`;

    return (
      <div className="p-6 lg:p-8 max-w-[1200px]">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => setView("overview")}
            className="p-1.5 rounded-lg hover:bg-[#f5f5f5] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#525252]" />
          </button>
          <span className="text-sm text-[#a3a3a3]">Roles & Permissions</span>
          <ChevronRight className="w-3 h-3 text-[#d4d4d4]" />
          <span className="text-sm font-medium text-[#0a0a0a]">Manage Permissions</span>
        </div>

        {/* Tab selector */}
        <div className="flex gap-1.5 mb-6">
          {(["consumer", "management"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setPermTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                permTab === tab
                  ? "bg-[#F44444] text-white"
                  : "bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb] border border-[#e5e5e5]"
              }`}
            >
              {tab === "consumer" ? "Consumer Experience" : "Management Dashboard"}
            </button>
          ))}
        </div>

        {/* Permission matrix */}
        <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-x-auto">
          {/* Header row */}
          <div
            className="border-b border-[#e5e5e5] px-5 py-3"
            style={{ display: "grid", gridTemplateColumns: gridCols, minWidth: 600 }}
          >
            <span />
            {activeRoles.map(r => (
              <span key={r.key} className="flex justify-center">
                <RoleBadge roleKey={r.key} compact />
              </span>
            ))}
          </div>

          {loadingPerms ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="px-5 py-3 items-center border-b border-[#f5f5f5] last:border-0 animate-pulse"
                style={{ display: "grid", gridTemplateColumns: gridCols, minWidth: 600 }}
              >
                <div className="h-3 bg-[#ebebeb] rounded w-40" />
                {activeRoles.map(r => (
                  <span key={r.key} className="flex justify-center">
                    <div className="w-4 h-4 rounded-full bg-[#ebebeb]" />
                  </span>
                ))}
              </div>
            ))
          ) : (
            activeModules.map((mod, mi) => (
              <div key={mod.name}>
                {/* Module header */}
                <div className="px-5 py-2.5 bg-[#fafafa] border-b border-[#f5f5f5]">
                  <span className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider">{mod.name}</span>
                </div>
                {/* Permission rows */}
                {mod.permissions.map((spec, pi) => {
                  const perm = permissions.find(p => p.key === spec.key);
                  const isLast = mi === activeModules.length - 1 && pi === mod.permissions.length - 1;
                  return (
                    <div
                      key={`${mod.name}-${spec.key}`}
                      className={`px-5 py-3 items-center ${isLast ? "" : "border-b border-[#f5f5f5]"}`}
                      style={{ display: "grid", gridTemplateColumns: gridCols, minWidth: 600 }}
                    >
                      <span className="text-xs text-[#525252]">{spec.label}</span>
                      {activeRoles.map(role => {
                        if (!perm) {
                          return (
                            <span key={role.key} className="flex justify-center">
                              <span className="w-4 h-4 rounded-full bg-[#f5f5f5] border border-[#e5e5e5] opacity-40" title="Not provisioned" />
                            </span>
                          );
                        }
                        const enabled = perm.roles.includes(role.key);
                        const isToggling = toggling === `${perm.id}-${role.key}`;
                        return (
                          <span key={role.key} className="flex justify-center">
                            <button
                              onClick={() => togglePermission(perm.id, role.key, enabled)}
                              disabled={isToggling}
                              className="cursor-pointer disabled:opacity-40"
                            >
                              {enabled ? (
                                <span className="w-4 h-4 rounded-full bg-[#F44444]/10 flex items-center justify-center">
                                  <Check className="w-2.5 h-2.5 text-[#F44444]" strokeWidth={3} />
                                </span>
                              ) : (
                                <span className="w-4 h-4 rounded-full bg-[#f5f5f5] border border-[#e5e5e5] flex items-center justify-center hover:bg-[#F44444]/5 hover:border-[#F44444]/20 transition-colors" />
                              )}
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // OVERVIEW VIEW
  // ═══════════════════════════════════════════════════════════

  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <span className="text-xl font-semibold text-[#0a0a0a]">Roles & Permissions</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView("permissions")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#e5e5e5] text-[#525252] text-xs font-medium hover:bg-[#fafafa] transition-colors cursor-pointer"
          >
            Manage Permissions
          </button>
          <button
            onClick={() => setShowConfigureRole(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F44444] text-white text-xs font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Configure Role
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: "Roles", value: ALL_ROLES.length, loading: false },
          { label: "Users", value: totalUsers, loading: loadingPerms },
          { label: "Active Roles", value: activeRolesCount, loading: loadingPerms },
          { label: "Permissions", value: permissions.length, loading: loadingPerms },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border border-[#e5e5e5] p-4 bg-white">
            <p className="text-xs text-[#737373] mb-1">{stat.label}</p>
            <p className="text-2xl font-bold text-[#0a0a0a]">
              {stat.loading ? "…" : stat.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Management Roles */}
      <div className="mb-8">
        <p className="text-xs font-semibold text-[#737373] uppercase tracking-wider mb-3">
          Management Roles <span className="font-normal normal-case">· App + Dashboard</span>
        </p>
        <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden overflow-x-auto">
          <div className="grid grid-cols-[1fr_72px_72px_120px_72px] px-5 py-2.5 border-b border-[#e5e5e5] text-[10px] font-medium text-[#a3a3a3] uppercase tracking-wider" style={{ minWidth: 520 }}>
            <span>Role</span>
            <span className="text-center">Users</span>
            <span className="text-center">App</span>
            <span className="text-center">Dashboard</span>
            <span className="text-center">Status</span>
          </div>
          {MANAGEMENT_ROLES.map((role, i) => (
            <div
              key={role.key}
              className={`grid grid-cols-[1fr_72px_72px_120px_72px] px-5 py-3.5 items-center ${i < MANAGEMENT_ROLES.length - 1 ? "border-b border-[#f5f5f5]" : ""}`}
              style={{ minWidth: 520 }}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <RoleBadge roleKey={role.key} />
                </div>
                <p className="text-[11px] text-[#a3a3a3] truncate">{role.description}</p>
              </div>
              <span className="text-center text-sm font-medium text-[#0a0a0a]">
                {loadingPerms ? "…" : (roleCounts[role.key] ?? 0).toLocaleString()}
              </span>
              <span className="flex justify-center">
                <span className="w-4 h-4 rounded-full bg-[#22c55e]/10 flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-[#22c55e]" strokeWidth={3} />
                </span>
              </span>
              <span className="text-center text-xs text-[#525252]">{role.dashboard}</span>
              <span className="flex justify-center">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#22c55e]/10 text-[#22c55e]">Active</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Consumer Roles */}
      <div className="mb-10">
        <p className="text-xs font-semibold text-[#737373] uppercase tracking-wider mb-3">
          Consumer Roles <span className="font-normal normal-case">· App only</span>
        </p>
        <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden overflow-x-auto">
          <div className="grid grid-cols-[1fr_72px_72px_120px_72px] px-5 py-2.5 border-b border-[#e5e5e5] text-[10px] font-medium text-[#a3a3a3] uppercase tracking-wider" style={{ minWidth: 520 }}>
            <span>Role</span>
            <span className="text-center">Users</span>
            <span className="text-center">App</span>
            <span className="text-center">Dashboard</span>
            <span className="text-center">Status</span>
          </div>
          {CONSUMER_ROLES.map((role, i) => (
            <div
              key={role.key}
              className={`grid grid-cols-[1fr_72px_72px_120px_72px] px-5 py-3.5 items-center ${i < CONSUMER_ROLES.length - 1 ? "border-b border-[#f5f5f5]" : ""}`}
              style={{ minWidth: 520 }}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <RoleBadge roleKey={role.key} />
                </div>
                <p className="text-[11px] text-[#a3a3a3] truncate">{role.description}</p>
              </div>
              <span className="text-center text-sm font-medium text-[#0a0a0a]">
                {loadingPerms ? "…" : (roleCounts[role.key] ?? 0).toLocaleString()}
              </span>
              <span className="flex justify-center">
                <span className="w-4 h-4 rounded-full bg-[#22c55e]/10 flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-[#22c55e]" strokeWidth={3} />
                </span>
              </span>
              <span className="text-center text-xs text-[#a3a3a3]">—</span>
              <span className="flex justify-center">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#22c55e]/10 text-[#22c55e]">Active</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Invitations ──────────────────────────────────── */}

      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-[#737373] uppercase tracking-wider">Invitations</p>
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
                  { value: "UPLOADER", label: "Uploader", description: "Upload and manage short-form videos", badge: { label: "Uploader", className: "bg-orange-500/10 text-orange-600 border border-orange-500/20" } },
                  { value: "CIRCLE", label: "Circle User", description: "Premium subscriber", badge: { label: "Circle", className: "bg-red-500/10 text-[#F44444] border border-red-500/20" } },
                  { value: "ADMIN", label: "Super Admin", description: "Full platform control", badge: { label: "Admin", className: "bg-[#0a0a0a] text-white" } },
                  { value: "NORMAL", label: "Registered User", description: "Standard registered users", badge: { label: "User", className: "bg-[#f5f5f5] text-[#525252] border border-[#e5e5e5]" } },
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
                  <Toggle value={formCanPublish} onChange={setFormCanPublish} />
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
                  <RoleBadge roleKey={invite.role} compact />
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
                  <RoleBadge roleKey={invite.role} compact />
                  <InviteStatusBadge status={invite.status} />
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

      {/* ─── Configure Role Modal ────────────────────────── */}

      <AdminModal isOpen={showConfigureRole} onClose={() => setShowConfigureRole(false)} title="Configure Role">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-[#525252] block mb-1.5">Role</label>
            <Dropdown
              value={crBaseRole}
              onChange={(v) => {
                setCrBaseRole(v);
                const role = ALL_ROLES.find(r => r.key === v);
                if (role) {
                  setCrDashboard(!!role.dashboard);
                  if (role.dashboard) {
                    const defaultMods = MANAGEMENT_MODULES
                      .filter(m => m.permissions.some(p => permissions.find(dbp => dbp.key === p.key)?.roles.includes(v)))
                      .map(m => m.name);
                    setCrModules(defaultMods);
                  } else {
                    setCrModules([]);
                  }
                }
              }}
              options={ALL_ROLES.map(r => ({
                value: r.key,
                label: r.label,
                description: r.description,
                badge: { label: r.shortLabel, className: r.badgeClass },
              }))}
            />
          </div>

          <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#fafafa] border border-[#e5e5e5]">
            <div>
              <p className="text-sm text-[#0a0a0a]">Management Dashboard</p>
              <p className="text-[11px] text-[#a3a3a3] mt-0.5">Grant access to management features</p>
            </div>
            <Toggle value={crDashboard} onChange={setCrDashboard} />
          </div>

          {crDashboard && (
            <div>
              <label className="text-xs font-medium text-[#525252] block mb-2">Dashboard Modules</label>
              <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
                {MANAGEMENT_MODULES.map(mod => (
                  <label key={mod.name} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[#fafafa] border border-[#e5e5e5] cursor-pointer hover:bg-[#f5f5f5] transition-colors">
                    <input
                      type="checkbox"
                      checked={crModules.includes(mod.name)}
                      onChange={() => {
                        setCrModules(prev =>
                          prev.includes(mod.name)
                            ? prev.filter(m => m !== mod.name)
                            : [...prev, mod.name]
                        );
                      }}
                      className="rounded accent-[#F44444] cursor-pointer"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[#0a0a0a]">{mod.name}</span>
                      <span className="text-[10px] text-[#a3a3a3]">{mod.permissions.length}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowConfigureRole(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[#525252] hover:bg-[#f5f5f5] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleConfigureRole}
              disabled={savingRole}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors disabled:opacity-40 cursor-pointer"
            >
              {savingRole && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {savingRole ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
