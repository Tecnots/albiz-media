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
  getSettings: () => get<{ account: any[]; language: any[] }>("/settings"),

  // Content topics
  getTopics: () => get<any[]>("/topics"),
};
