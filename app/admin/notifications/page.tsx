"use client";

import { useEffect, useState, useMemo } from "react";
import { Bell, ShieldCheck, Flag, UserCheck, AlertCircle, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { AdminPillTabs } from "../admin-components";
import { Avatar } from "@/app/components/Avatar";

type AdminNotifType = "NEW_USER" | "CIRCLE_UPGRADE" | "CONTENT_REPORT" | "AUTHOR_REQUEST" | "SYSTEM";
type FilterKey = "all" | "unread" | AdminNotifType;

interface AdminNotification {
  id: number;
  type: AdminNotifType;
  title: string;
  message: string;
  metadata: Record<string, any> | null;
  unread: boolean;
  createdAt: string;
}

interface UserProfile {
  id: number;
  name: string;
  handle: string;
  avatar: string;
  role: string;
}

const TYPE_CONFIG: Record<AdminNotifType, {
  icon: any;
  iconBg: string;
  iconColor: string;
  label: string;
  href: string;
}> = {
  NEW_USER:       { icon: UserCheck,   iconBg: "#eff6ff", iconColor: "#3b82f6", label: "New User",  href: "/admin/users"     },
  CIRCLE_UPGRADE: { icon: ShieldCheck, iconBg: "#f5f3ff", iconColor: "#8b5cf6", label: "Approval",  href: "/admin/approvals" },
  CONTENT_REPORT: { icon: Flag,        iconBg: "#fef2f2", iconColor: "#F44444", label: "Report",    href: "/admin/content"   },
  AUTHOR_REQUEST: { icon: UserCheck,   iconBg: "#f0fdf4", iconColor: "#10b981", label: "Author",    href: "/admin/authors"   },
  SYSTEM:         { icon: AlertCircle, iconBg: "#fffbeb", iconColor: "#f59e0b", label: "System",    href: "/admin"           },
};

const FILTER_TABS = ["All", "Unread", "Users", "Approvals", "Reports", "Authors", "System"];
const FILTER_KEYS: FilterKey[] = ["all", "unread", "NEW_USER", "CIRCLE_UPGRADE", "CONTENT_REPORT", "AUTHOR_REQUEST", "SYSTEM"];

const GROUP_ORDER = ["TODAY", "YESTERDAY", "EARLIER"];
const GROUP_LABEL: Record<string, string> = { TODAY: "Today", YESTERDAY: "Yesterday", EARLIER: "Earlier" };

function timeAgo(dateStr: string) {
  const diff   = Date.now() - new Date(dateStr).getTime();
  const secs   = Math.floor(diff / 1000);
  const mins   = Math.floor(secs / 60);
  const hrs    = Math.floor(mins / 60);
  const days   = Math.floor(hrs / 24);
  const months = Math.floor(days / 30);
  const years  = Math.floor(days / 365);
  if (secs   < 60)  return `${secs}s ago`;
  if (mins   < 60)  return `${mins}m ago`;
  if (hrs    < 24)  return `${hrs}h ago`;
  if (days   < 30)  return `${days}d ago`;
  if (months < 12)  return `${months}mo ago`;
  return `${years}y ago`;
}

function getDateGroup(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "TODAY";
  const today     = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  if (d.getTime() === today.getTime())          return "TODAY";
  if (d.getTime() === yesterday.getTime())      return "YESTERDAY";
  return "EARLIER";
}

function UserPhoto({ avatar, name, size = 40 }: { avatar?: string; name: string; size?: number }) {
  return <Avatar src={avatar} name={name} size={size} />;
}

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [userMap, setUserMap]             = useState<Record<number, UserProfile>>({});
  const [loading, setLoading]             = useState(true);
  const [activeTab, setActiveTab]         = useState(0);

  const activeFilter = FILTER_KEYS[activeTab];

  const fetchNotifs = async () => {
    try {
      const res  = await fetch("/api/admin/notifications");
      const text = await res.text();
      if (!text) return;
      const data = JSON.parse(text);
      const notifs: AdminNotification[] = data.notifications ?? [];
      setNotifications(notifs);

      // Collect unique userIds from metadata
      const ids = [
        ...new Set(
          notifs
            .map(n => n.metadata?.userId)
            .filter((id): id is number => typeof id === "number" && !isNaN(id))
        ),
      ];

      if (ids.length > 0) {
        try {
          const ures  = await fetch(`/api/admin/users?ids=${ids.join(",")}`);
          const utext = await ures.text();
          if (utext) {
            const users: UserProfile[] = JSON.parse(utext);
            const map: Record<number, UserProfile> = {};
            for (const u of users) map[u.id] = u;
            setUserMap(map);
          }
        } catch {}
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchNotifs(); }, []);

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
    fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_all_read" }),
    }).catch(() => {});
  };

  const markAsRead = (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, unread: false } : n));
    fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    }).catch(() => {});
  };

  const hasUnread  = notifications.some(n => n.unread);
  const unreadCount = notifications.filter(n => n.unread).length;

  const filtered = useMemo(() => {
    if (activeFilter === "all")    return notifications;
    if (activeFilter === "unread") return notifications.filter(n => n.unread);
    return notifications.filter(n => n.type === activeFilter);
  }, [notifications, activeFilter]);

  const groups = useMemo(() => {
    const map: Record<string, AdminNotification[]> = {};
    for (const n of filtered) {
      const g = getDateGroup(n.createdAt);
      if (!map[g]) map[g] = [];
      map[g].push(n);
    }
    return map;
  }, [filtered]);

  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">

      {/* Page header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-[#0a0a0a]">Notifications</h1>
          {unreadCount > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-[#F44444] text-white text-xs font-semibold">
              {unreadCount}
            </span>
          )}
        </div>
        {hasUnread && (
          <button
            onClick={markAllRead}
            className="text-sm font-medium text-[#F44444] hover:text-[#d64d3c] transition-colors"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="mb-4">
        <AdminPillTabs tabs={FILTER_TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* Body */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[#e5e5e5] bg-white p-4 flex items-center gap-3 animate-pulse">
              <div className="w-9 h-9 rounded-full bg-[#ebebeb] flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="h-3.5 bg-[#ebebeb] rounded" style={{ width: `${40 + (i % 4) * 12}%` }} />
                <div className="h-3 bg-[#ebebeb] rounded w-24" />
              </div>
              <div className="h-4 w-10 bg-[#ebebeb] rounded flex-shrink-0" />
            </div>
          ))}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeFilter}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30, duration: 0.15 }}
          >
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-[#e5e5e5] bg-white px-5 py-12 text-center">
                <p className="text-sm text-[#737373]">No notifications to show.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {GROUP_ORDER.map(group => {
                  const items = groups[group];
                  if (!items || items.length === 0) return null;
                  return (
                    <div key={group}>
                      <p className="text-xs font-semibold text-[#737373] uppercase tracking-wider mb-2 px-1">
                        {GROUP_LABEL[group]}
                      </p>
                      <div className="space-y-2">
                        {items.map(notif => {
                          const cfg    = TYPE_CONFIG[notif.type];
                          const Icon   = cfg.icon;
                          const userId = notif.metadata?.userId as number | undefined;
                          const handle = (notif.metadata?.handle as string | undefined)
                            ?? (notif.message.match(/@([\w]+)/)?.[1]);
                          const user        = userId ? userMap[userId] : null;
                          const userAvatar  = user?.avatar ?? "";
                          const userName    = user?.name ?? notif.message.match(/^([^(@]+)/)?.[1]?.trim() ?? "";
                          const hasPhoto    = userAvatar.trim() !== "";
                          const profileHref = user?.handle
                            ? `/${user.handle}`
                            : handle ? `/${handle}` : null;

                          return (
                            <motion.div
                              key={notif.id}
                              layout
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            >
                              <div
                                onClick={() => notif.unread && markAsRead(notif.id)}
                                className={`flex items-center gap-4 p-4 rounded-xl border bg-white transition-all duration-200 ${
                                  notif.unread
                                    ? "border-[#F44444]/20 shadow-[0_0_15px_rgba(244,68,68,0.05)]"
                                    : "border-[#e5e5e5] hover:border-[#d5d5d5] hover:shadow-sm"
                                }`}
                              >
                                {/* Profile photo with type badge, or plain type icon */}
                                {hasPhoto ? (
                                  <div className="relative flex-shrink-0">
                                    <UserPhoto avatar={userAvatar} name={userName} size={40} />
                                    <div
                                      className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center"
                                      style={{ background: cfg.iconBg }}
                                    >
                                      <Icon className="w-2 h-2" style={{ color: cfg.iconColor }} />
                                    </div>
                                  </div>
                                ) : (
                                  <div
                                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                                    style={{ background: cfg.iconBg }}
                                  >
                                    <Icon className="w-5 h-5" style={{ color: cfg.iconColor }} />
                                  </div>
                                )}

                                {/* Text */}
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm leading-snug ${notif.unread ? "font-medium text-[#0a0a0a]" : "text-[#262626]"}`}>
                                    {notif.message}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span
                                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                      style={{ color: cfg.iconColor, background: cfg.iconBg }}
                                    >
                                      {cfg.label}
                                    </span>
                                    <span className="text-xs text-[#737373]">{timeAgo(notif.createdAt)}</span>
                                  </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {/* View profile button */}
                                  {profileHref && (
                                    <Link
                                      href={profileHref}
                                      target="_blank"
                                      onClick={e => e.stopPropagation()}
                                      className="flex items-center gap-1 text-[11px] text-[#a3a3a3] hover:text-[#0a0a0a] transition-colors px-2 py-1 rounded-lg hover:bg-[#f5f5f5]"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      Profile
                                    </Link>
                                  )}
                                  {/* Navigate to admin section */}
                                  <Link
                                    href={cfg.href}
                                    onClick={e => e.stopPropagation()}
                                    className="text-[11px] text-[#a3a3a3] hover:text-[#0a0a0a] transition-colors px-2 py-1 rounded-lg hover:bg-[#f5f5f5]"
                                  >
                                    View
                                  </Link>
                                  {/* Unread dot */}
                                  {notif.unread && (
                                    <div className="w-2.5 h-2.5 rounded-full bg-[#F44444] shadow-sm flex-shrink-0" />
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
