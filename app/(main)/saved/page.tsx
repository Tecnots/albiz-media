"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { Search, Plus, MoreVertical, Share2, Bookmark } from "lucide-react";
import { savedTabs, savedCollections as fallbackCollections, quickFolders, recentlySavedPostIds, posts as fallbackPosts, users as fallbackUsers } from "@/app/lib/data";
import { api } from "@/app/lib/api";
import { VerifiedBadge, SuggestedProfiles } from "@/app/lib/shared-components";

function SavedRightSidebar() {
  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 xl:w-80 overflow-y-auto flex-shrink-0 px-4 xl:px-6 py-6 border-l border-[#e5e5e5] bg-white">
      <div className="mb-6">
        <h2 className="text-base font-semibold text-[#0a0a0a] mb-4">Quick Folders</h2>
        <div className="space-y-1">
          {quickFolders.map(folder => (
            <button key={folder.name} className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-[#fafafa] transition-colors text-left">
              <span className="text-sm text-[#0a0a0a]">{folder.name}</span>
              <span className="text-sm text-[#737373]">{folder.count}</span>
            </button>
          ))}
        </div>
      </div>
      <SuggestedProfiles />
    </aside>
  );
}

export default function SavedPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [posts, setPosts] = useState(fallbackPosts);
  const [users, setUsers] = useState(fallbackUsers);
  const [savedCollections, setSavedCollections] = useState(fallbackCollections);

  useEffect(() => {
    Promise.all([api.getPosts(), api.getUsers(), api.getSaved()])
      .then(([p, u, s]) => { setPosts(p); setUsers(u); if (s.collections) setSavedCollections(s.collections); })
      .catch(() => {});
  }, []);

  const savedPosts = recentlySavedPostIds.map(id => posts.find(p => p.id === id)).filter(Boolean) as typeof posts;

  const getFiltered = () => {
    const tab = savedTabs[activeTab];
    switch (tab) {
      case "News": return savedPosts.filter(p => p.tags?.includes("News"));
      case "Circle posts": return savedPosts.filter(p => p.type === "post");
      case "Media": return savedPosts.filter(p => "image" in p && p.image);
      case "Profiles": case "Others": return [];
      default: return savedPosts;
    }
  };

  const filtered = getFiltered();

  return (
    <>
      <main className="flex-1 min-w-0 px-4 sm:px-6 bg-white overflow-y-auto">
        <div className="sticky top-0 bg-white z-30 py-4 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6 border-b border-[#e5e5e5] md:border-b-0">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold">Saved</h1>
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-[#f5f5f5] rounded-lg"><Search className="w-5 h-5 text-[#737373]" /></button>
              <button className="p-2 hover:bg-[#f5f5f5] rounded-lg"><Plus className="w-5 h-5 text-[#737373]" /></button>
            </div>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6">
            {savedTabs.map((tab, i) => (
              <button key={tab} onClick={() => setActiveTab(i)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${i === activeTab ? "bg-[#F44444] text-white" : "bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb] border border-[#e5e5e5]"}`}>{tab}</button>
            ))}
          </div>
        </div>

        <div className="pt-4 pb-6 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold tracking-widest text-[#737373] uppercase">My Collections</p>
              <button className="text-xs text-[#737373] hover:text-[#0a0a0a]">View all</button>
            </div>
            <div className="space-y-1">
              {savedCollections.slice(0, 3).map(c => (
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl border border-[#e5e5e5] hover:border-[#d5d5d5] transition-colors cursor-pointer">
                  <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                    <Image src={c.image} alt={c.name} width={40} height={40} className="object-cover w-full h-full" />
                  </div>
                  <span className="flex-1 text-sm font-medium text-[#0a0a0a]">{c.name}</span>
                  <span className="text-sm text-[#737373]">{c.count}</span>
                  <button className="p-1 hover:bg-[#f5f5f5] rounded"><MoreVertical className="w-4 h-4 text-[#737373]" /></button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold tracking-widest text-[#737373] uppercase mb-3">Recently Saved</p>
            <div className="space-y-3">
              {filtered.map(post => {
                const postUser = users.find(u => u.id === post.userId);
                if (!postUser) return null;
                if (post.type === "article") {
                  return (
                    <div key={post.id} className="rounded-xl border border-[#e5e5e5] overflow-hidden hover:border-[#d5d5d5]">
                      <div className="flex flex-col sm:flex-row">
                        {"image" in post && post.image && (
                          <div className="h-40 sm:h-auto sm:w-48 flex-shrink-0">
                            <Image src={post.image} alt={post.title || ""} width={192} height={160} className="object-cover w-full h-full" />
                          </div>
                        )}
                        <div className="flex-1 p-4 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            {post.tags?.map(tag => <span key={tag} className="text-[11px] text-[#F44444] font-medium">{tag}</span>)}
                            <div className="flex-1" />
                            <button className="p-1 hover:bg-[#f5f5f5] rounded"><MoreVertical className="w-4 h-4 text-[#737373]" /></button>
                          </div>
                          {"title" in post && <h3 className="font-semibold text-[#0a0a0a] mb-1 line-clamp-2">{post.title}</h3>}
                          {"description" in post && <p className="text-xs text-[#737373] line-clamp-2 mb-3">{post.description}</p>}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full overflow-hidden">
                                <Image src={postUser.avatar} alt={postUser.name} width={20} height={20} className="object-cover w-full h-full" />
                              </div>
                              <span className="text-xs text-[#737373]">{postUser.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button className="p-1.5 hover:bg-[#f5f5f5] rounded-lg"><Share2 className="w-4 h-4 text-[#737373]" /></button>
                              <button className="p-1.5 hover:bg-[#f5f5f5] rounded-lg"><Bookmark className="w-4 h-4 text-[#F44444] fill-[#F44444]" /></button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={post.id} className="rounded-xl border border-[#e5e5e5] p-4 hover:border-[#d5d5d5]">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-[#e5e5e5]">
                        <Image src={postUser.avatar} alt={postUser.name} width={40} height={40} className="object-cover w-full h-full" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-sm text-[#0a0a0a]">{postUser.name}</span>
                          {postUser.verified && <VerifiedBadge className="scale-90" />}
                        </div>
                        <span className="text-xs text-[#737373]">{postUser.title}</span>
                      </div>
                    </div>
                    <p className="text-sm text-[#262626] mb-3">{post.content}</p>
                    <div className="flex items-center gap-4 text-[#737373]">
                      <button className="p-1.5 hover:bg-[#f5f5f5] rounded-lg"><Share2 className="w-4 h-4" /></button>
                      <button className="p-1.5 hover:bg-[#f5f5f5] rounded-lg"><Bookmark className="w-4 h-4 text-[#F44444] fill-[#F44444]" /></button>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && <div className="text-center py-12"><p className="text-sm text-[#737373]">Nothing saved in this category yet.</p></div>}
            </div>
          </div>
        </div>
      </main>
      <SavedRightSidebar />
    </>
  );
}
