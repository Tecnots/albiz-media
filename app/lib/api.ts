// Centralized API fetch module — all Supabase data flows through here

const BASE = "/api";

async function get<T>(path: string): Promise<T> {
  console.log(`API GET: ${BASE}${path}`);
  const res = await fetch(`${BASE}${path}`);
  console.log(`API Response status: ${res.status} for ${path}`);
  if (!res.ok) {
    console.error(`API Error: ${path} returned ${res.status}`);
    throw new Error(`API ${path}: ${res.status}`);
  }
  const data = await res.json();
  console.log(`API Response data for ${path}:`, data);
  return data;
}

export const api = {
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

  createStory: (userId: number, imageUrl: string, opts?: { textOverlay?: string; textColor?: string; textPosX?: number; textPosY?: number; textScale?: number; location?: string; locPosX?: number; locPosY?: number; imgPosX?: number; imgPosY?: number; imgScale?: number; imgFit?: string; visibility?: string; status?: string }) =>
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
  getCircleMembers: () => get<any[]>("/circle/members"),
  getCirclePosts: () => get<any[]>("/circle/posts"),

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

  // Saved Data
  getSaved: () => get<{ success: boolean; collections: any[]; posts: any[]; totalSaved: number }>("/user/saved"),

  // Save/Unsave operations
  savePost: (postId: number, collectionId?: number) => {
    console.log(`API POST: ${BASE}/user/saved`, { postId, collectionId });
    return fetch(`${BASE}/user/saved`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, collectionId }),
    }).then(r => {
      console.log(`API POST response status: ${r.status}`);
      return r.json().then(data => {
        console.log(`API POST response data:`, data);
        return data;
      });
    });
  },

  unsavePost: (postId: number) => {
    console.log(`API DELETE: ${BASE}/user/saved`, { postId });
    return fetch(`${BASE}/user/saved`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    }).then(r => {
      console.log(`API DELETE response status: ${r.status}`);
      return r.json().then(data => {
        console.log(`API DELETE response data:`, data);
        return data;
      });
    });
  },

  // Debug
  checkDatabaseTables: () => get<{ success: boolean; tables: any[]; savedPostTable: any[]; userCollectionTable: any[] }>("/debug/tables"),

  // Collections
  getCollections: () => get<{ success: boolean; collections: any[] }>("/user/collections"),
  createCollection: (name: string, image?: string) => {
    console.log(`API POST: ${BASE}/user/collections`, { name, image });
    return fetch(`${BASE}/user/collections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, image }),
    }).then(r => {
      console.log(`API POST collections response status: ${r.status}`);
      return r.json();
    });
  },
  deleteCollection: (collectionId: number) => {
    console.log(`API DELETE: ${BASE}/user/collections`, { collectionId });
    return fetch(`${BASE}/user/collections`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collectionId }),
    }).then(r => {
      console.log(`API DELETE collections response status: ${r.status}`);
      return r.json();
    });
  },

  // Analytics
  getAnalytics: (startDate?: string | null) => get<{ stats: any[]; views: any[]; topPosts: any[]; snapshot: any[] }>(`/analytics${startDate ? `?startDate=${startDate}` : ""}`),

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
    fetch(`${BASE}/follow`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ followerId, followingId }),
    }).then(r => r.json()),

  // Domain
  getDomain: (userId: number) =>
    get<{ domain: string; verified: boolean; showBranding: boolean }>(`/domain?userId=${userId}`),

  updateBranding: (userId: number, showBranding: boolean) =>
    fetch(`${BASE}/domain`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, showBranding }),
    }).then(r => r.json()),

  setDomain: (userId: number, domain: string) =>
    fetch(`${BASE}/domain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, domain }),
    }).then(r => r.json()),

  verifyDomain: (userId: number) =>
    fetch(`${BASE}/domain`, {
      method: "PUT",
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
  createPost: (data: { userId: number; type: string; content?: string; title?: string; description?: string; image?: string; tags?: string[]; status?: string }) =>
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

  adminDeletePost: (postId: number) =>
    fetch(`${BASE}/admin/posts`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
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
};
