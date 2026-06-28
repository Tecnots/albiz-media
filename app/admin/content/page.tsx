"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Search, MoreVertical, Star, Pin, Loader2, Calendar } from "lucide-react";
import { AdminPillTabs, StatusBadge, UserAvatar, AdminModal, Dropdown } from "../admin-components";

interface EditorOption {
  id: number;
  name: string;
  handle: string;
}

const tabs = ["All", "Posts", "Articles", "Featured", "Flagged"];

const removalReasons = [
  { value: "Spam", label: "Spam / Commercial", description: "Promotional or repetitive content" },
  { value: "Harassment", label: "Harassment / Hate", description: "Targeted abuse or hate speech" },
  { value: "Inappropriate Content", label: "Inappropriate", description: "NSFW or graphic content" },
  { value: "Misinformation", label: "Misinformation", description: "False or misleading claims" },
  { value: "Copyright Violation", label: "Copyright", description: "Stolen or infringing content" },
  { value: "Other", label: "Other", description: "Violates other community guidelines" },
];

export default function AdminContent() {
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [postsState, setPostsState] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  
  // Removal Modal State
  const [removalId, setRemovalId] = useState<number | null>(null);
  const [removalReason, setRemovalReason] = useState("Spam");
  const [isDeleting, setIsDeleting] = useState(false);

  // Reassign Modal State
  const [reassignPost, setReassignPost] = useState<{ id: number; sectionId: number | null } | null>(null);
  const [editorOptions, setEditorOptions] = useState<EditorOption[]>([]);
  const [selectedEditorId, setSelectedEditorId] = useState<string>("");
  const [isReassigning, setIsReassigning] = useState(false);

  // Schedule Modal State
  const [schedulePostId, setSchedulePostId] = useState<number | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);

  useEffect(() => {
    async function fetchPosts() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/posts");
        const data = await res.json();
        if (Array.isArray(data)) {
          setPostsState(data);
        }
      } catch (err) {
        console.error("Failed to fetch posts:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchPosts();
  }, []);

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
    const post = postsState.find(p => p.id === id);
    const action = post?.featured ? "unfeature" : "feature";
    
    setPostsState(prev => prev.map(p => p.id === id ? { ...p, featured: !p.featured } : p));
    
    fetch("/api/admin/posts", { 
      method: "PATCH", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify({ postId: id, action }) 
    }).catch(() => {
      setPostsState(prev => prev.map(p => p.id === id ? { ...p, featured: !!post?.featured } : p));
    });
  };

  const togglePin = (id: number) => {
    const post = postsState.find(p => p.id === id);
    const action = post?.pinned ? "unpin" : "pin";

    setPostsState(prev => prev.map(p => p.id === id ? { ...p, pinned: !p.pinned } : p));
    
    fetch("/api/admin/posts", { 
      method: "PATCH", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify({ postId: id, action }) 
    }).catch(() => {
      setPostsState(prev => prev.map(p => p.id === id ? { ...p, pinned: !!post?.pinned } : p));
    });
  };

  const initiateRemoval = (id: number) => {
    setRemovalId(id);
    setMenuOpen(null);
  };

  const confirmRemoval = async () => {
    if (!removalId || isDeleting) return;
    
    const id = removalId;
    const originalPosts = [...postsState];
    
    setIsDeleting(true);
    
    try {
      const res = await fetch("/api/admin/posts", { 
        method: "DELETE", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ postId: id, reason: removalReason }) 
      });

      if (!res.ok) throw new Error("Failed to delete");

      setPostsState(prev => prev.filter(p => p.id !== id));
      setRemovalId(null);
    } catch (err) {
      console.error("Removal failed:", err);
      setPostsState(originalPosts);
      alert("Failed to remove post. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const publishApproved = (id: number) => {
    setMenuOpen(null);
    setPostsState(prev => prev.map(p => p.id === id ? { ...p, status: "published" } : p));
    fetch("/api/admin/posts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: id, action: "publish" }),
    }).catch(() => {
      setPostsState(prev => prev.map(p => p.id === id ? { ...p, status: "approved" } : p));
    });
  };

  const initiateSchedule = (id: number) => {
    setMenuOpen(null);
    setScheduleDate("");
    setSchedulePostId(id);
  };

  const confirmSchedule = async () => {
    if (!schedulePostId || isScheduling || !scheduleDate) return;
    setIsScheduling(true);
    try {
      const publishAt = new Date(scheduleDate).toISOString();
      const res = await fetch("/api/admin/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: schedulePostId, action: "schedule", publishAt }),
      });
      if (res.ok) {
        const data = await res.json();
        setPostsState(prev => prev.map(p => p.id === schedulePostId ? { ...p, status: "scheduled", publishAt: data.publishAt } : p));
        setSchedulePostId(null);
      }
    } finally {
      setIsScheduling(false);
    }
  };

  const unschedulePost = (id: number) => {
    setMenuOpen(null);
    setPostsState(prev => prev.map(p => p.id === id ? { ...p, status: "approved", publishAt: null } : p));
    fetch("/api/admin/posts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: id, action: "unschedule" }),
    }).catch(() => {
      setPostsState(prev => prev.map(p => p.id === id ? { ...p, status: "scheduled" } : p));
    });
  };

  const initiateReassign = async (post: any) => {
    setMenuOpen(null);
    setSelectedEditorId("");
    setReassignPost({ id: post.id, sectionId: post.sectionId ?? null });
    try {
      const res = await fetch("/api/admin/editors");
      const data = res.ok ? await res.json() : { editors: [] };
      const allEditors: any[] = data.editors ?? [];
      const eligible = post.sectionId
        ? allEditors.filter((e: any) => e.assignments?.some((a: any) => a.sectionId === post.sectionId))
        : allEditors;
      setEditorOptions(eligible.map((e: any) => ({ id: e.id, name: e.name, handle: e.handle })));
    } catch {
      setEditorOptions([]);
    }
  };

  const confirmReassign = async () => {
    if (!reassignPost || isReassigning) return;
    setIsReassigning(true);
    try {
      const editorId = selectedEditorId ? Number(selectedEditorId) : null;
      const res = await fetch("/api/admin/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: reassignPost.id, action: "reassign", editorId }),
      });
      if (res.ok) {
        setPostsState(prev => prev.map(p => p.id === reassignPost.id ? { ...p, assignedEditorId: editorId } : p));
        setReassignPost(null);
      }
    } finally {
      setIsReassigning(false);
    }
  };

  const dismissFlag = (id: number) => {
    const post = postsState.find(p => p.id === id);
    setPostsState(prev => prev.map(p => p.id === id ? { ...p, flagged: false, flagReason: null, status: "published" } : p));
    setMenuOpen(null);

    fetch("/api/admin/posts", { 
      method: "PATCH", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify({ postId: id, action: "dismiss-flag" }) 
    }).catch(() => {
      setPostsState(prev => prev.map(p => p.id === id ? { ...p, flagged: true, flagReason: post?.flagReason, status: post?.status } : p));
    });
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
        {loading ? (
          <>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-[#e5e5e5] bg-white animate-pulse">
                <div className="flex">
                  <div className="w-32 sm:w-40 flex-shrink-0 hidden sm:block h-28 bg-[#ebebeb] rounded-l-xl" />
                  <div className="flex-1 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1.5 flex-1">
                        <div className="h-3.5 bg-[#ebebeb] rounded" style={{ width: `${40 + (i % 3) * 20}%` }} />
                        <div className="h-3 bg-[#ebebeb] rounded w-56" />
                      </div>
                      <div className="w-6 h-6 bg-[#ebebeb] rounded-lg flex-shrink-0" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#ebebeb]" />
                      <div className="h-3 bg-[#ebebeb] rounded w-28" />
                      <div className="h-4 w-14 bg-[#ebebeb] rounded-full ml-auto" />
                      <div className="h-4 w-16 bg-[#ebebeb] rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-[#e5e5e5] bg-white px-5 py-12 text-center">
            <p className="text-sm text-[#737373]">No content found.</p>
          </div>
        ) : (
          filtered.map(post => (
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
                          {post.type === "ARTICLE" && post.status === "approved" && (
                            <button onClick={() => publishApproved(post.id)} className="w-full text-left px-4 py-2 text-sm text-[#0EA5E9] hover:bg-[#fafafa]">Publish</button>
                          )}
                          {post.type === "ARTICLE" && (
                            <button onClick={() => initiateReassign(post)} className="w-full text-left px-4 py-2 text-sm text-[#525252] hover:bg-[#fafafa]">Reassign</button>
                          )}
                          {post.flagged && (
                            <button onClick={() => dismissFlag(post.id)} className="w-full text-left px-4 py-2 text-sm text-[#22c55e] hover:bg-[#fafafa]">Dismiss Flag</button>
                          )}
                          <button onClick={() => initiateRemoval(post.id)} className="w-full text-left px-4 py-2 text-sm text-[#F44444] hover:bg-[#fafafa]">Remove</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Reassign Modal */}
      <AdminModal
        isOpen={reassignPost !== null}
        onClose={() => setReassignPost(null)}
        title="Reassign editor"
      >
        <div className="space-y-4">
          <p className="text-sm text-[#737373]">
            {editorOptions.length === 0
              ? "No editors cover this article's section."
              : "Choose a new editor for this article. Select none to unassign."}
          </p>
          {editorOptions.length > 0 && (
            <div className="space-y-1">
              {editorOptions.map(e => (
                <button
                  key={e.id}
                  onClick={() => setSelectedEditorId(selectedEditorId === String(e.id) ? "" : String(e.id))}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-sm transition-colors ${selectedEditorId === String(e.id) ? "border-[#0a0a0a] bg-[#fafafa] text-[#0a0a0a]" : "border-[#e5e5e5] text-[#525252] hover:border-[#d4d4d4]"}`}
                >
                  <span className="font-medium">{e.name}</span>
                  <span className="text-[#a3a3a3] text-xs">@{e.handle}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setReassignPost(null)}
              className="flex-1 px-4 py-2 rounded-xl border border-[#e5e5e5] text-sm font-medium hover:bg-[#f5f5f5] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmReassign}
              disabled={isReassigning}
              className="flex-1 px-4 py-2 rounded-xl bg-[#0a0a0a] text-white text-sm font-medium hover:bg-[#1a1a1a] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isReassigning && <Loader2 className="w-4 h-4 animate-spin" />}
              {selectedEditorId ? "Reassign" : "Unassign"}
            </button>
          </div>
        </div>
      </AdminModal>

      {/* Removal Reason Modal */}
      <AdminModal
        isOpen={removalId !== null}
        onClose={() => setRemovalId(null)}
        title="Remove Content"
      >
        <div className="space-y-4">
          <p className="text-sm text-[#737373]">
            Select a reason for removing this post. The author will be notified.
          </p>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#0a0a0a]">Removal Reason</label>
            <Dropdown 
              value={removalReason} 
              onChange={setRemovalReason} 
              options={removalReasons} 
              isStatic={true}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button 
              onClick={() => setRemovalId(null)}
              className="flex-1 px-4 py-2 rounded-xl border border-[#e5e5e5] text-sm font-medium hover:bg-[#f5f5f5] transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={confirmRemoval}
              disabled={isDeleting}
              className="flex-1 px-4 py-2 rounded-xl bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove Post"
              )}
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
