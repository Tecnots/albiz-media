"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { ExternalLink, Loader2, FileText } from "lucide-react";
import { AdminPillTabs, Dropdown } from "../admin-components";

interface Author {
  id: number;
  name: string;
  handle: string;
  email: string;
  role: "NORMAL" | "CIRCLE" | "AUTHOR" | "ADMIN";
  avatar: string;
  title: string;
  verified: boolean;
  joinedDate: string | null;
  banned: boolean;
  canPost: boolean;
  articleCount: number;
}

const ROLE_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  ADMIN:  { color: "#0a0a0a", bg: "#f0f0f0",   label: "Admin" },
  AUTHOR: { color: "#8B5CF6", bg: "#F5F3FF",  label: "Author" },
  CIRCLE: { color: "#F44444", bg: "#FFF0F0",  label: "Circle" },
  NORMAL: { color: "#525252", bg: "#f5f5f5",  label: "Normal" },
};

function RolePill({ role }: { role: string }) {
  const s = ROLE_STYLE[role] ?? ROLE_STYLE.NORMAL;
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
      style={{ backgroundColor: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

const TABS = ["All", "Accepted", "Pending", "Rejected"];
const TAB_INVITE_STATUS = [null, "accepted", "pending", "revoked"] as const;

interface InviteLite { email: string; status: string; createdAt: string; }

export default function AdminAuthorsPage() {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [inviteByEmail, setInviteByEmail] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [changing, setChanging] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/authors").then(r => r.ok ? r.json() : { authors: [] }).catch(() => ({ authors: [] })),
      fetch("/api/admin/invites").then(r => r.ok ? r.json() : { invites: [] }).catch(() => ({ invites: [] })),
    ])
      .then(([authorsRes, invitesRes]) => {
        setAuthors(authorsRes.authors ?? []);
        // Map each email to its most-recent invite status (invites already come back
        // ordered by createdAt desc from the API).
        const map: Record<string, string> = {};
        for (const inv of (invitesRes.invites ?? []) as InviteLite[]) {
          const key = inv.email.toLowerCase();
          if (!map[key]) map[key] = inv.status;
        }
        setInviteByEmail(map);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleRoleChange = async (id: number, role: string) => {
    setChanging(id);
    try {
      await fetch("/api/admin/authors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, role }),
      });
      setAuthors(prev => prev.map(a => a.id === id ? { ...a, role: role as Author["role"] } : a));
    } finally { setChanging(null); }
  };

  const handleCanPostToggle = async (id: number, canPost: boolean) => {
    await fetch("/api/admin/authors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, canPost }),
    });
    setAuthors(prev => prev.map(a => a.id === id ? { ...a, canPost } : a));
  };

  // Only AUTHOR-role users are surfaced on this page.
  const authorOnly = authors.filter(a => a.role === "AUTHOR");

  const statusFilter = TAB_INVITE_STATUS[tab];
  const matchesStatus = (a: Author, status: string | null) => {
    if (!status) return true;
    return inviteByEmail[a.email.toLowerCase()] === status;
  };
  const filtered = authorOnly.filter(a => matchesStatus(a, statusFilter));

  const counts = TAB_INVITE_STATUS.map((s, i) =>
    i === 0 ? authorOnly.length : authorOnly.filter(a => matchesStatus(a, s)).length
  );

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs text-[#a3a3a3]">{authorOnly.length} authors · filtered by invitation status</p>
        </div>
      </div>

      <div className="mb-5">
        <AdminPillTabs
          tabs={TABS.map((t, i) => counts[i] > 0 ? `${t} (${counts[i]})` : t)}
          activeTab={tab}
          onTabChange={setTab}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 text-[#a3a3a3] animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-[#e5e5e5] bg-white px-5 py-12 text-center">
          <p className="text-sm text-[#a3a3a3]">
            {statusFilter === "accepted" && "No users from accepted invitations yet."}
            {statusFilter === "pending" && "No users with pending invitations."}
            {statusFilter === "revoked" && "No users with rejected invitations."}
            {!statusFilter && "No users yet."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
          {filtered.map((author, i) => (
            <div key={author.id} className={`flex items-center gap-4 px-5 py-4 ${i < filtered.length - 1 ? "border-b border-[#f5f5f5]" : ""}`}>
              {/* Avatar */}
              <a href={`/${author.handle}`} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                {author.avatar ? (
                  <div className="w-10 h-10 rounded-full overflow-hidden ring-1 ring-[#e5e5e5]">
                    <Image src={author.avatar} alt={author.name} width={40} height={40} sizes="40px" className="object-cover w-full h-full" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#F44444]/10 flex items-center justify-center ring-1 ring-[#e5e5e5]">
                    <span className="text-sm font-semibold text-[#F44444]">{author.name.charAt(0)}</span>
                  </div>
                )}
              </a>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <a
                    href={`/${author.handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-[#0a0a0a] hover:text-[#F44444] transition-colors truncate"
                  >
                    {author.name}
                  </a>
                  <RolePill role={author.role} />
                  {author.verified && (
                    <span className="text-[10px] font-semibold text-[#22c55e] bg-[#F0FDF4] px-1.5 py-0.5 rounded-full">Verified</span>
                  )}
                  {author.banned && (
                    <span className="text-[10px] font-semibold text-[#F44444] bg-[#FFF0F0] px-1.5 py-0.5 rounded-full">Banned</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-[#a3a3a3] flex-wrap">
                  <span>@{author.handle}</span>
                  <span className="text-[#e5e5e5]">·</span>
                  <span>{author.email}</span>
                  {author.title && (
                    <>
                      <span className="text-[#e5e5e5]">·</span>
                      <span className="truncate max-w-[160px]">{author.title}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Article count */}
              <div className="hidden sm:flex flex-col items-center flex-shrink-0 w-12">
                <div className="flex items-center gap-1 text-[#737373]">
                  <FileText className="w-3.5 h-3.5" />
                  <span className="text-sm font-semibold text-[#0a0a0a]">{author.articleCount}</span>
                </div>
                <span className="text-[10px] text-[#a3a3a3]">articles</span>
              </div>

              {/* Role changer */}
              <div className="flex-shrink-0 w-40 relative">
                {changing === author.id ? (
                  <div className="flex items-center justify-center h-8">
                    <Loader2 className="w-4 h-4 animate-spin text-[#a3a3a3]" />
                  </div>
                ) : (
                  <Dropdown
                    value={author.role}
                    onChange={role => handleRoleChange(author.id, role)}
                    options={[
                      { value: "AUTHOR", label: "Author", description: "Author", badge: { label: "Author", color: "#8B5CF6", bg: "#F5F3FF" } },
                      { value: "CIRCLE", label: "Circle", description: "Circle", badge: { label: "Circle", color: "#F44444", bg: "#FFF0F0" } },
                      { value: "ADMIN", label: "Admin", description: "Admin", badge: { label: "Admin", color: "#0a0a0a", bg: "#f0f0f0" } },
                      { value: "NORMAL", label: "Normal", description: "Normal", badge: { label: "Normal", color: "#525252", bg: "#f5f5f5" } },
                    ]}
                  />
                )}
              </div>

              {/* Can post toggle */}
              <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => handleCanPostToggle(author.id, !author.canPost)}
                  className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 ${author.canPost ? "bg-[#F44444]" : "bg-[#e5e5e5]"}`}
                  title={author.canPost ? "Can post — click to revoke" : "Cannot post — click to allow"}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${author.canPost ? "left-4" : "left-0.5"}`} />
                </button>
                <span className="text-[9px] text-[#a3a3a3]">can post</span>
              </div>

              {/* Profile link */}
              <a
                href={`/${author.handle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 hover:bg-[#f5f5f5] rounded-lg text-[#a3a3a3] hover:text-[#525252] transition-colors flex-shrink-0"
                title="View profile"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
