"use client";

import Image from "next/image";
import { useState, useContext, useEffect } from "react";
import { Settings } from "lucide-react";
import { FollowingContext, AuthContext } from "@/app/lib/contexts";
import { notifications as fallbackNotifs, users as fallbackUsers } from "@/app/lib/data";
import { VerifiedBadge, RightSidebar } from "@/app/lib/shared-components";
import { api } from "@/app/lib/api";

export default function NotificationsPage() {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [notifState, setNotifState] = useState(fallbackNotifs);
  const [users, setUsers] = useState(fallbackUsers);
  const { following, toggleFollow } = useContext(FollowingContext);
  const { isSignedIn, openAuthModal, currentUserId } = useContext(AuthContext);

  const handleFollow = (userId: number) => {
    if (!isSignedIn) { openAuthModal("signin"); return; }
    toggleFollow(userId);
  };

  useEffect(() => {
    Promise.all([api.getNotifications(currentUserId), api.getUsers()])
      .then(([n, u]) => { setNotifState(n); setUsers(u); })
      .catch(() => {});
  }, [currentUserId]);

  const markAllRead = () => {
    setNotifState(prev => prev.map(n => ({ ...n, unread: false })));
    api.markNotificationsRead(undefined, currentUserId).catch(() => {});
  };

  const filtered = filter === "unread" ? notifState.filter(n => n.unread) : notifState;

  const groups = filtered.reduce<Record<string, typeof notifState>>((acc, n) => {
    if (!acc[n.group]) acc[n.group] = [];
    acc[n.group].push(n);
    return acc;
  }, {});

  const groupOrder = ["TODAY", "YESTERDAY", "EARLIER"];

  const getNotifText = (n: typeof notifState[0]) => {
    switch (n.type) {
      case "follow": return "started following you";
      case "like": return "liked your post";
      case "like_story": return "liked your story";
      case "comment": return "commented on your post";
      case "mention": return "mentioned you in a post";
      default: return "";
    }
  };

  return (
    <>
      <main className="flex-1 min-w-0 px-3 sm:px-4 md:px-6 bg-white overflow-y-auto">
        <div className="sticky top-0 bg-white z-30 py-2.5 md:py-4 -mx-3 px-3 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6 border-b border-[#e5e5e5] md:border-b-0">
          <div className="flex items-center justify-between mb-2.5 md:mb-4">
            <h1 className="text-lg md:text-xl font-semibold">Notifications</h1>
            <button className="p-1.5 md:p-2 hover:bg-[#f5f5f5] rounded-lg"><Settings className="w-[18px] h-[18px] md:w-5 md:h-5 text-[#737373]" /></button>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex gap-1 md:gap-1.5">
              {(["all", "unread"] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)} className={`px-2.5 py-1 md:px-3 md:py-1.5 rounded-full text-xs font-medium transition-colors capitalize ${filter === f ? "bg-[#F44444] text-white" : "bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb] border border-[#e5e5e5]"}`}>{f}</button>
              ))}
            </div>
            <button onClick={markAllRead} className="text-[11px] md:text-xs text-[#737373] hover:text-[#0a0a0a]">Mark all as read</button>
          </div>
        </div>
        <div className="pt-3 md:pt-4 pb-6 space-y-4 md:space-y-6">
          {groupOrder.map(group => {
            const items = groups[group];
            if (!items || items.length === 0) return null;
            return (
              <div key={group}>
                <p className="text-[10px] font-semibold tracking-widest text-[#737373] uppercase mb-2 md:mb-3">{group}</p>
                <div className="space-y-1">
                  {items.map(notif => {
                    const user = users.find(u => u.id === notif.userId);
                    if (!user) return null;
                    const isFollowingUser = following.has(user.id);
                    return (
                      <div key={notif.id} className={`flex items-center gap-2.5 p-2.5 md:p-3 rounded-xl transition-colors ${notif.unread ? "bg-[#FFF5F5] border border-[#FFD4D4]" : "border border-[#e5e5e5] hover:border-[#d5d5d5]"}`}>
                        <div className={`w-9 h-9 rounded-full overflow-hidden flex-shrink-0 ${user.hasStory ? "ring-2 ring-[#F44444] ring-offset-1 ring-offset-white" : "ring-1 ring-[#e5e5e5]"}`}>
                          <Image src={user.avatar} alt={user.name} width={36} height={36} className="object-cover w-full h-full" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-[#0a0a0a] leading-snug">
                            <span className="font-semibold">{user.name}</span>
                            {user.verified && <span className="inline-flex items-center align-middle ml-0.5"><VerifiedBadge className="scale-75" /></span>}
                            <span className="text-[#525252]"> {getNotifText(notif)}</span>
                          </p>
                          <span className="text-[11px] text-[#a3a3a3] block mt-0.5">{notif.time}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {notif.type === "follow" && (
                            <button onClick={() => handleFollow(user.id)} className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-all ${isFollowingUser ? "bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5]" : "bg-[#F44444] text-white hover:bg-[#d64d3c]"}`}>
                              {isFollowingUser ? "Following" : "Follow"}
                            </button>
                          )}
                          {"postImage" in notif && notif.postImage && (
                            <div className="w-9 h-9 rounded-lg overflow-hidden">
                              <Image src={notif.postImage} alt="Post" width={36} height={36} className="object-cover w-full h-full" />
                            </div>
                          )}
                          {notif.unread && <div className="w-1.5 h-1.5 rounded-full bg-[#F44444] flex-shrink-0" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="text-center py-12"><p className="text-[#737373] text-sm">No notifications to show.</p></div>}
        </div>
      </main>
      <RightSidebar />
    </>
  );
}
