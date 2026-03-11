"use client";

import Image from "next/image";
import { useState, useEffect, useContext } from "react";
import { Search, Plus, MoreVertical, Share2, Bookmark, Trash2, X, FolderPlus } from "lucide-react";
import { savedTabs, posts as fallbackPosts, users as fallbackUsers } from "@/app/lib/data";
import { api } from "@/app/lib/api";
import { AuthContext } from "@/app/lib/contexts";
import { VerifiedBadge, SuggestedProfiles } from "@/app/lib/shared-components";

export default function SavedPage() {
  const { currentUserId } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState(0);
  const [posts, setPosts] = useState(fallbackPosts);
  const [users, setUsers] = useState(fallbackUsers);
  const [collections, setCollections] = useState<any[]>([]);
  const [savedItems, setSavedItems] = useState<{ postId: number; collectionId: number | null }[]>([]);
  const [activeCollection, setActiveCollection] = useState<number | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    Promise.all([api.getPosts(), api.getUsers()]).then(([p, u]) => { setPosts(p); setUsers(u); }).catch(() => {});
    if (currentUserId) {
      api.getSaved(currentUserId).then(s => {
        const items = s.posts.map((p: any) => typeof p === "number" ? { postId: p, collectionId: null } : p);
        setSavedItems(items);
      }).catch(() => {});
      api.getCollections(currentUserId).then(setCollections).catch(() => {});
    }
  }, [currentUserId]);

  const savedPostIds = new Set(savedItems.map(s => s.postId));
  const savedPosts = posts.filter(p => savedPostIds.has(p.id));

  const getFiltered = () => {
    let base = savedPosts;
    // Filter by collection if one is selected
    if (activeCollection !== null) {
      const collectionPostIds = new Set(savedItems.filter(s => s.collectionId === activeCollection).map(s => s.postId));
      base = base.filter(p => collectionPostIds.has(p.id));
    }
    const tab = savedTabs[activeTab];
    switch (tab) {
      case "News": return base.filter(p => p.tags?.includes("News"));
      case "Circle posts": return base.filter(p => p.type === "post");
      case "Media": return base.filter(p => "image" in p && p.image);
      case "Profiles": case "Others": return [];
      default: return base;
    }
  };

  const filtered = getFiltered();

  const unsavePost = (postId: number) => {
    setSavedItems(prev => prev.filter(s => s.postId !== postId));
    api.unsavePost(currentUserId, postId).catch(() => {});
  };

  const createFolder = async () => {
    if (!newFolderName.trim() || creating) return;
    setCreating(true);
    try {
      const col = await api.createCollection(currentUserId, newFolderName.trim());
      if (col.id) setCollections(prev => [col, ...prev]);
    } catch {}
    setNewFolderName("");
    setCreating(false);
    setShowNewFolder(false);
  };

  const deleteCollection = (id: number) => {
    setCollections(prev => prev.filter(c => c.id !== id));
    if (activeCollection === id) setActiveCollection(null);
    api.deleteCollection(id).catch(() => {});
  };

  return (
    <>
      <main className="flex-1 min-w-0 px-3 sm:px-4 md:px-6 bg-white overflow-y-auto">
        <div className="sticky top-0 bg-white z-30 py-2.5 md:py-4 -mx-3 px-3 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6 border-b border-[#e5e5e5] md:border-b-0">
          <div className="flex items-center justify-between mb-2.5 md:mb-4">
            <h1 className="text-lg md:text-xl font-semibold">Saved</h1>
            <div className="flex items-center gap-1 md:gap-2">
              <button className="p-1.5 md:p-2 hover:bg-[#f5f5f5] rounded-lg"><Search className="w-[18px] h-[18px] md:w-5 md:h-5 text-[#737373]" /></button>
              <button onClick={() => setShowNewFolder(true)} className="p-1.5 md:p-2 hover:bg-[#f5f5f5] rounded-lg"><Plus className="w-[18px] h-[18px] md:w-5 md:h-5 text-[#737373]" /></button>
            </div>
          </div>
          <div className="flex gap-1 md:gap-1.5 overflow-x-auto pb-2 -mx-3 px-3 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6">
            {savedTabs.map((tab, i) => (
              <button key={tab} onClick={() => setActiveTab(i)} className={`px-2.5 py-1 md:px-3 md:py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${i === activeTab ? "bg-[#F44444] text-white" : "bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb] border border-[#e5e5e5]"}`}>{tab}</button>
            ))}
          </div>
        </div>

        <div className="pt-3 md:pt-4 pb-6 space-y-4 md:space-y-6">
          {/* My Collections */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold tracking-widest text-[#737373] uppercase">My Collections</p>
              <button onClick={() => setShowNewFolder(true)} className="text-xs text-[#F44444] hover:underline flex items-center gap-1">
                <FolderPlus className="w-3 h-3" /> New
              </button>
            </div>

            {/* Create folder inline */}
            {showNewFolder && (
              <div className="flex items-center gap-2 p-3 rounded-xl border border-[#F44444]/30 bg-[#FFF5F5] mb-2">
                <input
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") createFolder(); if (e.key === "Escape") setShowNewFolder(false); }}
                  placeholder="Folder name..."
                  className="flex-1 text-sm outline-none bg-transparent text-[#0a0a0a] placeholder:text-[#c5c5c5]"
                  autoFocus
                />
                <button onClick={createFolder} disabled={!newFolderName.trim() || creating} className="px-3 py-1 text-xs font-medium bg-[#F44444] text-white rounded-full disabled:opacity-40">Create</button>
                <button onClick={() => { setShowNewFolder(false); setNewFolderName(""); }}><X className="w-4 h-4 text-[#737373]" /></button>
              </div>
            )}

            {/* All saved (no folder) */}
            <button
              onClick={() => setActiveCollection(null)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors mb-1 ${activeCollection === null ? "border-[#F44444] bg-[#FFF5F5]" : "border-[#e5e5e5] hover:border-[#d5d5d5]"}`}
            >
              <div className="w-10 h-10 rounded-lg bg-[#f5f5f5] flex items-center justify-center flex-shrink-0">
                <Bookmark className="w-5 h-5 text-[#a3a3a3]" />
              </div>
              <span className="flex-1 text-sm font-medium text-[#0a0a0a] text-left">All Saved</span>
              <span className="text-sm text-[#737373]">{savedPosts.length}</span>
            </button>

            {/* User collections */}
            <div className="space-y-1">
              {collections.map(c => (
                <div
                  key={c.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors cursor-pointer group ${activeCollection === c.id ? "border-[#F44444] bg-[#FFF5F5]" : "border-[#e5e5e5] hover:border-[#d5d5d5]"}`}
                >
                  <button onClick={() => setActiveCollection(activeCollection === c.id ? null : c.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <div className="w-10 h-10 rounded-lg bg-[#f5f5f5] flex items-center justify-center flex-shrink-0">
                      <Bookmark className="w-5 h-5 text-[#F44444]" />
                    </div>
                    <span className="flex-1 text-sm font-medium text-[#0a0a0a] truncate">{c.name}</span>
                    <span className="text-sm text-[#737373]">{c.count || 0}</span>
                  </button>
                  <button onClick={() => deleteCollection(c.id)} className="p-1 opacity-0 group-hover:opacity-100 hover:bg-white rounded transition-all">
                    <Trash2 className="w-3.5 h-3.5 text-[#a3a3a3] hover:text-[#F44444]" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Saved Posts */}
          <div>
            <p className="text-[10px] font-semibold tracking-widest text-[#737373] uppercase mb-3">
              {activeCollection !== null ? collections.find(c => c.id === activeCollection)?.name || "Folder" : "Recently Saved"}
            </p>
            <div className="space-y-3">
              {filtered.map(post => {
                const postUser = users.find((u: any) => u.id === post.userId);
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
                            {post.tags?.map((tag: string) => <span key={tag} className="text-[11px] text-[#F44444] font-medium">{tag}</span>)}
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
                            <button onClick={() => unsavePost(post.id)} className="p-1.5 hover:bg-[#f5f5f5] rounded-lg">
                              <Bookmark className="w-4 h-4 text-[#F44444] fill-[#F44444]" />
                            </button>
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
                    {post.content && <div className="text-sm text-[#262626] mb-3 [&_b]:font-bold [&_i]:italic" dangerouslySetInnerHTML={{ __html: post.content }} />}
                    {post.image && (
                      <div className="rounded-xl overflow-hidden mb-3">
                        <Image src={post.image} alt="" width={800} height={400} className="object-cover w-full" unoptimized />
                      </div>
                    )}
                    <div className="flex items-center justify-end">
                      <button onClick={() => unsavePost(post.id)} className="p-1.5 hover:bg-[#f5f5f5] rounded-lg">
                        <Bookmark className="w-4 h-4 text-[#F44444] fill-[#F44444]" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && <div className="text-center py-12"><p className="text-sm text-[#737373]">Nothing saved{activeCollection !== null ? " in this folder" : ""} yet.</p></div>}
            </div>
          </div>
        </div>
      </main>

      {/* Right Sidebar — show user collections as quick folders */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 xl:w-80 overflow-y-auto flex-shrink-0 px-4 xl:px-6 py-6 border-l border-[#e5e5e5] bg-white">
        <div className="mb-6">
          <h2 className="text-base font-semibold text-[#0a0a0a] mb-4">Folders</h2>
          <div className="space-y-1">
            <button onClick={() => setActiveCollection(null)} className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-colors text-left ${activeCollection === null ? "bg-[#FFF5F5] text-[#F44444]" : "hover:bg-[#fafafa]"}`}>
              <span className="text-sm">All Saved</span>
              <span className="text-sm text-[#737373]">{savedPosts.length}</span>
            </button>
            {collections.map(c => (
              <button key={c.id} onClick={() => setActiveCollection(activeCollection === c.id ? null : c.id)} className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-colors text-left ${activeCollection === c.id ? "bg-[#FFF5F5] text-[#F44444]" : "hover:bg-[#fafafa]"}`}>
                <span className="text-sm">{c.name}</span>
                <span className="text-sm text-[#737373]">{c.count || 0}</span>
              </button>
            ))}
          </div>
        </div>
        <SuggestedProfiles />
      </aside>
    </>
  );
}
