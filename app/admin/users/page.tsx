"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, MoreVertical, Loader2 } from "lucide-react";
import { AdminPillTabs, VerifiedBadge, RoleBadge, StatusBadge, UserAvatar, AdminModal } from "../admin-components";

interface AdminUser {
  id: number;
  name: string;
  handle: string;
  email: string;
  avatar: string;
  role: "CIRCLE" | "NORMAL";
  verified: boolean;
  status: "active" | "banned";
  joinDate: string;
  followers: string;
}

const tabs = ["All", "Circle", "Normal", "Verified", "Banned"];

export default function AdminUsers() {
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const [editModal, setEditModal] = useState<AdminUser | null>(null);
  const [usersState, setUsersState] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [banModal, setBanModal] = useState<AdminUser | null>(null);
  const [banReason, setBanReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const commonReasons = [
    "Spamming or suspicious activity",
    "Harassment or hate speech",
    "Impersonation or fake profile",
    "Inappropriate content or nudity",
    "Violation of platform guidelines",
    "Other"
  ];

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
    } catch (err) {
      setError("Could not load users. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 300); // Debounce search
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const toggleBan = (id: number) => {
    const user = usersState.find(u => u.id === id);
    if (!user) return;
    
    if (user.status === "active") {
      setBanModal(user);
      setBanReason(commonReasons[0]);
      setCustomReason("");
    } else {
      // Direct unban
      performAction(id, "unban");
    }
    setMenuOpen(null);
  };

  const confirmBan = async () => {
    if (!banModal) return;
    const finalReason = banReason === "Other" ? customReason : banReason;
    if (banReason === "Other" && !customReason.trim()) return;
    
    setIsSubmitting(true);
    await performAction(banModal.id, "ban", finalReason);
    setIsSubmitting(false);
    setBanModal(null);
  };

  const performAction = async (userId: number, action: string, reason?: string) => {
    try {
      const res = await fetch("/api/admin/users", { 
        method: "PATCH", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ userId, action, reason }) 
      });
      
      if (res.ok) {
        setUsersState(prev => prev.map(u => u.id === userId ? { 
          ...u, 
          status: action === "unban" ? "active" : "banned" 
        } : u));
      }
    } catch (err) {
      console.error(`Failed to ${action} user`, err);
    }
  };

  const promoteToCircle = async (id: number) => {
    try {
      const res = await fetch("/api/admin/users", { 
        method: "PATCH", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ userId: id, action: "promote_circle" }) 
      });
      
      if (res.ok) {
        setUsersState(prev => prev.map(u => u.id === id ? { ...u, role: "CIRCLE" } : u));
      }
    } catch (err) {
      console.error("Failed to promote user", err);
    } finally {
      setMenuOpen(null);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-[#0a0a0a]">Users</h1>
        <span className="text-sm text-[#737373]">{usersState.length} users found</span>
      </div>

      <div className="relative mb-4">
        <Search className="w-4 h-4 text-[#737373] absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search users by name, handle or email..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all"
        />
      </div>

      <div className="mb-4">
        <AdminPillTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      <div className="rounded-xl border border-[#e5e5e5] bg-white relative">
        {loading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-xl">
            <Loader2 className="w-6 h-6 text-[#F44444] animate-spin" />
          </div>
        )}
        
        {error ? (
          <div className="px-5 py-12 text-center text-red-500 text-sm">{error}</div>
        ) : (
          <div className="divide-y divide-[#f0f0f0]">
            {usersState.map((user, index) => (
              <div 
                key={user.id} 
                className={`flex items-center gap-4 px-5 py-3.5 hover:bg-[#fafafa] transition-colors relative
                  ${index === 0 ? "rounded-t-xl" : ""} 
                  ${index === usersState.length - 1 ? "rounded-b-xl" : ""}`}
              >
                <UserAvatar src={user.avatar} alt={user.name} size={40} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-sm text-[#0a0a0a] truncate">{user.name}</span>
                    {user.verified && <VerifiedBadge className="scale-90" />}
                  </div>
                  <span className="text-xs text-[#737373] truncate block">@{user.handle}</span>
                </div>
                
                <div className="hidden sm:flex w-20 justify-center">
                  <RoleBadge role={user.role} />
                </div>
                
                <div className="hidden lg:block w-28 text-center">
                  <span className="text-xs text-[#a3a3a3]">Joined</span>
                  <p className="text-xs text-[#525252] font-medium">{user.joinDate}</p>
                </div>
                
                <div className="hidden md:block w-16 text-right">
                  <span className="text-xs text-[#a3a3a3]">Followers</span>
                  <p className="text-xs text-[#525252] font-medium">{user.followers}</p>
                </div>
                
                <div className="w-20 flex justify-end">
                  <StatusBadge status={user.status} />
                </div>

                <div className="relative ml-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(menuOpen === user.id ? null : user.id);
                    }}
                    className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors"
                  >
                    <MoreVertical className="w-4 h-4 text-[#737373]" />
                  </button>
                  {menuOpen === user.id && (
                    <>
                      <div 
                        className="fixed inset-0 z-20" 
                        onClick={() => setMenuOpen(null)}
                      />
                      <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] border border-[#e5e5e5] py-1.5 z-30">
                        <button onClick={() => { setEditModal(user); setMenuOpen(null); }} className="w-full text-left px-4 py-2 text-sm text-[#0a0a0a] hover:bg-[#fafafa]">View Details</button>
                        {user.role === "NORMAL" && (
                          <button onClick={() => promoteToCircle(user.id)} className="w-full text-left px-4 py-2 text-sm text-[#F44444] hover:bg-[#fafafa]">Promote to Circle</button>
                        )}
                        <button onClick={() => toggleBan(user.id)} className={`w-full text-left px-4 py-2 text-sm hover:bg-[#fafafa] ${user.status === "banned" ? "text-[#22c55e]" : "text-[#F44444]"}`}>
                          {user.status === "banned" ? "Unban User" : "Ban User"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
            {usersState.length === 0 && !loading && (
              <div className="px-5 py-12 text-center"><p className="text-sm text-[#737373]">No users found.</p></div>
            )}
          </div>
        )}
      </div>

      <AdminModal 
        isOpen={!!banModal} 
        onClose={() => !isSubmitting && setBanModal(null)} 
        title="Ban User"
      >
        {banModal && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
              <UserAvatar src={banModal.avatar} alt={banModal.name} size={40} />
              <div>
                <p className="text-sm font-semibold text-red-900">Banning {banModal.name}</p>
                <p className="text-xs text-red-700">This user will be immediately logged out and blocked from the platform.</p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-bold text-[#737373] uppercase tracking-widest">Reason for Ban</label>
              <div className="grid grid-cols-1 gap-2">
                {commonReasons.map(r => (
                  <button
                    key={r}
                    onClick={() => setBanReason(r)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left ${
                      banReason === r 
                        ? "border-[#0a0a0a] bg-[#fafafa] ring-1 ring-[#0a0a0a]" 
                        : "border-[#e5e5e5] hover:border-[#d5d5d5] bg-white"
                    }`}
                  >
                    <span className={`text-sm font-medium ${banReason === r ? "text-[#0a0a0a]" : "text-[#525252]"}`}>{r}</span>
                    {banReason === r && (
                      <div className="w-4 h-4 rounded-full bg-[#0a0a0a] flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {banReason === "Other" && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                <label className="text-[10px] font-bold text-[#737373] uppercase tracking-widest">Custom Reason</label>
                <textarea
                  value={customReason}
                  onChange={e => setCustomReason(e.target.value)}
                  placeholder="Describe the violation in detail..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-white border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 resize-none transition-all"
                />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                disabled={isSubmitting}
                onClick={() => setBanModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-[#e5e5e5] text-sm font-medium text-[#525252] hover:bg-[#fafafa] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={isSubmitting || (banReason === "Other" && !customReason.trim())}
                onClick={confirmBan}
                className="flex-1 py-2.5 rounded-xl bg-[#0a0a0a] text-white text-sm font-medium hover:bg-black disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm Ban
              </button>
            </div>
          </div>
        )}
      </AdminModal>

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
                <span className="text-sm text-[#737373]">@{editModal.handle}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Role", content: <RoleBadge role={editModal.role} /> },
                { label: "Status", content: <StatusBadge status={editModal.status} /> },
                { label: "Joined", content: <span className="text-sm text-[#0a0a0a]">{editModal.joinDate}</span> },
                { label: "Followers", content: <span className="text-sm text-[#0a0a0a]">{editModal.followers}</span> },
              ].map(item => (
                <div key={item.label} className="rounded-lg bg-[#f5f5f5] p-3">
                  <span className="text-xs text-[#737373] block mb-0.5">{item.label}</span>
                  {item.content}
                </div>
              ))}
            </div>
            <div className="rounded-lg bg-[#f5f5f5] p-3">
              <span className="text-xs text-[#737373] block mb-0.5">Email</span>
              <span className="text-sm text-[#0a0a0a]">{editModal.email}</span>
            </div>
          </div>
        )}
      </AdminModal>
    </div>
  );
}


