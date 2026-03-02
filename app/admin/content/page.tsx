"use client";

import { useState } from "react";
import Image from "next/image";
import { Search, MoreVertical, Star, Pin } from "lucide-react";
import { AdminPillTabs, StatusBadge, UserAvatar } from "../admin-components";
import { generateAdminPosts } from "../admin-data";

const tabs = ["All", "Posts", "Articles", "Featured", "Flagged"];

export default function AdminContent() {
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [postsState, setPostsState] = useState(generateAdminPosts());
  const [menuOpen, setMenuOpen] = useState<number | null>(null);

  const filtered = postsState.filter(post => {
    const tab = tabs[activeTab];
    if (tab === "Posts" && post.type !== "POST") return false;
    if (tab === "Articles" && post.type !== "ARTICLE") return false;
    if (tab === "Featured" && !post.featured) return false;
    if (tab === "Flagged" && !post.flagged) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const text = (post.title || post.content || "").toLowerCase();
      return text.includes(q) || post.userName.toLowerCase().includes(q);
    }
    return true;
  });

  const toggleFeature = (id: number) => {
    setPostsState(prev => prev.map(p => p.id === id ? { ...p, featured: !p.featured } : p));
  };

  const togglePin = (id: number) => {
    setPostsState(prev => prev.map(p => p.id === id ? { ...p, pinned: !p.pinned } : p));
  };

  const removePost = (id: number) => {
    setPostsState(prev => prev.filter(p => p.id !== id));
    setMenuOpen(null);
  };

  const dismissFlag = (id: number) => {
    setPostsState(prev => prev.map(p => p.id === id ? { ...p, flagged: false, flagReason: null, status: "published" as const } : p));
    setMenuOpen(null);
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-[#0a0a0a]">Content</h1>
        <span className="text-sm text-[#737373]">{postsState.length} items</span>
      </div>

      <div className="relative mb-4">
        <Search className="w-4 h-4 text-[#737373] absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search content..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all"
        />
      </div>

      <div className="mb-4">
        <AdminPillTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      <div className="space-y-3">
        {filtered.map(post => (
          <div key={post.id} className="rounded-xl border border-[#e5e5e5] bg-white hover:border-[#d5d5d5] transition-colors">
            <div className="flex">
              {post.image && (
                <div className="w-32 sm:w-40 flex-shrink-0 hidden sm:block overflow-hidden rounded-l-xl">
                  <Image src={post.image} alt={post.title || "Post"} width={160} height={120} className="object-cover w-full h-full" />
                </div>
              )}
              <div className="flex-1 p-4 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <UserAvatar src={post.avatar} alt={post.userName} size={28} />
                  <span className="text-xs font-medium text-[#0a0a0a]">{post.userName}</span>
                  <span className="text-xs text-[#a3a3a3]">{post.date}</span>
                  <div className="flex-1" />
                  <div className="flex items-center gap-1.5">
                    {post.pinned && <StatusBadge status="featured" />}
                    <StatusBadge status={post.status} />
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#f5f5f5] text-[#525252]">{post.type}</span>
                  </div>
                </div>

                {post.title && <h3 className="font-medium text-sm text-[#0a0a0a] mb-1 line-clamp-1">{post.title}</h3>}
                <p className="text-xs text-[#737373] line-clamp-1 mb-2">{post.content}</p>

                {post.flagged && post.flagReason && (
                  <div className="px-3 py-2 rounded-lg bg-[#FFF5F5] border border-[#FFD4D4] mb-2">
                    <span className="text-xs text-[#F44444]">Flag: {post.flagReason}</span>
                  </div>
                )}

                <div className="flex items-center gap-4 text-xs text-[#737373]">
                  <span>{post.views} views</span>
                  <span>{post.likes} likes</span>
                  <span>{post.comments} comments</span>
                  <div className="flex-1" />
                  <button onClick={() => toggleFeature(post.id)} className={`p-1.5 rounded-lg transition-colors ${post.featured ? "text-[#F44444]" : "text-[#a3a3a3] hover:text-[#F44444]"}`}>
                    <Star className={`w-4 h-4 ${post.featured ? "fill-current" : ""}`} />
                  </button>
                  <button onClick={() => togglePin(post.id)} className={`p-1.5 rounded-lg transition-colors ${post.pinned ? "text-[#F44444]" : "text-[#a3a3a3] hover:text-[#F44444]"}`}>
                    <Pin className={`w-4 h-4 ${post.pinned ? "fill-current" : ""}`} />
                  </button>
                  <div className="relative">
                    <button onClick={() => setMenuOpen(menuOpen === post.id ? null : post.id)} className="p-1.5 hover:bg-[#f5f5f5] rounded-lg">
                      <MoreVertical className="w-4 h-4 text-[#737373]" />
                    </button>
                    {menuOpen === post.id && (
                      <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.12)] border border-[#e5e5e5] py-1 z-30">
                        {post.flagged && (
                          <button onClick={() => dismissFlag(post.id)} className="w-full text-left px-4 py-2 text-sm text-[#22c55e] hover:bg-[#fafafa]">Dismiss Flag</button>
                        )}
                        <button onClick={() => removePost(post.id)} className="w-full text-left px-4 py-2 text-sm text-[#F44444] hover:bg-[#fafafa]">Remove</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="rounded-xl border border-[#e5e5e5] bg-white px-5 py-12 text-center">
            <p className="text-sm text-[#737373]">No content found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
