// Centralized API fetch module — all Supabase data flows through here

const BASE = "/api";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
  return res.json();
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).then(r => r.json()),

  // Users
  getUsers: () => get<any[]>("/users"),

  // Posts
  getPosts: () => get<any[]>("/posts"),

  // Trending
  getTrending: () => get<any[]>("/trending"),

  // Circle
  getCircleMembers: () => get<any[]>("/circle/members"),
  getCirclePosts: () => get<any[]>("/circle/posts"),

  // Notifications
  getNotifications: () => get<any[]>("/notifications"),

  // Conversations
  getConversations: () => get<any[]>("/conversations"),

  // Saved
  getSaved: () => get<{ collections: any[]; posts: any[] }>("/saved"),

  // Analytics
  getAnalytics: () => get<{ stats: any[]; views: any[]; topPosts: any[]; snapshot: any[] }>("/analytics"),

  // Settings
  getSettings: (userId?: number) =>
    get<{ account: any[]; language: any[]; user: { name: string; handle: string; title: string; avatar: string } | null }>(`/settings${userId ? `?userId=${userId}` : ""}`),

  // Content topics
  getTopics: () => get<any[]>("/topics"),

  // Profile
  getUserProfile: (handle: string) => get<any>(`/users/${handle}`),

  updateUserProfile: (handle: string, data: any) =>
    fetch(`${BASE}/users/${handle}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(r => {
      if (!r.ok) throw new Error(`Update failed: ${r.status}`);
      return r.json();
    }),

  checkHandle: (handle: string, exclude?: string) =>
    get<{ available: boolean }>(`/users/check-handle?handle=${handle}${exclude ? `&exclude=${exclude}` : ""}`),

  // Follow
  getFollowing: (userId: number) => get<number[]>(`/follow/${userId}`),

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
};
