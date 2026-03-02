"use client";

import { useState } from "react";
import { Search, MoreVertical } from "lucide-react";
import { AdminPillTabs, VerifiedBadge, RoleBadge, StatusBadge, UserAvatar, AdminModal } from "../admin-components";
import { generateAdminUsers } from "../admin-data";

const allUsers = generateAdminUsers();
const tabs = ["All", "Circle", "Normal", "Verified", "Banned"];

export default function AdminUsers() {
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const [editModal, setEditModal] = useState<typeof allUsers[0] | null>(null);
  const [usersState, setUsersState] = useState(allUsers);

  const filtered = usersState.filter(user => {
    const tab = tabs[activeTab];
    if (tab === "Circle" && user.role !== "CIRCLE") return false;
    if (tab === "Normal" && user.role !== "NORMAL") return false;
    if (tab === "Verified" && !user.verified) return false;
    if (tab === "Banned" && user.status !== "banned") return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return user.name.toLowerCase().includes(q) || user.handle.toLowerCase().includes(q) || user.email.toLowerCase().includes(q);
    }
    return true;
  });

  const toggleBan = (id: number) => {
    setUsersState(prev => prev.map(u => u.id === id ? { ...u, status: u.status === "banned" ? "active" as const : "banned" as const } : u));
    setMenuOpen(null);
  };

  const promoteToCircle = (id: number) => {
    setUsersState(prev => prev.map(u => u.id === id ? { ...u, role: "CIRCLE" as const } : u));
    setMenuOpen(null);
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-[#0a0a0a]">Users</h1>
        <span className="text-sm text-[#737373]">{usersState.length} total</span>
      </div>

      <div className="relative mb-4">
        <Search className="w-4 h-4 text-[#737373] absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search users..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all"
        />
      </div>

      <div className="mb-4">
        <AdminPillTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
        <div className="divide-y divide-[#f0f0f0]">
          {filtered.map(user => (
            <div key={user.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#fafafa] transition-colors">
              <UserAvatar src={user.avatar} alt={user.name} size={40} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-sm text-[#0a0a0a] truncate">{user.name}</span>
                  {user.verified && <VerifiedBadge className="scale-90" />}
                </div>
                <span className="text-xs text-[#737373] truncate block">@{user.handle}</span>
              </div>
              <RoleBadge role={user.role} />
              <span className="text-xs text-[#737373] hidden sm:block w-20">{user.joinDate}</span>
              <span className="text-xs text-[#737373] hidden md:block w-16 text-right">{user.followers}</span>
              <StatusBadge status={user.status} />
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(menuOpen === user.id ? null : user.id)}
                  className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors"
                >
                  <MoreVertical className="w-4 h-4 text-[#737373]" />
                </button>
                {menuOpen === user.id && (
                  <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.12)] border border-[#e5e5e5] py-1 z-30">
                    <button onClick={() => { setEditModal(user); setMenuOpen(null); }} className="w-full text-left px-4 py-2 text-sm text-[#0a0a0a] hover:bg-[#fafafa]">View Details</button>
                    {user.role === "NORMAL" && (
                      <button onClick={() => promoteToCircle(user.id)} className="w-full text-left px-4 py-2 text-sm text-[#F44444] hover:bg-[#fafafa]">Promote to Circle</button>
                    )}
                    <button onClick={() => toggleBan(user.id)} className={`w-full text-left px-4 py-2 text-sm hover:bg-[#fafafa] ${user.status === "banned" ? "text-[#22c55e]" : "text-[#F44444]"}`}>
                      {user.status === "banned" ? "Unban User" : "Ban User"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="px-5 py-12 text-center"><p className="text-sm text-[#737373]">No users found.</p></div>
          )}
        </div>
      </div>

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
