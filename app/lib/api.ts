// Centralized API fetch module — all Supabase data flows through here

const BASE = "/api";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      // Return a safe error object instead of throwing to avoid console noise
      return { success: false, error: "Unauthorized", status: res.status } as any;
    }
    console.error(`API Error: ${path} returned ${res.status}`);
    throw new Error(`API ${path}: ${res.status}`);
  }
  return res.json();
}

async function post<T>(path: string, data: any): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`API POST Error: ${path} returned ${res.status}`, err);
    throw new Error(`API ${path}: ${res.status}`);
  }
  return res.json();
}

export const api = {
  get,
  post,
  // Auth
  login: (email: string, password: string) =>
    fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).then(r => r.json()),

  // Stories
  getStories: (userId?: number, status?: string) =>
    get<any>(`/stories${userId || status ? "?" : ""}${userId ? `userId=${userId}` : ""}${userId && status ? "&" : ""}${status ? `status=${status}` : ""}`),

  createStory: (userId: number, imageUrl: string, opts?: { textOverlay?: string; textColor?: string; textBold?: boolean; textItalic?: boolean; textAlign?: string; textPosX?: number; textPosY?: number; textScale?: number; location?: string; locPosX?: number; locPosY?: number; imgPosX?: number; imgPosY?: number; imgScale?: number; imgFit?: string; stickers?: Record<string, any>; visibility?: string; status?: string }) =>
    fetch(`${BASE}/stories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, imageUrl, ...opts }),
    }).then(r => r.json()),

  updateStory: (storyId: number, userId: number, action: "archive" | "publish" | "unarchive") =>
    fetch(`${BASE}/stories`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storyId, userId, action }),
    }).then(r => r.json()),

  deleteStory: (storyId: number, userId: number) =>
    fetch(`${BASE}/stories`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storyId, userId }),
    }).then(r => r.json()),

  storyAction: (storyId: number, action: "view" | "like" | "unlike", userId?: number) =>
    fetch(`${BASE}/stories`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storyId, action, userId }),
    }).then(r => r.json()),

  // Users
  getUsers: () => get<any[]>("/users"),

  // Posts
  getPosts: (status?: "all" | "drafts") => get<any[]>(`/posts${status ? `?status=${status}` : ""}`),

  // Trending
  getTrending: () => get<any[]>("/trending"),

  // Circle
  getCircleMembers: (mode?: "explore" | "suggested") =>
    get<any[]>(`/circle/members${mode ? `?mode=${mode}` : ""}`),

  // Notifications
  getNotifications: (userId?: number) => get<any[]>(`/notifications${userId ? `?userId=${userId}` : ""}`),

  // Conversations
  getConversations: () => get<any[]>("/conversations"),

  getConversationsPoll: (userId: number, since?: string) => {
    const params = new URLSearchParams({ userId: String(userId) });
    if (since) params.set("since", since);
    return fetch(`${BASE}/conversations?${params}`).then(r => r.json());
  },

  sendMessage: (toUserId: number, text: string, options?: { storyImage?: string; encrypted?: boolean; iv?: string; fromUserId?: number }) =>
    fetch(`${BASE}/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toUserId, text, fromUserId: options?.fromUserId, storyImage: options?.storyImage, encrypted: options?.encrypted, iv: options?.iv }),
    }).then(r => r.json()),

  markConversationRead: (conversationId: number, userId?: number) =>
    fetch(`${BASE}/conversations`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, userId }),
    }).then(r => r.json()),

  setTyping: (conversationId: number, userId: number) =>
    fetch(`${BASE}/conversations/typing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, userId }),
    }).then(r => r.json()),

  updatePresence: (userId: number) =>
    fetch(`${BASE}/users/presence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    }).then(r => r.json()),

  updatePublicKey: (userId: number, publicKey: string) =>
    fetch(`${BASE}/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicKey }),
    }).then(r => r.json()),

  toggleEncryption: (conversationId: number, enabled: boolean) =>
    fetch(`${BASE}/conversations`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, encryptionEnabled: enabled }),
    }).then(r => r.json()),

  // Circle users for new conversation picker
  getCircleUsers: (excludeUserId?: number, query?: string) => {
    const params = new URLSearchParams();
    if (excludeUserId) params.set("exclude", String(excludeUserId));
    if (query) params.set("q", query);
    return get<any[]>(`/users/circle?${params}`);
  },

  // Search conversations by name or message content
  searchConversations: (userId: number, query: string, since?: string) => {
    const params = new URLSearchParams({ userId: String(userId), search: query });
    if (since) params.set("since", since);
    return fetch(`${BASE}/conversations?${params}`).then(r => r.json());
  },

  // In-chat message search
  searchMessages: (conversationId: number, query: string) =>
    get<{ results: any[] }>(`/messages/search?conversationId=${conversationId}&q=${encodeURIComponent(query)}`),

  // Chat file upload
  uploadChatFile: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    form.append("category", "messages");
    return fetch(`${BASE}/upload`, { method: "POST", body: form }).then(r => r.json());
  },

  // Edit message
  editMessage: (messageId: number, text: string) =>
    fetch(`${BASE}/messages/${messageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }).then(r => r.json()),

  // Delete message
  deleteMessage: (messageId: number) =>
    fetch(`${BASE}/messages/${messageId}`, { method: "DELETE" }).then(r => r.json()),

  // Save/unsave message
  saveMessageItem: (messageId: number) =>
    fetch(`${BASE}/messages/${messageId}/save`, { method: "POST" }).then(r => r.json()),
  unsaveMessageItem: (messageId: number) =>
    fetch(`${BASE}/messages/${messageId}/save`, { method: "DELETE" }).then(r => r.json()),

  // Clear chat
  clearChat: (conversationId: number) =>
    fetch(`${BASE}/conversations/${conversationId}/clear`, { method: "POST" }).then(r => r.json()),

  // Saved Data
  getSaved: () => get<{ success: boolean; collections: any[]; posts: any[]; totalSaved: number }>("/user/saved"),

  // Save/Unsave operations
  savePost: (postId: number, collectionId?: number) =>
    fetch(`${BASE}/user/saved`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, collectionId }),
    }).then(r => r.json()),

  unsavePost: (postId: number) =>
    fetch(`${BASE}/user/saved`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    }).then(r => r.json()),

  // Collections
  getCollections: () => get<{ success: boolean; collections: any[] }>("/user/collections"),
  createCollection: (name: string, image?: string) =>
    fetch(`${BASE}/user/collections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, image }),
    }).then(r => r.json()),

  deleteCollection: (collectionId: number) =>
    fetch(`${BASE}/user/collections`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collectionId }),
    }).then(r => r.json()),

  // Analytics
  getAnalytics: (days?: number | null) => {
    const tz = -new Date().getTimezoneOffset();
    return get<{ stats: any[]; views: any[]; topPosts: any[]; snapshot: any[] }>(
      `/analytics?${days ? `days=${days}` : "days=all"}&tz=${tz}`
    );
  },

  getAudienceAnalytics: (days?: number | null) => {
    const tz = -new Date().getTimezoneOffset();
    return get<any>(`/analytics/audience?${days ? `days=${days}` : "days=all"}&tz=${tz}`);
  },

  getReachAnalytics: (days?: number | null) => {
    const tz = -new Date().getTimezoneOffset();
    return get<any>(`/analytics/reach?${days ? `days=${days}` : "days=all"}&tz=${tz}`);
  },

  getPostAnalytics: (postId: number, days?: number | null) => {
    const tz = -new Date().getTimezoneOffset();
    return get<any>(`/analytics/posts/${postId}?${days ? `days=${days}` : "days=all"}&tz=${tz}`);
  },

  // Admin platform-wide analytics
  getAdminOverview: (days?: number | null) => {
    const tz = -new Date().getTimezoneOffset();
    return get<any>(`/admin/analytics/overview?${days ? `days=${days}` : "days=all"}&tz=${tz}`);
  },
  getAdminEngagement: (days?: number | null) => {
    const tz = -new Date().getTimezoneOffset();
    return get<any>(`/admin/analytics/engagement?${days ? `days=${days}` : "days=all"}&tz=${tz}`);
  },
  getAdminContent: (days?: number | null) => {
    const tz = -new Date().getTimezoneOffset();
    return get<any>(`/admin/analytics/content?${days ? `days=${days}` : "days=all"}&tz=${tz}`);
  },
  getAdminAudience: (days?: number | null) =>
    get<any>(`/admin/analytics/audience?${days ? `days=${days}` : "days=all"}`),
  getAdminPosts: (params: { days?: number | null; search?: string; sort?: string; page?: number }) => {
    const tz = -new Date().getTimezoneOffset();
    const { days, search, sort = "score", page = 1 } = params;
    const q = new URLSearchParams({ sort, page: String(page), tz: String(tz) });
    if (days) q.set("days", String(days)); else q.set("days", "all");
    if (search) q.set("search", search);
    return get<any>(`/admin/analytics/posts?${q}`);
  },
  getAdminPostDetail: (id: number) => {
    const tz = -new Date().getTimezoneOffset();
    return get<any>(`/admin/analytics/posts/${id}?tz=${tz}`);
  },
  getAdminReferrers: (days?: number | null) =>
    get<any>(`/admin/analytics/referrers?days=${days ?? "all"}`),
  getAdminActivity: (params: {
    q?: string;
    eventType?: string;
    userId?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) => {
    const p = new URLSearchParams();
    if (params.q) p.set("q", params.q);
    if (params.eventType) p.set("eventType", params.eventType);
    if (params.userId) p.set("userId", params.userId);
    if (params.from) p.set("from", params.from);
    if (params.to) p.set("to", params.to);
    if (params.page) p.set("page", String(params.page));
    if (params.limit) p.set("limit", String(params.limit));
    return get<any>(`/admin/analytics/activity?${p}`);
  },

  // Settings
  getSettings: (userId?: number) =>
    get<{ account: any[]; language: any[]; user: { name: string; handle: string; title: string; avatar: string } | null }>(`/settings${userId ? `?userId=${userId}` : ""}`),

  // Content topics
  getTopics: () => get<any[]>("/topics"),

  // Profile
  getUserProfile: (handle: string) => get<any>(`/users/${handle}`),

  getUserStats: (userId: number) =>
    get<{ followers: number; following: number; posts: number }>(`/users/stats?userId=${userId}`),

  updateUserProfile: (handle: string, data: any) =>
    fetch(`${BASE}/users/${handle}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(r => {
      if (!r.ok) throw new Error(`Update failed: ${r.status}`);
      return r.json();
    }),

  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", "avatar");
    return fetch(`${BASE}/upload`, {
      method: "POST",
      body: formData,
    }).then(r => r.json());
  },

  updateAvatar: (avatarUrl: string) =>
    fetch(`${BASE}/users/avatar`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatar: avatarUrl }),
    }).then(r => r.json()),

  checkHandle: (handle: string, exclude?: string) =>
    get<{ available: boolean }>(`/users/check-handle?handle=${handle}${exclude ? `&exclude=${exclude}` : ""}`),

  // Follow
  getFollowing: (userId: number) => get<number[]>(`/follow/${userId}`),

  getFollowerList: (userId: number, type: "followers" | "following") =>
    get<any[]>(`/follow/${userId}/list?type=${type}`),

  follow: (followerId: number, followingId: number) =>
    fetch(`${BASE}/follow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ followerId, followingId }),
    }).then(r => r.json()),

  unfollow: (followerId: number, followingId: number) =>
    fetch(`${BASE}/follow?followingId=${followingId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      // Keep body for backward compatibility just in case, but rely on query param
      body: JSON.stringify({ followerId, followingId }),
    }).then(r => r.json()),

  // Domain
  getDomain: (userId: number) =>
    get<{ domain: string; domainStatus: string; domainToken: string | null; showBranding: boolean }>(`/domain?userId=${userId}`),

  updateBranding: (userId: number, showBranding: boolean) =>
    fetch(`${BASE}/domain`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, showBranding }),
    }).then(r => r.json()),

  setDomain: (userId: number, domain: string) =>
    fetch(`${BASE}/domain/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, domain }),
    }).then(r => r.json()),

  verifyDomain: (userId: number) =>
    fetch(`${BASE}/domain/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    }).then(r => r.json()),

  removeDomain: (userId: number) =>
    fetch(`${BASE}/domain`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    }).then(r => r.json()),

  // Upload file to Azure Blob Storage
  // category: "avatar" | "cover" | "posts" | "videos" | "highlights" | "misc"
  uploadFile: (file: File, userId: number, category: string = "posts") => {
    const form = new FormData();
    form.append("file", file);
    form.append("userId", String(userId));
    form.append("category", category);
    return fetch(`${BASE}/upload`, { method: "POST", body: form })
      .then(r => { if (!r.ok) throw new Error(`Upload: ${r.status}`); return r.json() as Promise<{ url: string }>; });
  },

  // Create Post
  createPost: (data: { userId: number; type: string; content?: string; title?: string; description?: string; image?: string; tags?: string[]; status?: string; contentScope?: string }) =>
    fetch(`${BASE}/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(r => { if (!r.ok) throw new Error(`Create post: ${r.status}`); return r.json(); }),

  // Edit Post
  editPost: (postId: number, data: { content?: string; title?: string; image?: string; status?: string }) =>
    fetch(`${BASE}/posts`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, ...data }),
    }).then(r => r.json()),

  // Comments
  getComments: (postId: number) =>
    get<any[]>(`/posts/${postId}/comments`),

  addComment: (postId: number, userId: number, text: string) =>
    fetch(`${BASE}/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, text }),
    }).then(r => r.json()),

  deleteComment: (postId: number, commentId: number) =>
    fetch(`${BASE}/posts/${postId}/comments`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId }),
    }).then(r => r.json()),

  // Delete Post
  deletePost: (postId: number) =>
    fetch(`${BASE}/posts`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    }).then(r => r.json()),

  // Like/Unlike
  // Get liked post IDs for a user
  getLikedPosts: (userId: number) =>
    get<number[]>(`/posts/liked?userId=${userId}`),

  likePost: (postId: number, action: "like" | "unlike", userId?: number) =>
    fetch(`${BASE}/posts/${postId}/like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, userId }),
    }).then(r => r.json()),

  // Notifications
  markNotificationsRead: (ids?: number[], userId?: number) =>
    fetch(`${BASE}/notifications`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids ? { ids, userId } : { action: "mark_all_read", userId }),
    }).then(r => r.json()),

  // Admin
  adminUpdateUser: (userId: number, action: "ban" | "unban" | "promote_circle" | "verify") =>
    fetch(`${BASE}/admin/users`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action }),
    }).then(r => r.json()),

  adminUpdatePost: (postId: number, action: "feature" | "unfeature" | "pin" | "unpin") =>
    fetch(`${BASE}/admin/posts`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, action }),
    }).then(r => r.json()),

  adminDeletePost: (postId: number, reason?: string) =>
    fetch(`${BASE}/admin/posts`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, reason }),
    }).then(r => r.json()),

  // Block
  getBlockedUsers: (userId: number) => get<any[]>(`/block?userId=${userId}`),

  blockUser: (blockerId: number, blockedId: number) =>
    fetch(`${BASE}/block`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockerId, blockedId }),
    }).then(r => r.json()),

  unblockUser: (blockerId: number, blockedId: number) =>
    fetch(`${BASE}/block`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockerId, blockedId }),
    }).then(r => r.json()),

  // Circle feed — X-algorithm ranked circle posts
  getCircleFeed: (mode: "for-you" | "following" | "trending" = "for-you", cursor = 0, limit = 20) =>
    get<{ items: any[]; nextCursor: number; hasMore: boolean; total: number }>(
      `/circle/feed?mode=${mode}&cursor=${cursor}&limit=${limit}`
    ),

  // Explore trending posts — ranked by real engagement (likes + comments×3), no freshness boost
  getExploreTrending: (limit = 6) =>
    get<{ posts: any[] }>(`/explore/trending?limit=${limit}`),

  // X-Algorithm explore — server-side ranked user discovery
  getExploreFeed: (
    tab: "all" | "creators" | "investor" | "entrepreneur" | "ceo" | "other" | "followed" = "all",
    sub: "top" | "latest" | "people" | "companies" = "top",
    cursor = 0,
    limit = 20
  ) =>
    get<{ users: any[]; nextCursor: number; hasMore: boolean; total: number }>(
      `/explore/users?tab=${tab}&sub=${sub}&cursor=${cursor}&limit=${limit}`
    ),

  // X-Algorithm feed (server-side ranked) — all 6 tab modes
  getFeed: (mode: "for-you" | "local" | "trending" | "following" | "news" | "ai" | "technology" = "for-you", cursor: string | number = 0, limit = 20) =>
    get<{ posts: any[]; nextCursor: string | number; hasMore: boolean; total: number }>(
      `/feed?mode=${mode}&cursor=${cursor}&limit=${limit}`
    ),

  // Record post impression — returns { ok, views? } where views is the new count string
  recordImpression: (
    postId: number,
    action: "view" | "dwell" | "scroll_past" = "view",
    userId?: number,
    dwellSeconds?: number,
    position?: number
  ) =>
    fetch(`${BASE}/posts/${postId}/impression`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, userId, dwellSeconds, position }),
    }).then(r => r.json()).catch(() => ({ ok: true })),

  // Negative signal: not interested in a post
  notInterested: (postId: number) =>
    fetch(`${BASE}/posts/${postId}/not-interested`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }).then(r => r.json()),

  // Mute / unmute a user
  getMutedUsers: () => get<any[]>("/user/mute"),

  muteUser: (mutedId: number) =>
    fetch(`${BASE}/user/mute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mutedId }),
    }).then(r => r.json()),

  unmuteUser: (mutedId: number) =>
    fetch(`${BASE}/user/mute`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mutedId }),
    }).then(r => r.json()),

  // Social
  getSocialThreads: (userId: number, platform?: string, sync?: boolean) => {
    const params = new URLSearchParams({ userId: String(userId) });
    if (platform) params.set("platform", platform);
    if (sync) params.set("sync", "true");
    return get<any>(`/social/threads?${params}`);
  },

  getSocialMessages: (threadId: number) => get<any>(`/social/threads/${threadId}/messages`),

  sendSocialMessage: (threadId: number, text: string) => post<any>(`/social/threads/${threadId}/messages`, { text }),

  markSocialThreadRead: (threadId: number) => post<any>(`/social/threads`, { threadId }),
};
