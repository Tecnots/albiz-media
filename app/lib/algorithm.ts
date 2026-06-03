// Albiz Feed Ranking Algorithm — X-algorithm architecture
// Two-pool sourcing → pre-scoring filters → multi-signal scoring → diversity adjustment
// Re-exports legacy rankPosts for pages that still call it client-side.

// --- Helpers (kept for backward compat) ---

export function parseMetric(value: string): number {
  if (!value) return 0;
  const cleaned = value.trim().toLowerCase();
  const mMatch = cleaned.match(/^([\d.]+)\s*m$/);
  if (mMatch) return parseFloat(mMatch[1]) * 1_000_000;
  const kMatch = cleaned.match(/^([\d.]+)\s*k$/);
  if (kMatch) return parseFloat(kMatch[1]) * 1_000;
  return parseFloat(cleaned.replace(/,/g, "")) || 0;
}

export function parsePostDate(dateStr: string): Date {
  const cleaned = dateStr.replace(/(\d+)(st|nd|rd|th)/, "$1");
  const parsed = new Date(cleaned);
  return isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

// --- Types ---

export interface AlgorithmPost {
  id: number;
  userId: number;
  type: string;
  date: string;
  image?: string | null;
  tags?: string[];
  stats: { views: string; likes: string; comments: string; shares: string };
  createdAt?: Date | string;
  [key: string]: unknown;
}

export interface AlgorithmUser {
  id: number;
  verified?: boolean;
  isPremium?: boolean;
  role?: string;
  followers?: string;
  [key: string]: unknown;
}

// --- X-style action weights (client-side version, mirrors algorithm/signals.ts) ---

const ACTION_WEIGHTS: Record<string, number> = {
  like:           1.0,
  comment:        3.0,
  share:          2.0,
  dwell:          0.15,
  profile_click:  0.5,
  follow_author:  5.0,
  not_interested: -3.0,
  mute_author:    -8.0,
};

// --- Scoring helpers ---

function parseStat(s: string): number {
  return parseMetric(s);
}

function globalEngagementSignals(post: AlgorithmPost): Record<string, number> {
  const likes    = parseStat(post.stats.likes);
  const comments = parseStat(post.stats.comments);
  const shares   = parseStat(post.stats.shares);
  const views    = Math.max(parseStat(post.stats.views), 1);
  return {
    like:    likes    / views,
    comment: comments / views,
    share:   shares   / views,
    dwell:   0,
    follow_author: 0,
    profile_click: 0,
    not_interested: 0,
    mute_author: 0,
  };
}

function xEngagementScore(post: AlgorithmPost): number {
  const signals = globalEngagementSignals(post);
  let score = 0;
  for (const [action, weight] of Object.entries(ACTION_WEIGHTS)) {
    score += weight * (signals[action] ?? 0);
  }
  return Math.log10(Math.max(score + 1, 1)) + 1;
}

function resolveDate(post: AlgorithmPost): Date {
  if (post.createdAt) return new Date(post.createdAt as string);
  return parsePostDate(post.date);
}

function timeDecay(postDate: Date, newestDate: Date): number {
  const hoursAfterNewest = (newestDate.getTime() - postDate.getTime()) / 3_600_000;
  const halfLife = 72;
  const decay = Math.pow(0.5, Math.max(hoursAfterNewest, 0) / halfLife);
  if (hoursAfterNewest < 6) return decay * (3.0 - hoursAfterNewest * 0.33);
  return decay;
}

function velocity(post: AlgorithmPost, postDate: Date, newestDate: Date): number {
  const hoursAge = Math.max((newestDate.getTime() - postDate.getTime()) / 3_600_000, 1);
  const total = parseStat(post.stats.likes) + parseStat(post.stats.comments) + parseStat(post.stats.shares);
  const v = total / hoursAge;
  return 1.0 + Math.min(0.5, Math.log10(Math.max(v, 1)) * 0.1);
}

function relationshipMultiplier(
  postUserId: number,
  currentUserId: number,
  following: Set<number>,
  userMap: Map<number, AlgorithmUser>
): number {
  if (postUserId === currentUserId) return 1.3;
  let m = 1.0;
  if (following.has(postUserId)) m *= 2.5;
  const author = userMap.get(postUserId);
  if (author) {
    if (author.role === "CIRCLE") m *= 1.2;
    if (author.role === "AUTHOR") m *= 1.15;
    if (author.verified) m *= 1.1;
  }
  return m;
}

function contentTypeMultiplier(post: AlgorithmPost): number {
  let m = 1.0;
  if (post.type === "article") m *= 1.15;
  if (post.image) m *= 1.1;
  return m;
}

function authorAuthority(userMap: Map<number, AlgorithmUser>, userId: number): number {
  const author = userMap.get(userId);
  if (!author) return 1.0;
  const followers = parseStat(author.followers || "0");
  let a = 1.0 + Math.min(0.4, Math.log10(Math.max(followers, 1)) * 0.05);
  if (author.isPremium) a *= 1.05;
  return a;
}

function interestMultiplier(post: AlgorithmPost, selectedTags?: Set<string>): number {
  if (!selectedTags || selectedTags.size === 0) return 1.0;
  if (!post.tags || post.tags.length === 0) return 1.0;
  const hasMatch = post.tags.some(tag => selectedTags.has(tag));
  return hasMatch ? 1.5 : 1.0;
}

// Diversity: cap posts per author in top 10
function applyDiversity(scored: { post: AlgorithmPost; score: number }[]): { post: AlgorithmPost; score: number }[] {
  const authorCounts = new Map<number, number>();
  const result: typeof scored = [];
  const deferred: typeof scored = [];

  for (const sp of scored) {
    const count = authorCounts.get(sp.post.userId) ?? 0;
    if (result.length < 10 && count >= 2) {
      deferred.push(sp);
      continue;
    }
    authorCounts.set(sp.post.userId, count + 1);
    result.push(sp);
  }

  return [...result, ...deferred];
}

// --- Main Entry (client-side, backward-compat) ---

export function rankPosts(
  posts: AlgorithmPost[],
  users: AlgorithmUser[],
  following: Set<number>,
  currentUserId: number,
  options: { mode: "for-you" | "trending"; selectedTags?: Set<string> } = { mode: "for-you" }
): AlgorithmPost[] {
  if (posts.length === 0) return [];

  const userMap = new Map(users.map(u => [u.id, u]));
  const dates = posts.map(p => resolveDate(p));
  const newestDate = new Date(Math.max(...dates.map(d => d.getTime())));

  const scored = posts.map((post, i) => {
    const postDate = dates[i];
    const eng = xEngagementScore(post);
    const decay = timeDecay(postDate, newestDate);
    const vel = velocity(post, postDate, newestDate);
    const content = contentTypeMultiplier(post);
    const interest = interestMultiplier(post, options.selectedTags);

    let score: number;
    if (options.mode === "trending") {
      score = eng * vel * decay * content * interest;
    } else {
      const rel = relationshipMultiplier(post.userId, currentUserId, following, userMap);
      const auth = authorAuthority(userMap, post.userId);
      score = eng * decay * vel * rel * content * auth * interest;
    }

    return { post, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const diverse = applyDiversity(scored);
  return diverse.map(s => s.post);
}
