import { prisma } from "@/lib/prisma";

// ─── Types ───

export interface SocialStats {
  followers: number;
  following: number;
  posts: number;
  articles: number;
  stories: number;
  shorts: number;
}

export interface Badge {
  id: string;
  label: string;
  color: string;
}

export interface Milestone {
  id: string;
  title: string;
  date: string;
  description: string;
}

export interface MutualConnection {
  id: number;
  name: string;
  handle: string;
  avatar: string | null;
  title: string | null;
  mutualCount: number;
}

export interface ProfileSocialData {
  stats: SocialStats;
  badges: Badge[];
  milestones: Milestone[];
  mutualConnections: MutualConnection[];
  joinedDate: string | null;
}

// ─── Stats ───

async function getStats(userId: number): Promise<SocialStats> {
  const [followers, following, posts, articles, stories, shorts] = await Promise.all([
    prisma.userFollow.count({ where: { followingId: userId } }),
    prisma.userFollow.count({ where: { followerId: userId } }),
    prisma.post.count({ where: { userId, type: "POST", status: "published" } }),
    prisma.post.count({ where: { userId, type: "ARTICLE", status: "published" } }),
    prisma.story.count({ where: { userId } }),
    prisma.short.count({ where: { userId, status: "published" } }),
  ]);
  return { followers, following, posts, articles, stories, shorts };
}

// ─── Badges ───

function getBadges(user: {
  role: string;
  verified: boolean;
  isPremium: boolean;
}): Badge[] {
  const badges: Badge[] = [];

  if (user.role === "ADMIN") badges.push({ id: "admin", label: "Admin", color: "#DC2626" });
  if (user.role === "EDITOR") badges.push({ id: "editor", label: "Editor", color: "#7C3AED" });
  if (user.role === "AUTHOR") badges.push({ id: "author", label: "Author", color: "#2563EB" });
  if (user.role === "UPLOADER") badges.push({ id: "uploader", label: "Shorts Creator", color: "#0891B2" });
  if (user.role === "CIRCLE") badges.push({ id: "circle", label: "Circle Member", color: "#F44444" });
  if (user.verified) badges.push({ id: "verified", label: "Verified", color: "#059669" });
  if (user.isPremium) badges.push({ id: "premium", label: "Premium", color: "#D97706" });

  return badges;
}

// ─── Milestones ───

async function getMilestones(userId: number, user: { createdAt: Date | null; joinedDate: string | null }): Promise<Milestone[]> {
  const milestones: Milestone[] = [];
  const joinDate = user.createdAt || (user.joinedDate ? new Date(user.joinedDate) : null);

  if (joinDate && !isNaN(joinDate.getTime())) {
    milestones.push({
      id: "joined",
      title: "Joined AlbizMedia",
      date: formatDate(joinDate),
      description: "Started the journey on the platform.",
    });
  }

  // First post, first article, first story, first short
  const [firstPost, firstArticle, firstStory, firstShort] = await Promise.all([
    prisma.post.findFirst({ where: { userId, type: "POST", status: "published" }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    prisma.post.findFirst({ where: { userId, type: "ARTICLE", status: "published" }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    prisma.story.findFirst({ where: { userId }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    prisma.short.findFirst({ where: { userId, status: "published" }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ]);

  if (firstPost?.createdAt) {
    milestones.push({ id: "first-post", title: "Published first post", date: formatDate(firstPost.createdAt), description: "Shared the first thought with the community." });
  }
  if (firstArticle?.createdAt) {
    milestones.push({ id: "first-article", title: "Published first article", date: formatDate(firstArticle.createdAt), description: "Became a published author on the platform." });
  }
  if (firstStory?.createdAt) {
    milestones.push({ id: "first-story", title: "Shared first story", date: formatDate(firstStory.createdAt), description: "Created the first ephemeral story." });
  }
  if (firstShort?.createdAt) {
    milestones.push({ id: "first-short", title: "Uploaded first short", date: formatDate(firstShort.createdAt), description: "Started creating short-form video content." });
  }

  // Follower milestones
  const followerCount = await prisma.userFollow.count({ where: { followingId: userId } });
  const thresholds = [10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000];
  for (const t of thresholds) {
    if (followerCount >= t) {
      // Find the approximate date when this threshold was reached
      const nthFollower = await prisma.userFollow.findFirst({
        where: { followingId: userId },
        orderBy: { createdAt: "asc" },
        skip: t - 1,
        select: { createdAt: true },
      });
      if (nthFollower?.createdAt) {
        milestones.push({
          id: `followers-${t}`,
          title: `Reached ${formatCount(t)} followers`,
          date: formatDate(nthFollower.createdAt),
          description: `A growing community of ${formatCount(t)} people.`,
        });
      }
    }
  }

  // Sort by date descending (most recent first)
  milestones.sort((a, b) => {
    const da = parseDate(a.date);
    const db = parseDate(b.date);
    if (!da || !db) return 0;
    return db.getTime() - da.getTime();
  });

  return milestones;
}

// ─── Mutual Connections ───

async function getMutualConnections(userId: number, viewerId: number | null): Promise<MutualConnection[]> {
  if (!viewerId || viewerId === userId) return [];

  // Find users that both the viewer and the profile owner follow
  const mutuals = await prisma.$queryRaw<Array<{ id: number; name: string; handle: string; avatar: string | null; title: string | null }>>`
    SELECT u."id", u."name", u."handle", u."avatar", u."title"
    FROM "User" u
    WHERE u."id" IN (
      SELECT f1."followingId"
      FROM "UserFollow" f1
      INNER JOIN "UserFollow" f2 ON f1."followingId" = f2."followingId"
      WHERE f1."followerId" = ${viewerId} AND f2."followerId" = ${userId}
    )
    AND u."id" != ${viewerId} AND u."id" != ${userId}
    LIMIT 6
  `;

  return mutuals.map(u => ({
    id: u.id,
    name: u.name,
    handle: u.handle,
    avatar: u.avatar,
    title: u.title,
    mutualCount: 0, // Will be computed below if needed
  }));
}

// ─── Main fetch function ───

export async function getProfileSocialData(userId: number, viewerId: number | null): Promise<ProfileSocialData> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      verified: true,
      isPremium: true,
      createdAt: true,
      joinedDate: true,
    },
  });

  if (!user) {
    return {
      stats: { followers: 0, following: 0, posts: 0, articles: 0, stories: 0, shorts: 0 },
      badges: [],
      milestones: [],
      mutualConnections: [],
      joinedDate: null,
    };
  }

  const [stats, milestones, mutualConnections] = await Promise.all([
    getStats(userId),
    getMilestones(userId, user),
    getMutualConnections(userId, viewerId),
  ]);

  return {
    stats,
    badges: getBadges(user),
    milestones,
    mutualConnections,
    joinedDate: user.joinedDate || (user.createdAt ? formatDate(user.createdAt) : null),
  };
}

// ─── Helpers ───

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function formatCount(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

function parseDate(dateStr: string): Date | null {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}
