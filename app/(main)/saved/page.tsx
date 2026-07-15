"use client";

import Image from "next/image";
import { useState, useEffect, useContext, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, MoreVertical, Share2, Bookmark, Trash2, X, FolderPlus, Play, Lock, Paperclip } from "lucide-react";
import { savedTabs, posts as fallbackPosts, users as fallbackUsers, newsArticles, newsAuthors } from "@/app/lib/data";
import { api } from "@/app/lib/api";
import { AuthContext } from "@/app/lib/contexts";
import { SaveBookmarkButton } from "@/app/lib/shared-components";
import { VerifiedBadge, SuggestedProfiles } from "@/app/lib/shared-components";
import { sanitizeHtml, looksLikeHtml } from '@/lib/html-sanitize';
import { useContentTranslation } from "@/app/lib/useContentTranslation";
import { mapShort, ShortCard, ShortViewer, formatCount } from "@/app/lib/shorts-viewer";

function SavedShortRow({ short, onOpen, onUnsave }: { short: any; onOpen: () => void; onUnsave: (shortId: number) => void }) {
  const unsave = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUnsave(short.id);
    api.unsaveShort(short.id).then(() => {
      window.dispatchEvent(new Event("albiz-post-saved"));
    }).catch(() => {});
  };

  return (
    <div onClick={onOpen} className="rounded-xl border border-[#e5e5e5] overflow-hidden hover:border-[#d5d5d5] cursor-pointer">
      <div className="flex flex-col sm:flex-row">
        <div className="relative h-40 sm:h-auto sm:w-32 flex-shrink-0 bg-[#1a1a1a]">
          {short.thumbnail ? (
            <Image src={short.thumbnail} alt={short.title} fill className="object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center"><Play className="w-6 h-6 text-white/40" /></div>
          )}
        </div>
        <div className="flex-1 p-4 min-w-0">
          <span className="text-[11px] text-[#F44444] font-medium">Short</span>
          <h3 className="font-semibold text-[#0a0a0a] mb-1 mt-1 line-clamp-2">{short.title}</h3>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0">
                {short.creator.avatar ? (
                  <Image src={short.creator.avatar} alt={short.creator.name} width={20} height={20} className="object-cover w-full h-full" />
                ) : (
                  <div className="w-full h-full bg-[#404040] flex items-center justify-center">
                    <span className="text-white text-[8px] font-medium">{short.creator.name.charAt(0)}</span>
                  </div>
                )}
              </div>
              <span className="text-xs text-[#737373] truncate">{short.creator.name}</span>
              <span className="text-xs text-[#a3a3a3] whitespace-nowrap">&middot; {formatCount(short.views)} views</span>
            </div>
            <button onClick={unsave} className="p-2 rounded-lg text-[#F44444] bg-[#FFF5F5] hover:bg-[#ffe5e5] transition-colors flex-shrink-0">
              <Bookmark className="w-4 h-4 fill-[#F44444]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TranslateToggle({ isTranslatable, showTranslated, state, handleTranslate, toggleOriginal }: { isTranslatable: boolean; showTranslated: boolean; state: "idle" | "loading" | "done"; handleTranslate: () => void; toggleOriginal: () => void }) {
  if (!isTranslatable) return null;
  return showTranslated ? (
    <button onClick={toggleOriginal} className="text-[11px] text-[#a3a3a3] hover:text-[#525252] transition-colors">Show original</button>
  ) : (
    <button onClick={handleTranslate} disabled={state === "loading"} className="text-[11px] text-[#a3a3a3] hover:text-[#525252] transition-colors disabled:opacity-60">
      {state === "loading" ? "Translating…" : "Translate"}
    </button>
  );
}

