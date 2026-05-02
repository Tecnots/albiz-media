// Albiz Feed Ranking Algorithm
// Instagram-style multiplicative scoring: engagement × timeDecay × velocity × relationship × contentType × authority

// --- Helpers ---

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

// --- Scoring Functions ---

function engagementScore(stats: { views: string; likes: string; comments: string; shares: string }): number {
  const raw =
    parseMetric(stats.views) * 0.1 +
    parseMetric(stats.likes) * 1.0 +
    parseMetric(stats.comments) * 3.0 +
    parseMetric(stats.shares) * 2.0;
  return Math.log10(Math.max(raw, 1)) + 1;
}

function timeDecay(postDate: Date, newestDate: Date): number {
  const hoursAfterNewest = (newestDate.getTime() - postDate.getTime()) / (1000 * 60 * 60);
  const halfLife = 72; // 3 days
  const decay = Math.pow(0.5, Math.max(hoursAfterNewest, 0) / halfLife);
  // Freshness boost: posts less than 6 hours old get a significant boost so they appear at top
  if (hoursAfterNewest < 6) return decay * (3.0 - hoursAfterNewest * 0.33);
  return decay;
}

function velocity(stats: { views: string; likes: string; comments: string; shares: string }, postDate: Date, newestDate: Date): number {
  const hoursAge = Math.max((newestDate.getTime() - postDate.getTime()) / (1000 * 60 * 60), 1);
  const total = parseMetric(stats.likes) + parseMetric(stats.comments) + parseMetric(stats.shares);
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
  if (following.has(postUserId)) m *= 2.5; // Boosted from 1.8 to ensure they appear first as requested
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
  const followers = parseMetric(author.followers || "0");
  let a = 1.0 + Math.min(0.4, Math.log10(Math.max(followers, 1)) * 0.05);
  if (author.isPremium) a *= 1.05;
  return a;
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

function interestMultiplier(post: AlgorithmPost, selectedTags?: Set<string>): number {
  if (!selectedTags || selectedTags.size === 0) return 1.0;
  if (!post.tags || post.tags.length === 0) return 1.0;
  
  const hasMatch = post.tags.some(tag => selectedTags.has(tag));
  return hasMatch ? 1.5 : 1.0;
}

// --- Main Entry ---

export function rankPosts(
  posts: AlgorithmPost[],
  users: AlgorithmUser[],
  following: Set<number>,
  currentUserId: number,
  options: { mode: "for-you" | "trending"; selectedTags?: Set<string> } = { mode: "for-you" }
): AlgorithmPost[] {
  if (posts.length === 0) return [];

  const userMap = new Map(users.map(u => [u.id, u]));
  const dates = posts.map(p => parsePostDate(p.date));
  const newestDate = new Date(Math.max(...dates.map(d => d.getTime())));

  const scored = posts.map((post, i) => {
    const postDate = dates[i];
    const eng = engagementScore(post.stats);
    const decay = timeDecay(postDate, newestDate);
    const vel = velocity(post.stats, postDate, newestDate);
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
  return scored.map(s => s.post);
}
