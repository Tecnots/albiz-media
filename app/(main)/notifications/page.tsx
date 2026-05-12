"use client";

import Image from "next/image";
import Link from "next/link";
import { Crown, Hourglass } from "lucide-react";
import { useState, useContext, useEffect } from "react";
import { FollowingContext, AuthContext } from "@/app/lib/contexts";
import { notifications as fallbackNotifs, users as fallbackUsers } from "@/app/lib/data";
import { VerifiedBadge, RightSidebar } from "@/app/lib/shared-components";
import { api } from "@/app/lib/api";

export default function NotificationsPage() {
  const [filter, setFilter] = useState<"all" | "unread" | "follow" | "like" | "comment" | "circle">("all");
  const [notifState, setNotifState] = useState(fallbackNotifs);
  const [users, setUsers] = useState(fallbackUsers);
  const { following, toggleFollow } = useContext(FollowingContext);
  const { isSignedIn, openAuthModal, currentUserId, userRole } = useContext(AuthContext);

  const handleFollow = (userId: number) => {
    if (!isSignedIn) { openAuthModal("signin"); return; }
    toggleFollow(userId);
  };

  useEffect(() => {
    console.log("NotificationsPage - currentUserId:", currentUserId);
    Promise.all([api.getNotifications(currentUserId), api.getUsers()])
      .then(([n, u]) => { 
        console.log("NotificationsPage - fetched notifications:", n);
        console.log("NotificationsPage - fetched users:", u);
        setNotifState(n); setUsers(u); 
      })
      .catch((err) => { console.error("NotificationsPage - error:", err); });
  }, [currentUserId]);

  const markAllRead = () => {
    setNotifState(prev => prev.map(n => ({ ...n, unread: false })));
    api.markNotificationsRead(undefined, currentUserId).catch(() => {});
  };

  const markAsRead = (notifId: number) => {
    setNotifState(prev => prev.map(n => n.id === notifId ? { ...n, unread: false } : n));
    api.markNotificationsRead([notifId], currentUserId).catch(() => {});
  };

  const filtered = (() => {
    if (filter === "unread") return notifState.filter(n => n.unread);
    if (filter === "follow") return notifState.filter(n => n.type === "follow");
    if (filter === "like") return notifState.filter(n => n.type === "like");
    if (filter === "comment") return notifState.filter(n => n.type === "comment");
    if (filter === "circle") {
      const circleUserIds = users.filter(u => u.role === "CIRCLE").map(u => u.id);
      return notifState.filter(n => circleUserIds.includes(n.userId));
    }
    return notifState;
  })();

  // Sort by ID descending (newest first)
  const sorted = [...filtered].sort((a, b) => b.id - a.id);

  // Remove duplicates - group by userId and type, keep only the latest
  const deduplicated = sorted.reduce<typeof sorted>((acc, notif) => {
    const key = `${notif.userId}-${notif.type}`;
    if (!acc.find(n => `${n.userId}-${n.type}` === key)) {
      acc.push(notif);
    }
    return acc;
  }, []);

  const groups = deduplicated.reduce<Record<string, typeof deduplicated>>((acc, n) => {
    if (!acc[n.group]) acc[n.group] = [];
    acc[n.group].push(n);
    return acc;
  }, {});

  const groupOrder = ["TODAY", "YESTERDAY", "EARLIER"];

  const formatRelativeTime = (time: string) => {
    const now = new Date();
    const notifTime = new Date(time);
    const diffMs = now.getTime() - notifTime.getTime();
    const diffSecs = Math.floor(Math.abs(diffMs) / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    if (diffMonths < 12) return `${diffMonths}mo ago`;
    return `${diffYears}y ago`;
  };

  const getNotifText = (n: typeof notifState[0]) => {
    switch (n.type) {
      case "follow": return "started following you";
      case "like": return "liked your post";
      case "like_story": return "liked your story";
      case "comment": return "commented on your post";
      case "mention": return "mentioned you in a post";
      case "circle_welcome": return "approved your Circle upgrade. Welcome to Circle!";
      case "circle_pending": return "Your application is pending. An admin will check it, please wait for confirmation.";
      default: return "";
    }
  };

  return (
    <>
      <main className="flex-1 min-w-0 bg-white overflow-y-auto">
        <div className="sticky top-0 bg-white z-30">
          <div className="flex items-center justify-between px-4 py-3">
            <h1 className="text-xl font-semibold">Notifications</h1>
            {notifState.some(n => n.unread) && (
              <button onClick={markAllRead} className="text-sm font-medium text-[#F44444] hover:text-[#d64d3c]">Mark all as read</button>
            )}
          </div>
          <div className="flex px-4 pb-3 gap-1.5 overflow-x-auto">
            {(["all", "unread", "follow", "like", "comment", "circle"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`px-2.5 py-1 md:px-3 md:py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors capitalize ${
                filter === f
                  ? "bg-[#F44444] text-white"
                  : "bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb] hover:text-[#0a0a0a] border border-[#e5e5e5]"
              }`}>{f}</button>
            ))}
          </div>
        </div>
        <div className="pb-6">
          {groupOrder.map(group => {
            const items = groups[group];
            if (!items || items.length === 0) return null;
            return (
              <div key={group}>
                <p className="text-xs font-semibold text-[#737373] uppercase tracking-wider px-4 py-2">{group}</p>
                <div className="px-4 space-y-2">
                  {items.map(notif => {
                    const user = users.find(u => u.id === notif.userId);
                    if (!user) return null;
                    const isFollowingUser = following.has(user.id);
                    const canShowFollowButton = userRole === "CIRCLE" && user.role === "CIRCLE";
                    return (
                      <div key={notif.id} className={`flex items-center gap-3 p-3 md:p-4 rounded-xl transition-all duration-200 cursor-pointer ${notif.unread ? "bg-[#fdfdfd] shadow-[0_0_15px_rgba(244,68,68,0.05)] border border-[#F44444]/20" : "bg-white border border-[#e5e5e5] hover:shadow-sm hover:border-[#d5d5d5]"}`}>
                        
                        {/* Avatar or Icon */}
                        {notif.type === "circle_welcome" ? (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#F44444] to-orange-500 flex items-center justify-center flex-shrink-0 shadow-sm shadow-[#F44444]/20">
                            <Crown className="w-5 h-5 text-white" />
                          </div>
                        ) : notif.type === "circle_pending" ? (
                          <div className="w-10 h-10 rounded-full bg-[#f5f5f5] border border-[#e5e5e5] flex items-center justify-center flex-shrink-0 shadow-sm">
                            <Hourglass className="w-5 h-5 text-[#737373]" />
                          </div>
                        ) : user.role === "CIRCLE" ? (
                          <Link href={`/${user.handle}`} onClick={(e) => e.stopPropagation()} className={`w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ${user.hasStory ? "ring-2 ring-[#F44444] ring-offset-1 ring-offset-white" : "ring-1 ring-[#e5e5e5]"}`}>
                            {user.avatar && user.avatar !== "" ? <Image src={user.avatar} alt={user.name} width={40} height={40} className="object-cover w-full h-full" /> : <div className="w-full h-full bg-[#efefef] flex items-center justify-center text-[#737373] text-sm font-medium">{user.name.charAt(0).toUpperCase()}</div>}
                          </Link>
                        ) : (
                          <div className={`w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ${user.hasStory ? "ring-2 ring-[#F44444] ring-offset-1 ring-offset-white" : "ring-1 ring-[#e5e5e5]"}`}>
                            {user.avatar && user.avatar !== "" ? <Image src={user.avatar} alt={user.name} width={40} height={40} className="object-cover w-full h-full" /> : <div className="w-full h-full bg-[#efefef] flex items-center justify-center text-[#737373] text-sm font-medium">{user.name.charAt(0).toUpperCase()}</div>}
                          </div>
                        )}

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] text-[#262626] leading-snug">
                            {notif.type !== "circle_pending" && (
                              <>
                                {user.role === "CIRCLE" ? (
                                  <Link href={`/${user.handle}`} onClick={(e) => e.stopPropagation()} className="font-semibold hover:underline">{user.name}</Link>
                                ) : (
                                  <span className="font-semibold">{user.name}</span>
                                )}
                                {user.verified && <span className="inline-flex items-center align-middle ml-0.5"><VerifiedBadge className="scale-75" /></span>}
                                <span className="text-[#262626]"> </span>
                              </>
                            )}
                            <span className="text-[#262626]">{getNotifText(notif)}</span>
                          </p>
                          <span className="text-xs text-[#737373] font-medium block mt-1">{formatRelativeTime(notif.time)}</span>
                        </div>

                        {/* Actions and Unread Indicator */}
                        <div className="flex items-center gap-3 flex-shrink-0 pl-2">
                          {notif.type === "follow" && canShowFollowButton && (
                            <button onClick={(e) => { e.stopPropagation(); handleFollow(user.id); }} className={`px-4 py-1.5 text-[13px] font-semibold rounded-lg transition-all ${isFollowingUser ? "bg-[#f5f5f5] text-[#262626] hover:bg-[#ebebeb]" : "bg-[#F44444] text-white hover:bg-[#d64d3c]"}`}>
                              {isFollowingUser ? "Following" : "Follow"}
                            </button>
                          )}
                          {notif.postImage && notif.postImage !== "" && (
                            <div className="w-11 h-11 rounded-lg overflow-hidden border border-[#e5e5e5]">
                              <Image src={notif.postImage} alt="Post" width={44} height={44} className="object-cover w-full h-full" />
                            </div>
                          )}
                          {notif.unread && (
                            <div className="w-2.5 h-2.5 rounded-full bg-[#F44444] shadow-sm flex-shrink-0 ml-1" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {deduplicated.length === 0 && <div className="text-center py-16"><p className="text-[#737373] text-sm">No notifications to show.</p></div>}
        </div>
      </main>
      <RightSidebar />
    </>
  );
}