function SavedArticleCard({ post, displayName, displayAvatar, unsavePost }: { post: any; displayName: string; displayAvatar: string; unsavePost: (postId: number) => void }) {
  const { translated, showTranslated, isTranslatable, state, handleTranslate, toggleOriginal, isRtl } = useContentTranslation("article", post.id, {
    title: "title" in post ? post.title ?? undefined : undefined,
    description: "description" in post ? post.description ?? undefined : undefined,
  });
  const displayTitle = showTranslated ? translated?.title ?? post.title : post.title;
  const displayDescription = showTranslated ? translated?.description ?? post.description : post.description;

  return (
    <div className="rounded-xl border border-[#e5e5e5] overflow-hidden hover:border-[#d5d5d5]">
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
          {"title" in post && <h3 className="font-semibold text-[#0a0a0a] mb-1 line-clamp-2" dir={isRtl ? "rtl" : undefined}>{displayTitle}</h3>}
          {"description" in post && <p className="text-xs text-[#737373] line-clamp-2 mb-3" dir={isRtl ? "rtl" : undefined}>{displayDescription}</p>}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full overflow-hidden">
                <Image src={displayAvatar} alt={displayName} width={20} height={20} className="object-cover w-full h-full" />
              </div>
              <span className="text-xs text-[#737373]">{displayName}</span>
            </div>
            <div className="flex items-center gap-3">
              <TranslateToggle isTranslatable={isTranslatable} showTranslated={showTranslated} state={state} handleTranslate={handleTranslate} toggleOriginal={toggleOriginal} />
              <SaveBookmarkButton postId={post.id} initialSaved={true} onSaveChange={(postId, isSaved) => { if (!isSaved) unsavePost(postId); }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SavedPostCard({ post, displayName, displayAvatar, displayJobTitle, verified, unsavePost }: { post: any; displayName: string; displayAvatar: string; displayJobTitle: string; verified: boolean; unsavePost: (postId: number) => void }) {
  const { translated, showTranslated, isTranslatable, state, handleTranslate, toggleOriginal, isRtl } = useContentTranslation("post", post.id, {
    content: post.content ? (looksLikeHtml(post.content) ? { html: post.content } : post.content) : undefined,
  });
  const translatedContent = translated?.content ?? null;

  return (
    <div className="rounded-xl border border-[#e5e5e5] p-4 hover:border-[#d5d5d5]">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-[#e5e5e5]">
          <Image src={displayAvatar} alt={displayName} width={40} height={40} className="object-cover w-full h-full" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-medium text-sm text-[#0a0a0a]">{displayName}</span>
            {verified && <VerifiedBadge className="scale-90" />}
          </div>
          <span className="text-xs text-[#737373]">{displayJobTitle}</span>
        </div>
      </div>
      {post.content && (
        <>
          <div
            className="text-sm text-[#262626] mb-1 [&_b]:font-bold [&_i]:italic"
            dir={isRtl ? "rtl" : undefined}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(showTranslated && translatedContent ? translatedContent : post.content) }}
          />
          <div className="mb-3">
            <TranslateToggle isTranslatable={isTranslatable} showTranslated={showTranslated} state={state} handleTranslate={handleTranslate} toggleOriginal={toggleOriginal} />
          </div>
        </>
      )}
      {post.image && (
        <div className="rounded-xl overflow-hidden mb-3">
          <Image src={post.image} alt="" width={800} height={400} className="object-cover w-full" unoptimized />
        </div>
      )}
      <div className="flex items-center justify-end">
        <SaveBookmarkButton postId={post.id} initialSaved={true} onSaveChange={(postId, isSaved) => { if (!isSaved) unsavePost(postId); }} />
      </div>
    </div>
  );
}

function savedTimeLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}

function SavedMessageCard({ m, onOpen, onUnsave }: { m: any; onOpen: (m: any) => void; onUnsave: (id: number) => void }) {
  const other = m.otherUser;
  const senderLabel = m.fromMe ? "You" : (m.sender?.name?.split(" ")[0] || other?.name || "");
  const hasAttachment = !!m.attachmentType;
  const isImage = m.attachmentType === "image" && m.attachmentUrl;

  return (
    <div onClick={() => onOpen(m)} className="rounded-xl border border-[#e5e5e5] p-4 hover:border-[#d5d5d5] cursor-pointer transition-colors">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-[#e5e5e5] bg-[#f5f5f5] flex items-center justify-center">
          {other?.avatar ? (
            <Image src={other.avatar} alt={other.name || ""} width={40} height={40} className="object-cover w-full h-full" />
          ) : (
            <span className="text-[#737373] text-sm font-medium">{(other?.name || "?").charAt(0)}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-medium text-sm text-[#0a0a0a] truncate">{other?.name || "Conversation"}</span>
            {other?.verified && <VerifiedBadge className="scale-90" />}
          </div>
          <p className="text-sm text-[#262626] line-clamp-2 mt-0.5 break-words">
            <span className="text-[#737373]">{senderLabel}:</span>{" "}
            {m.encrypted ? (
              <span className="inline-flex items-center gap-1 text-[#737373]"><Lock className="w-3 h-3" /> Encrypted message</span>
            ) : hasAttachment && !m.preview ? (
              <span className="inline-flex items-center gap-1 text-[#737373]"><Paperclip className="w-3 h-3" /> Attachment</span>
            ) : (
              <>{hasAttachment && <Paperclip className="w-3 h-3 inline mr-0.5 text-[#a3a3a3]" />}{m.preview}{m.edited && <span className="text-[11px] italic text-[#a3a3a3]"> (edited)</span>}</>
            )}
          </p>
          <span className="text-[11px] text-[#a3a3a3] mt-1 block">{savedTimeLabel(m.savedAt || m.createdAt)}</span>
        </div>
        {isImage && (
          <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-[#e5e5e5]">
            <Image src={m.attachmentUrl} alt="" width={48} height={48} className="object-cover w-full h-full" unoptimized />
          </div>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onUnsave(m.id); }}
          aria-label="Remove bookmark"
          className="p-2 rounded-lg text-[#F44444] bg-[#FFF5F5] hover:bg-[#ffe5e5] transition-colors flex-shrink-0"
        >
          <Bookmark className="w-4 h-4 fill-[#F44444]" />
        </button>
      </div>
    </div>
  );
}

export default function SavedPage() {
  const router = useRouter();
  const { currentUserId, openAuthModal } = useContext(AuthContext);

  // ALL hooks must be called before any conditional returns
  const [activeTab, setActiveTab] = useState(0);
  const [posts, setPosts] = useState(fallbackPosts);
  const [users, setUsers] = useState(fallbackUsers);
  const [collections, setCollections] = useState<any[]>([]);
  const [savedItems, setSavedItems] = useState<{ postId: number; collectionId: number | null; savedAt?: string }[]>([]);
  const [shorts, setShorts] = useState<any[]>([]);
  const [viewingShort, setViewingShort] = useState<number | null>(null);
  const [activeCollection, setActiveCollection] = useState<number | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creating, setCreating] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(false);

  // Saved chat messages (Saved → Chats tab).
  const [savedMessages, setSavedMessages] = useState<any[]>([]);
  const [msgStatus, setMsgStatus] = useState<"idle" | "loading" | "loadingMore" | "ready" | "error">("idle");
  const [msgHasMore, setMsgHasMore] = useState(false);

  const loadSavedMessages = useCallback(async (skip: number) => {
    setMsgStatus(skip > 0 ? "loadingMore" : "loading");
    try {
      const res = await api.getSavedMessages(skip, 20);
      const rows = Array.isArray(res?.messages) ? res.messages : [];
      setSavedMessages(prev => (skip > 0 ? [...prev, ...rows] : rows));
      setMsgHasMore(!!res?.hasMore);
      setMsgStatus("ready");
    } catch {
      if (skip === 0) setSavedMessages([]);
      setMsgStatus("error");
    }
  }, []);

  // Load saved chats + keep them in sync: same-tab bookmark changes, other-tab
  // changes (storage ping), and returning focus to this tab.
  useEffect(() => {
    if (!currentUserId) return;
    const reload = () => loadSavedMessages(0);
    reload();
    const onStorage = (e: StorageEvent) => { if (e.key === "albiz-saved-ping") reload(); };
    window.addEventListener("albiz-saved-changed", reload);
    window.addEventListener("focus", reload);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("albiz-saved-changed", reload);
      window.removeEventListener("focus", reload);
      window.removeEventListener("storage", onStorage);
    };
  }, [currentUserId, loadSavedMessages]);

  const unsaveMessage = (id: number) => {
    setSavedMessages(prev => prev.filter(m => m.id !== id));
    api.unsaveMessageItem(id).catch(() => {});
    // Reflect in the messaging screen (other tabs) too.
    if (typeof window !== "undefined") {
      try { localStorage.setItem("albiz-saved-ping", String(Date.now())); } catch {}
    }
  };

  const openSavedMessage = (m: any) => {
    router.push(`/messages?c=${m.conversationId}&msg=${m.id}`);
  };

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
          // API now returns objects with { postId, collectionId, savedAt } format
          const items = s.posts || [];

          // Deduplicate saved items by postId and collectionId combination
          const uniqueItems = items.filter((item, index, self) =>
            index === self.findIndex((other) =>
              other.postId === item.postId && other.collectionId === item.collectionId
            )
          );

          setSavedItems(uniqueItems);
          setShorts((s.shorts || []).map((sh: any) => ({ ...mapShort(sh), collectionId: sh.collectionId ?? null, savedAt: sh.savedAt ?? null })));
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
      <main className="flex-1 min-w-0 bg-white flex items-center justify-center p-6 min-h-[80vh]">
        <div className="max-w-xs text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#f5f5f5] flex items-center justify-center mx-auto text-[#737373]">
            <Bookmark className="w-6 h-6 stroke-[1.5]" />
          </div>
          <p className="text-sm text-[#525252] leading-relaxed">Sign in or create an account to save posts and organize content into custom collections.</p>
          <div className="flex flex-col gap-2 pt-2">
            <button onClick={() => openAuthModal("signin")} className="w-full py-2.5 rounded-xl bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer">Sign in</button>
            <button onClick={() => openAuthModal("signup")} className="w-full py-2.5 rounded-xl bg-[#f5f5f5] text-[#0a0a0a] text-sm font-medium hover:bg-[#e5e5e5] transition-colors cursor-pointer">Create account</button>
          </div>
        </div>
      </main>
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

  const savedAtMs = (v: string | null | undefined) => v ? new Date(v).getTime() : 0;
  const postSavedAtMap = new Map(savedItems.map(s => [s.postId, s.savedAt]));

  // Filter by collection if one is selected — applies to both posts and shorts.
  let basePosts = uniqueSavedPosts;
  let baseShorts = shorts;
  if (activeCollection !== null) {
    const collectionPostIds = new Set(savedItems.filter(s => s.collectionId === activeCollection).map(s => s.postId));
    basePosts = basePosts.filter(p => collectionPostIds.has(p.id));
    baseShorts = baseShorts.filter(s => s.collectionId === activeCollection);
  }

  const activeTabName = savedTabs[activeTab];

  // The Shorts tab shows only saved Shorts, as its own grid.
  const filteredShorts = baseShorts;

  // Every other tab shows posts (and, on "All", Shorts interleaved by save time).
  const getFilteredPosts = () => {
    switch (activeTabName) {
      case "News": return basePosts.filter(p => p.tags?.includes("News"));
      case "Posts": return basePosts.filter(p => p.type === "post");
      case "Shorts": case "Profiles": case "Others": return [];
      default: return basePosts;
    }
  };

  const filteredPosts = getFilteredPosts();

  type FeedItem = { kind: "post"; post: any } | { kind: "short"; short: any };
  const feed: FeedItem[] = activeTabName === "Shorts"
    ? []
    : [
        ...filteredPosts.map((post): FeedItem => ({ kind: "post", post })),
        ...(activeTabName === "All" ? baseShorts.map((short): FeedItem => ({ kind: "short", short })) : []),
      ].sort((a, b) => {
        const aTime = a.kind === "short" ? savedAtMs(a.short.savedAt) : savedAtMs(postSavedAtMap.get(a.post.id));
        const bTime = b.kind === "short" ? savedAtMs(b.short.savedAt) : savedAtMs(postSavedAtMap.get(b.post.id));
        return bTime - aTime;
      });

  const viewedShort = viewingShort ? shorts.find(s => s.id === viewingShort) : null;

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
      <main className="flex-1 min-w-0 px-3 sm:px-4 md:px-6 bg-white overflow-y-auto overflow-x-hidden">
        <div className="sticky top-0 bg-white z-30 pt-1 pb-3 md:py-4 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6 border-b border-[#e5e5e5] md:border-b-0">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <h1 className="text-xl font-semibold">Saved</h1>
            <div className="flex items-center gap-1 md:gap-2">
              <button className="p-2 hover:bg-[#f5f5f5] rounded-lg"><Search className="w-5 h-5 text-[#737373]" /></button>
              <button onClick={() => setShowNewFolder(true)} className="p-2 hover:bg-[#f5f5f5] rounded-lg"><Plus className="w-5 h-5 text-[#737373]" /></button>
            </div>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6">
            {savedTabs.map((tab, i) => (
              <button key={tab} onClick={() => setActiveTab(i)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${i === activeTab ? "bg-[#F44444] text-white" : "bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb] border border-[#e5e5e5]"}`}>{tab}</button>
            ))}
          </div>
        </div>

        <div className="pt-3 md:pt-4 pb-6 space-y-4 md:space-y-6">
          {/* My Collections (post/short folders — not applicable to saved chats) */}
          {activeTabName !== "Chats" && (
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
          )}

          {activeTabName === "Chats" ? (
            /* Chats tab — bookmarked chat messages */
            <div>
              <p className="text-[10px] font-semibold tracking-widest text-[#737373] uppercase mb-3">Saved Chats</p>
              {msgStatus === "loading" && savedMessages.length === 0 ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, idx) => (
                    <div key={idx} className="rounded-xl border border-[#e5e5e5] p-4 animate-pulse flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#f5f5f5] flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3.5 bg-[#f5f5f5] rounded w-1/3" />
                        <div className="h-3 bg-[#f5f5f5] rounded w-3/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : msgStatus === "error" && savedMessages.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-[#737373] mb-2">Couldn&apos;t load saved chats.</p>
                  <button onClick={() => loadSavedMessages(0)} className="text-sm text-[#F44444] font-medium hover:underline">Retry</button>
                </div>
              ) : savedMessages.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-[#737373]">No saved messages yet.</p>
                  <p className="text-xs text-[#a3a3a3] mt-1">Bookmark a message from any conversation to find it here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {savedMessages.map(m => (
                    <SavedMessageCard key={m.id} m={m} onOpen={openSavedMessage} onUnsave={unsaveMessage} />
                  ))}
                  {msgHasMore && (
                    <div className="flex justify-center pt-1">
                      <button
                        onClick={() => loadSavedMessages(savedMessages.length)}
                        disabled={msgStatus === "loadingMore"}
                        className="px-4 py-2 rounded-full text-sm font-medium text-[#F44444] bg-[#FFF5F5] hover:bg-[#ffe5e5] transition-colors disabled:opacity-50"
                      >
                        {msgStatus === "loadingMore" ? "Loading…" : "Load more"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : activeTabName === "Shorts" ? (
            /* Shorts tab — only saved Shorts, as their own grid */
            <div>
              <p className="text-[10px] font-semibold tracking-widest text-[#737373] uppercase mb-3">
                {activeCollection !== null ? collections.find(c => c.id === activeCollection)?.name || "Folder" : "Shorts"}
              </p>
              {filteredShorts.length === 0 ? (
                <div className="text-center py-12"><p className="text-sm text-[#737373]">No saved Shorts{activeCollection !== null ? " in this folder" : ""} yet.</p></div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {filteredShorts.map(short => (
                    <ShortCard key={short.id} short={short} onClick={() => setViewingShort(short.id)} />
                  ))}
                </div>
              )}
            </div>
          ) : (
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
                {feed.map((entry, idx) => {
                if (entry.kind === "short") {
                  return (
                    <SavedShortRow
                      key={`short-${entry.short.id}`}
                      short={entry.short}
                      onOpen={() => setViewingShort(entry.short.id)}
                      onUnsave={(shortId) => setShorts(prev => prev.filter(s => s.id !== shortId))}
                    />
                  );
                }
                const post = entry.post;
                // Handle both regular posts (userId) and news articles (authorId)
                const postUser = 'userId' in post ? users.find((u: any) => u.id === post.userId) : null;
                const author = 'authorId' in post ? newsAuthors.find((a: any) => a.id === post.authorId) : null;
                const displayName = postUser?.name || author?.name || "Unknown";
                const displayAvatar = postUser?.avatar || author?.avatar || "";
                const displayTitle = postUser?.title || author?.role || "";

                if (!postUser && !author) return null;
                if (post.type === "article") {
                  return (
                    <SavedArticleCard
                      key={`${post.type}-${post.id}-${idx}`}
                      post={post}
                      displayName={displayName}
                      displayAvatar={displayAvatar}
                      unsavePost={unsavePost}
                    />
                  );
                }
                return (
                  <SavedPostCard
                    key={`${post.type}-${post.id}-${idx}`}
                    post={post}
                    displayName={displayName}
                    displayAvatar={displayAvatar}
                    displayJobTitle={displayTitle}
                    verified={!!postUser?.verified}
                    unsavePost={unsavePost}
                  />
                );
              })}
              {feed.length === 0 && <div className="text-center py-12"><p className="text-sm text-[#737373]">Nothing saved{activeCollection !== null ? " in this folder" : ""} yet.</p></div>}
            </div>
            )}
          </div>
          )}
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

      {viewedShort && (
        <ShortViewer
          short={viewedShort}
          shorts={filteredShorts}
          onClose={() => setViewingShort(null)}
          onNavigate={(id) => setViewingShort(id)}
          onLikeChange={(id, liked) => setShorts(prev => prev.map(s => s.id === id ? { ...s, liked, likes: Math.max(0, s.likes + (liked ? 1 : -1)) } : s))}
          onSaveChange={(id, saved) => { if (!saved) { setViewingShort(null); setShorts(prev => prev.filter(s => s.id !== id)); } }}
          onViewed={(id) => setShorts(prev => prev.map(s => s.id === id ? { ...s, views: s.views + 1 } : s))}
          onCommentCountChange={(id, count) => setShorts(prev => prev.map(s => s.id === id ? { ...s, comments: count } : s))}
        />
      )}
    </>
  );
}
