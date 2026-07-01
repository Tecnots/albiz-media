"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, MoreVertical, Loader2, Check, X, Trash2 } from "lucide-react";
import { AdminPillTabs, VerifiedBadge, RoleBadge, StatusBadge, UserAvatar, AdminModal, ConfirmModal } from "../admin-components";

interface AdminUser {
  id: number;
  name: string;
  handle: string;
  email: string;
  avatar: string;
  role: "CIRCLE" | "NORMAL" | "ADMIN" | "AUTHOR" | "EDITOR" | "SHORTS_CREATOR";
  verified: boolean;
  status: "active" | "banned";
  joinDate: string;
  followers: string;
}

const tabs = ["All", "Circle", "Normal", "Shorts", "Verified", "Banned"];

const commonReasons = [
  "Spamming or suspicious activity",
  "Harassment or hate speech",
  "Impersonation or fake profile",
  "Inappropriate content or nudity",
  "Violation of platform guidelines",
  "Other",
];

export default function AdminUsers() {
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const [editModal, setEditModal] = useState<AdminUser | null>(null);
  const [usersState, setUsersState] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [banModal, setBanModal] = useState<AdminUser | "bulk" | null>(null);
  const [banReason, setBanReason] = useState(commonReasons[0]);
  const [customReason, setCustomReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const tab = tabs[activeTab];
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery);
      if (tab !== "All") params.set("tab", tab);

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsersState(data);
      setError(null);
      setSelected(new Set());
    } catch (err) {
      setError("Could not load users. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(fetchUsers, 300);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const allIds = usersState.map((u) => u.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(allIds));
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleBan = (user: AdminUser) => {
    setMenuOpen(null);
    if (user.status === "active") {
      setBanModal(user);
      setBanReason(commonReasons[0]);
      setCustomReason("");
    } else {
      performAction([user.id], "unban");
    }
  };

  const promoteToCircle = async (id: number) => {
    setMenuOpen(null);
    await performAction([id], "promote_circle");
  };

  const promoteToShorts = async (id: number) => {
    setMenuOpen(null);
    await performAction([id], "promote_shorts_creator");
  };

  const selectedUsers = usersState.filter((u) => selected.has(u.id));
  const eligiblePromote = selectedUsers.filter((u) => u.role === "NORMAL").length;
  const eligibleBan = selectedUsers.filter((u) => u.status === "active").length;
  const eligibleUnban = selectedUsers.filter((u) => u.status === "banned").length;

  const bulkPromote = async () => {
    const ids = selectedUsers.filter((u) => u.role === "NORMAL").map((u) => u.id);
    if (!ids.length) return;
    await performAction(ids, "promote_circle");
    setSelected(new Set());
  };

  const bulkBan = () => {
    setBanModal("bulk");
    setBanReason(commonReasons[0]);
    setCustomReason("");
  };

  const confirmBan = async () => {
    if (!banModal) return;
    const finalReason = banReason === "Other" ? customReason.trim() : banReason;
    if (banReason === "Other" && !finalReason) return;

    setIsSubmitting(true);
    if (banModal === "bulk") {
      const ids = selectedUsers.filter((u) => u.status === "active").map((u) => u.id);
      await performAction(ids, "ban", finalReason);
      setSelected(new Set());
    } else {
      await performAction([banModal.id], "ban", finalReason);
    }
    setIsSubmitting(false);
    setBanModal(null);
  };

  const performAction = async (userIds: number[], action: string, reason?: string) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds, action, reason }),
      });
      if (res.ok) {
        setUsersState((prev) =>
          prev.map((u) => {
            if (!userIds.includes(u.id)) return u;
            if (action === "unban") return { ...u, status: "active" };
            if (action === "ban") return { ...u, status: "banned" };
            if (action === "promote_circle") return { ...u, role: "CIRCLE" };
            if (action === "promote_shorts_creator") return { ...u, role: "SHORTS_CREATOR" };
            return u;
          })
        );
      }
    } catch (err) {
      console.error(`Failed to ${action}`, err);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleteConfirm(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(deleteConfirm);
    try {
      const res = await fetch(`/api/admin/users?id=${deleteConfirm}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setUsersState(prev => prev.filter(u => u.id !== deleteConfirm));
        setMenuOpen(null);
      } else {
        const data = await res.json();
        alert(data.error || "Albiz: Failed to delete user");
      }
    } catch (err) {
      console.error("Failed to delete user:", err);
      alert("Albiz: Failed to delete user");
    } finally {
      setDeleting(null);
      setDeleteConfirm(null);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      <div className="flex items-center justify-between mb-5">
        <span className="text-xl font-semibold text-[#0a0a0a]">Users</span>
        <span className="text-sm text-[#a3a3a3]">{usersState.length} found</span>
      </div>

      <div className="relative mb-4">
        <Search className="w-4 h-4 text-[#a3a3a3] absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search by name, handle or email…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-[#e5e5e5] text-sm text-[#0a0a0a] placeholder-[#a3a3a3] outline-none focus:ring-2 focus:ring-[#F44444]/20 focus:border-[#F44444]/40 transition-all"
        />
      </div>

      <div className="mb-4">
        <AdminPillTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(i) => { setActiveTab(i); setSelected(new Set()); }}
        />
      </div>

      {someSelected && (
        <div className="flex items-center gap-2.5 mb-3 px-4 py-2.5 rounded-xl bg-white border border-[#e5e5e5]">
          <span className="text-sm text-[#525252] flex-1">
            {selected.size} selected
          </span>
          {eligiblePromote > 0 && (
            <button
              onClick={bulkPromote}
              className="px-3 py-1.5 rounded-lg bg-[#f5f5f5] border border-[#e5e5e5] text-xs font-medium text-[#525252] hover:bg-[#ebebeb] transition-colors"
            >
              Promote to Circle ({eligiblePromote})
            </button>
          )}
          {eligibleUnban > 0 && (
            <button
              onClick={async () => {
                const ids = selectedUsers.filter((u) => u.status === "banned").map((u) => u.id);
                await performAction(ids, "unban");
                setSelected(new Set());
              }}
              className="px-3 py-1.5 rounded-lg bg-[#F0FFF4] text-xs font-medium text-[#22c55e] hover:bg-[#DCFCE7] transition-colors"
            >
              Unban ({eligibleUnban})
            </button>
          )}
          {eligibleBan > 0 && (
            <button
              onClick={bulkBan}
              className="px-3 py-1.5 rounded-lg bg-[#FFF0F0] text-xs font-medium text-[#F44444] hover:bg-[#FFE0E0] transition-colors"
            >
              Ban ({eligibleBan})
            </button>
          )}
          <button
            onClick={() => setSelected(new Set())}
            className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors"
          >
            <X className="w-3.5 h-3.5 text-[#a3a3a3]" />
          </button>
        </div>
      )}

      <div className="rounded-xl border border-[#e5e5e5] bg-white relative">
        {loading && usersState.length > 0 && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-xl">
            <Loader2 className="w-5 h-5 text-[#F44444] animate-spin" />
          </div>
        )}

        {error ? (
          <div className="px-5 py-12 text-center text-[#F44444] text-sm">{error}</div>
        ) : loading && usersState.length === 0 ? (
          <div className="divide-y divide-[#f0f0f0]">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
                <div className="w-4 h-4 rounded border border-[#e5e5e5] bg-[#ebebeb] flex-shrink-0" />
                <div className="w-9 h-9 rounded-full bg-[#ebebeb] flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="h-3.5 bg-[#ebebeb] rounded" style={{ width: `${30 + (i % 3) * 15}%` }} />
                  <div className="h-3 bg-[#ebebeb] rounded w-40" />
                </div>
                <div className="hidden sm:block h-5 w-14 bg-[#ebebeb] rounded-full" />
                <div className="h-5 w-12 bg-[#ebebeb] rounded-full" />
                <div className="w-7 h-7 bg-[#ebebeb] rounded-lg" />
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-[#f0f0f0]">
            {someSelected && usersState.length > 0 && (
              <div className="flex items-center gap-4 px-5 py-2.5">
                <button
                  onClick={toggleSelectAll}
                  className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                    allSelected
                      ? "bg-[#0a0a0a] border-[#0a0a0a]"
                      : "border-[#d4d4d4] hover:border-[#a3a3a3]"
                  }`}
                >
                  {allSelected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                </button>
                <span className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-widest">
                  Select all
                </span>
              </div>
            )}

            {usersState.map((user, index) => {
              const isSelected = selected.has(user.id);
              return (
                <div
                  key={user.id}
                  onClick={() => toggleSelect(user.id)}
                  className={`flex items-center gap-4 px-5 py-3.5 transition-colors cursor-pointer relative
                    ${index === usersState.length - 1 ? "rounded-b-xl" : ""}
                    ${isSelected ? "bg-[#fafafa]" : "hover:bg-[#fafafa]"}`}
                >
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected
                        ? "bg-[#0a0a0a] border-[#0a0a0a]"
                        : someSelected ? "border-[#d4d4d4]" : "opacity-0 border-[#d4d4d4]"
                    }`}
                  >
                    {isSelected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                  </div>

                  <UserAvatar src={user.avatar} alt={user.name} size={38} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-sm text-[#0a0a0a] truncate">{user.name}</span>
                      {user.verified && <VerifiedBadge className="scale-90" />}
                    </div>
                    <span className="text-xs text-[#a3a3a3] truncate block">@{user.handle}</span>
                  </div>

                  <div className="hidden sm:flex w-20 justify-center">
                    <RoleBadge role={user.role} />
                  </div>

                  <div className="hidden lg:block w-28 text-center">
                    <span className="text-[11px] text-[#a3a3a3]">Joined</span>
                    <p className="text-xs text-[#525252] font-medium">{user.joinDate}</p>
                  </div>

                  <div className="hidden md:block w-16 text-right">
                    <span className="text-[11px] text-[#a3a3a3]">Followers</span>
                    <p className="text-xs text-[#525252] font-medium">{user.followers}</p>
                  </div>

                  <div className="w-20 flex justify-end">
                    <StatusBadge status={user.status} />
                  </div>

                  <div className="relative ml-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setMenuOpen(menuOpen === user.id ? null : user.id)}
                      className="p-1.5 hover:bg-[#f0f0f0] rounded-lg transition-colors"
                    >
                      <MoreVertical className="w-4 h-4 text-[#a3a3a3]" />
                    </button>
                    {menuOpen === user.id && (
                      <>
                        <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(null)} />
                        <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.12)] border border-[#e5e5e5] py-1.5 z-30">
                          <button
                            onClick={() => { setEditModal(user); setMenuOpen(null); }}
                            className="w-full text-left px-4 py-2 text-sm text-[#0a0a0a] hover:bg-[#fafafa]"
                          >
                            View Details
                          </button>
                          {user.role === "NORMAL" && (
                            <button
                              onClick={() => promoteToCircle(user.id)}
                              className="w-full text-left px-4 py-2 text-sm text-[#525252] hover:bg-[#fafafa]"
                            >
                              Promote to Circle
                            </button>
                          )}
                          {(user.role === "NORMAL" || user.role === "CIRCLE") && (
                            <button
                              onClick={() => promoteToShorts(user.id)}
                              className="w-full text-left px-4 py-2 text-sm text-[#525252] hover:bg-[#fafafa]"
                            >
                              Promote to Uploader
                            </button>
                          )}
                          <button
                            onClick={() => toggleBan(user)}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-[#fafafa] ${
                              user.status === "banned" ? "text-[#22c55e]" : "text-[#F44444]"
                            }`}
                          >
                            {user.status === "banned" ? "Unban User" : "Ban User"}
                          </button>
                          <button
                            onClick={() => handleDelete(user.id)}
                            disabled={deleting === user.id}
                            className="w-full text-left px-4 py-2 text-sm text-[#F44444] hover:bg-[#fafafa] disabled:opacity-50 flex items-center gap-2"
                          >
                            {deleting === user.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                            Delete User
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {usersState.length === 0 && !loading && (
              <div className="px-5 py-12 text-center">
                <p className="text-sm text-[#a3a3a3]">No users found.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ban Modal */}
      <AdminModal
        isOpen={!!banModal}
        onClose={() => !isSubmitting && setBanModal(null)}
        title="Ban User"
      >
        <div className="space-y-4">
          {banModal && banModal !== "bulk" && (
            <div className="flex items-center gap-3 p-3 bg-[#FFF5F5] rounded-xl border border-[#FECACA]">
              <UserAvatar src={banModal.avatar} alt={banModal.name} size={38} />
              <div>
                <p className="text-sm font-semibold text-[#0a0a0a]">Banning {banModal.name}</p>
                <p className="text-xs text-[#737373] mt-0.5">This user will be immediately locked out of the platform.</p>
              </div>
            </div>
          )}
          {banModal === "bulk" && (
            <div className="p-3 bg-[#FFF5F5] rounded-xl border border-[#FECACA]">
              <p className="text-sm font-semibold text-[#0a0a0a]">Banning {eligibleBan} users</p>
              <p className="text-xs text-[#737373] mt-0.5">All selected active users will be locked out.</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[#a3a3a3] uppercase tracking-widest">
              Reason for Ban
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {commonReasons.map((r) => (
                <button
                  key={r}
                  onClick={() => setBanReason(r)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all text-left ${
                    banReason === r
                      ? "border-[#0a0a0a] bg-[#fafafa] ring-1 ring-[#0a0a0a]"
                      : "border-[#e5e5e5] hover:border-[#d4d4d4] bg-white"
                  }`}
                >
                  <span className={`text-sm ${banReason === r ? "text-[#0a0a0a] font-medium" : "text-[#525252]"}`}>
                    {r}
                  </span>
                  {banReason === r && (
                    <div className="w-4 h-4 rounded-full bg-[#0a0a0a] flex items-center justify-center flex-shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {banReason === "Other" && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[#a3a3a3] uppercase tracking-widest">
                Custom Reason
              </label>
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Describe the violation…"
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-[#fafafa] border border-[#e5e5e5] text-sm text-[#0a0a0a] placeholder-[#a3a3a3] outline-none focus:ring-2 focus:ring-[#F44444]/20 resize-none transition-all"
              />
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              disabled={isSubmitting}
              onClick={() => setBanModal(null)}
              className="flex-1 py-2.5 rounded-xl border border-[#e5e5e5] text-sm font-medium text-[#525252] hover:bg-[#fafafa] disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={isSubmitting || (banReason === "Other" && !customReason.trim())}
              onClick={confirmBan}
              className="flex-1 py-2.5 rounded-xl bg-[#0a0a0a] text-white text-sm font-medium hover:bg-black disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirm Ban
            </button>
          </div>
        </div>
      </AdminModal>

      {/* User Details Modal */}
      <AdminModal isOpen={!!editModal} onClose={() => setEditModal(null)} title="User Details">
        {editModal && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <UserAvatar src={editModal.avatar} alt={editModal.name} size={48} />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-[#0a0a0a]">{editModal.name}</span>
                  {editModal.verified && <VerifiedBadge />}
                </div>
                <span className="text-sm text-[#a3a3a3]">@{editModal.handle}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: "Role", content: <RoleBadge role={editModal.role} /> },
                { label: "Status", content: <StatusBadge status={editModal.status} /> },
                { label: "Joined", content: <span className="text-sm text-[#0a0a0a]">{editModal.joinDate}</span> },
                { label: "Followers", content: <span className="text-sm text-[#0a0a0a]">{editModal.followers}</span> },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-[#fafafa] border border-[#f0f0f0] p-3">
                  <span className="text-[11px] text-[#a3a3a3] block mb-1">{item.label}</span>
                  {item.content}
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-[#fafafa] border border-[#f0f0f0] p-3">
              <span className="text-[11px] text-[#a3a3a3] block mb-1">Email</span>
              <span className="text-sm text-[#0a0a0a]">{editModal.email}</span>
            </div>

            <div className="flex gap-2.5 pt-1 flex-wrap">
              {editModal.role === "NORMAL" && (
                <button
                  onClick={() => { promoteToCircle(editModal.id); setEditModal(null); }}
                  className="flex-1 py-2.5 rounded-xl border border-[#e5e5e5] text-sm font-medium text-[#525252] hover:bg-[#fafafa] transition-colors"
                >
                  Promote to Circle
                </button>
              )}
              {(editModal.role === "NORMAL" || editModal.role === "CIRCLE") && (
                <button
                  onClick={() => { promoteToShorts(editModal.id); setEditModal(null); }}
                  className="flex-1 py-2.5 rounded-xl border border-[#e5e5e5] text-sm font-medium text-[#EA580C] hover:bg-[#FFF7ED] transition-colors"
                >
                  Promote to Uploader
                </button>
              )}
              {editModal.status === "active" ? (
                <button
                  onClick={() => { toggleBan(editModal); setEditModal(null); }}
                  className="flex-1 py-2.5 rounded-xl bg-[#FFF0F0] text-sm font-medium text-[#F44444] hover:bg-[#FFE0E0] transition-colors"
                >
                  Ban User
                </button>
              ) : (
                <button
                  onClick={() => { performAction([editModal.id], "unban"); setEditModal(null); }}
                  className="flex-1 py-2.5 rounded-xl bg-[#F0FFF4] text-sm font-medium text-[#22c55e] hover:bg-[#DCFCE7] transition-colors"
                >
                  Unban User
                </button>
              )}
            </div>
          </div>
        )}
      </AdminModal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={confirmDelete}
        title="Delete User"
        message="Delete this user from Albiz? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isSubmitting={deleting !== null}
      />
    </div>
  );
}
