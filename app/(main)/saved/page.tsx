"use client";

import Image from "next/image";
import { useState, useEffect, useContext } from "react";
import { Search, Plus, MoreVertical, Share2, Bookmark, Trash2, X, FolderPlus } from "lucide-react";
import { savedTabs, posts as fallbackPosts, users as fallbackUsers, newsArticles, newsAuthors } from "@/app/lib/data";
import { api } from "@/app/lib/api";
import { AuthContext } from "@/app/lib/contexts";
import { SaveBookmarkButton } from "@/app/lib/shared-components";
import { VerifiedBadge, SuggestedProfiles } from "@/app/lib/shared-components";

export default function SavedPage() {
  const { currentUserId, openAuthModal } = useContext(AuthContext);

  // Redirect anonymous users to home page
  if (!currentUserId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <div className="text-center">
          <Bookmark className="w-16 h-16 mx-auto mb-4 text-[#737373]" />
          <h1 className="text-2xl font-semibold mb-2">Sign in to view saved items</h1>
          <p className="text-[#737373] mb-6">You need to be signed in to access your saved posts and collections.</p>
          <button
            onClick={() => openAuthModal("signin")}
            className="px-6 py-2.5 bg-[#0a0a0a] text-white rounded-lg hover:bg-[#1a1a1a] transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  // ALL hooks must be called before any conditional returns
  const [activeTab, setActiveTab] = useState(0);
  const [posts, setPosts] = useState(fallbackPosts);
  const [users, setUsers] = useState(fallbackUsers);
  const [collections, setCollections] = useState<any[]>([]);
    const [savedItems, setSavedItems] = useState<{ postId: number; collectionId: number | null }[]>([]);
  const [activeCollection, setActiveCollection] = useState<number | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creating, setCreating] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(false);

  // Data loading effect (runs on every render but only loads data when authenticated)
  useEffect(() => {
    const loadData = () => {
      // Always load posts and users
      Promise.all([api.getPosts(), api.getUsers()]).then(([p, u]) => { setPosts(p); setUsers(u); }).catch(() => {});
      
      // Only load saved data if user is authenticated
      if (currentUserId) {
        setLoadingSaved(true);
        api.getSaved().then(s => {
          if (!s || s.success === false) {
            setLoadingSaved(false);
            return;
          }
          // API now returns objects with { postId, collectionId } format
          const items = s.posts || [];
          
          // Deduplicate saved items by postId and collectionId combination
          const uniqueItems = items.filter((item, index, self) => 
            index === self.findIndex((other) => 
              other.postId === item.postId && other.collectionId === item.collectionId
            )
          );
          
          setSavedItems(uniqueItems);
          setLoadingSaved(false);
        }).catch((error) => {
          setLoadingSaved(false);
        });
        api.getCollections().then(response => {
          if (response.success && Array.isArray(response.collections)) {
            setCollections(response.collections);
          } else {
            setCollections([]);
          }
        }).catch((error) => {
          setCollections([]);
        });
      }
    };
    
    loadData();
    
    // Listen for save events from other components
    const handleSaveEvent = () => {
      loadData();
    };
    
    // Listen for debug save events
    const handleSaveDebugEvent = (event: CustomEvent) => {
      // Debug event handling
    };
    
    window.addEventListener("albiz-post-saved", handleSaveEvent);
    window.addEventListener("albiz-post-saved-debug", handleSaveDebugEvent as EventListener);
    return () => {
      window.removeEventListener("albiz-post-saved", handleSaveEvent);
      window.removeEventListener("albiz-post-saved-debug", handleSaveDebugEvent as EventListener);
    };
  }, [currentUserId ? currentUserId : null]);

  
  // Show auth prompt for unauthorized users
  if (!currentUserId) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="text-center">
          <Bookmark className="w-12 h-12 text-[#F44444] mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-[#0a0a0a] mb-2">Sign In Required</h2>
          <p className="text-sm text-[#737373] mb-4">Please sign in to view your saved posts</p>
          <button 
            onClick={() => openAuthModal("signin")}
            className="px-4 py-2 text-sm text-white bg-[#F44444] rounded-lg hover:bg-[#d64d3c] transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  const savedPostIds = new Set(savedItems.map(s => s.postId));

  // Include all content types: regular posts, news articles, etc.
  const allContent = [...posts, ...newsArticles];

  const savedPosts = allContent.filter(p => savedPostIds.has(p.id));

  // Deduplicate saved posts by ID to prevent duplicates from posts + newsArticles overlap
  const uniqueSavedPosts = savedPosts.filter((post, index, self) =>
    index === self.findIndex((p) => p.id === post.id)
  );

  const getFiltered = () => {
    let base = uniqueSavedPosts;
    
    // Filter by collection if one is selected
    if (activeCollection !== null) {
      const collectionItems = savedItems.filter(s => s.collectionId === activeCollection);
      const collectionPostIds = new Set(collectionItems.map(s => s.postId));
      
            
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
    api.unsavePost(postId).catch(() => {});
  };

  const createFolder = async () => {
    if (!newFolderName.trim() || creating) return;
    setCreating(true);
    try {
      const response = await api.createCollection(newFolderName.trim());
      if (response.success && response.collection) setCollections(prev => [response.collection, ...prev]);
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
              <span className="text-sm text-[#737373]">{uniqueSavedPosts.length}</span>
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
            {loadingSaved ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, idx) => (
                  <div key={idx} className="rounded-xl border border-[#e5e5e5] p-4 animate-pulse">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-[#f5f5f5] flex-shrink-0"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-[#f5f5f5] rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-[#f5f5f5] rounded w-1/2"></div>
                      </div>
                    </div>
                    <div className="h-3 bg-[#f5f5f5] rounded w-full mb-3"></div>
                    <div className="h-20 bg-[#f5f5f5] rounded mb-3"></div>
                    <div className="flex justify-end">
                      <div className="w-6 h-6 bg-[#f5f5f5] rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((post, idx) => {
                // Handle both regular posts (userId) and news articles (authorId)
                const postUser = 'userId' in post ? users.find((u: any) => u.id === post.userId) : null;
                const author = 'authorId' in post ? newsAuthors.find((a: any) => a.id === post.authorId) : null;
                const displayName = postUser?.name || author?.name || "Unknown";
                const displayAvatar = postUser?.avatar || author?.avatar || "";
                const displayTitle = postUser?.title || author?.role || "";
                
                if (!postUser && !author) return null;
                if (post.type === "article") {
                  return (
                    <div key={`${post.type}-${post.id}-${idx}`} className="rounded-xl border border-[#e5e5e5] overflow-hidden hover:border-[#d5d5d5]">
                      <div className="flex flex-col sm:flex-row">
                        {"image" in post && post.image && (
                          <div className="h-40 sm:h-auto sm:w-48 flex-shrink-0">
                            <Image src={post.image} alt={post.title || ""} width={192} height={160} className="object-cover w-full h-full" />
                          </div>
                        )}
                        <div className="flex-1 p-4 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            {post.tags?.map((tag: string, tagIdx: number) => <span key={`${tag}-${tagIdx}`} className="text-[11px] text-[#F44444] font-medium">{tag}</span>)}
                          </div>
                          {"title" in post && <h3 className="font-semibold text-[#0a0a0a] mb-1 line-clamp-2">{post.title}</h3>}
                          {"description" in post && <p className="text-xs text-[#737373] line-clamp-2 mb-3">{post.description}</p>}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full overflow-hidden">
                                <Image src={displayAvatar} alt={displayName} width={20} height={20} className="object-cover w-full h-full" />
                              </div>
                              <span className="text-xs text-[#737373]">{displayName}</span>
                            </div>
                            <SaveBookmarkButton postId={post.id} initialSaved={true} onSaveChange={(postId, isSaved) => {
                              if (!isSaved) {
                                unsavePost(postId);
                              }
                            }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={`${post.type}-${post.id}-${idx}`} className="rounded-xl border border-[#e5e5e5] p-4 hover:border-[#d5d5d5]">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-[#e5e5e5]">
                        <Image src={displayAvatar} alt={displayName} width={40} height={40} className="object-cover w-full h-full" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-sm text-[#0a0a0a]">{displayName}</span>
                          {postUser?.verified && <VerifiedBadge className="scale-90" />}
                        </div>
                        <span className="text-xs text-[#737373]">{displayTitle}</span>
                      </div>
                    </div>
                    {post.content && <div className="text-sm text-[#262626] mb-3 [&_b]:font-bold [&_i]:italic" dangerouslySetInnerHTML={{ __html: post.content }} />}
                    {post.image && (
                      <div className="rounded-xl overflow-hidden mb-3">
                        <Image src={post.image} alt="" width={800} height={400} className="object-cover w-full" unoptimized />
                      </div>
                    )}
                    <div className="flex items-center justify-end">
                      <SaveBookmarkButton postId={post.id} initialSaved={true} onSaveChange={(postId, isSaved) => {
                        if (!isSaved) {
                          unsavePost(postId);
                        }
                      }} />
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && <div className="text-center py-12"><p className="text-sm text-[#737373]">Nothing saved{activeCollection !== null ? " in this folder" : ""} yet.</p></div>}
            </div>
            )}
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
              <span className="text-sm text-[#737373]">{uniqueSavedPosts.length}</span>
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
