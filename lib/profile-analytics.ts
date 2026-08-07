import { prisma } from "@/lib/prisma";

// ─── Types ───

export interface ProfileCompletion {
  percentage: number;
  missing: string[];
}

export interface CreatorScore {
  score: number;
  signals: {
    content: number;
    audience: number;
    engagement: number;
    consistency: number;
    profile: number;
  };
}

export interface ContentOverview {
  posts: { count: number; likes: number; comments: number; views: number };
  articles: { count: number; likes: number; comments: number; views: number };
  stories: { count: number; views: number; likes: number };
  shorts: { count: number; views: number; likes: number };
  totalEngagement: number;
}

export interface ActivitySummary {
  last30Days: number;
  streak: number;
  mostActiveDay: string | null;
  joinedDate: string;
}

export interface AudienceInsights {
  followers: number;
  following: number;
  ratio: number;
  recentFollowers: number;
}

export interface ProfileAnalyticsData {
  profileCompletion: ProfileCompletion;
  creatorScore: CreatorScore;
  content: ContentOverview;
  activity: ActivitySummary;
  audience: AudienceInsights;
}

// ─── Profile Completion ───

const COMPLETION_CHECKS: { field: string; label: string; check: (u: any) => boolean }[] = [
  { field: "avatar", label: "Add a profile photo", check: u => !!u.avatar },
  { field: "coverPhoto", label: "Add a cover image", check: u => !!u.coverPhoto },
  { field: "bio", label: "Write a bio", check: u => !!u.bio && u.bio.length > 10 },
  { field: "location", label: "Add your location", check: u => !!u.location },
  { field: "website", label: "Add a website", check: u => !!u.website },
  { field: "name", label: "Set your display name", check: u => !!u.name && u.name !== "User" },
  { field: "skills", label: "Add at least one skill", check: u => u._count?.skills > 0 },
  { field: "interests", label: "Add at least one interest", check: u => u._count?.interests > 0 },
  { field: "education", label: "Add education", check: u => u._count?.education > 0 },
  { field: "experience", label: "Add experience", check: u => u._count?.experience > 0 },
];

function calcProfileCompletion(user: any): ProfileCompletion {
  const missing: string[] = [];
  let completed = 0;
  for (const c of COMPLETION_CHECKS) {
    if (c.check(user)) completed++;
    else missing.push(c.label);
  }
  return { percentage: Math.round((completed / COMPLETION_CHECKS.length) * 100), missing };
}

// ─── Creator Score ───

function logScale(value: number, max: number): number {
  if (value <= 0) return 0;
  return Math.min(100, (Math.log10(value + 1) / Math.log10(max + 1)) * 100);
}

function calcCreatorScore(
  contentCount: number,
  totalEngagement: number,
  followers: number,
  consistencyRatio: number,
  profilePct: number
): CreatorScore {
  const signals = {
    content: Math.round(logScale(contentCount, 500)),
    engagement: Math.round(logScale(totalEngagement, 10000)),
    audience: Math.round(logScale(followers, 10000)),
    consistency: Math.round(Math.min(100, consistencyRatio * 100)),
    profile: profilePct,
  };

  const score = Math.round(
    signals.content * 0.15 +
    signals.engagement * 0.25 +
    signals.audience * 0.25 +
    signals.consistency * 0.15 +
    signals.profile * 0.20
  );

  return { score: Math.min(100, score), signals };
}

// ─── Content Overview ───

async function getContentOverview(userId: number): Promise<ContentOverview> {
  const [postAgg, articleAgg, storyCount, storyViews, storyLikes, shortAgg] = await Promise.all([
    prisma.post.aggregate({
      where: { userId, type: "POST", status: "published" },
      _count: true,
      _sum: { likesCount: true, commentsCount: true, viewsCount: true },
    }),
    prisma.post.aggregate({
      where: { userId, type: "ARTICLE", status: "published" },
      _count: true,
      _sum: { likesCount: true, commentsCount: true, viewsCount: true },
    }),
    prisma.story.count({ where: { userId } }),
    prisma.storyView.count({ where: { story: { userId } } }),
    prisma.storyLike.count({ where: { story: { userId } } }),
    prisma.short.aggregate({
      where: { userId, status: "published" },
      _count: true,
      _sum: { views: true, likes: true },
    }),
  ]);

  const posts = {
    count: postAgg._count,
    likes: postAgg._sum.likesCount ?? 0,
    comments: postAgg._sum.commentsCount ?? 0,
    views: postAgg._sum.viewsCount ?? 0,
  };
  const articles = {
    count: articleAgg._count,
    likes: articleAgg._sum.likesCount ?? 0,
    comments: articleAgg._sum.commentsCount ?? 0,
    views: articleAgg._sum.viewsCount ?? 0,
  };
  const stories = { count: storyCount, views: storyViews, likes: storyLikes };
  const shorts = {
    count: shortAgg._count,
    views: shortAgg._sum.views ?? 0,
    likes: shortAgg._sum.likes ?? 0,
  };

  const totalEngagement =
    posts.likes + posts.comments + articles.likes + articles.comments +
    stories.likes + shorts.likes;

  return { posts, articles, stories, shorts, totalEngagement };
}

// ─── Activity Summary ───

async function getActivitySummary(userId: number, joinDate: Date): Promise<ActivitySummary> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const [recentPosts, recentStories, recentShorts, allDates] = await Promise.all([
    prisma.post.count({ where: { userId, status: "published", createdAt: { gte: thirtyDaysAgo } } }),
    prisma.story.count({ where: { userId, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.short.count({ where: { userId, status: "published", publishedAt: { gte: thirtyDaysAgo } } }),
    // Get all content dates in last 90 days for streak + most active day
    prisma.post.findMany({
      where: { userId, status: "published", createdAt: { gte: ninetyDaysAgo } },
      select: { createdAt: true },
    }),
  ]);

  const [storyDates, shortDates] = await Promise.all([
    prisma.story.findMany({
      where: { userId, createdAt: { gte: ninetyDaysAgo } },
      select: { createdAt: true },
    }),
    prisma.short.findMany({
      where: { userId, status: "published", publishedAt: { gte: ninetyDaysAgo } },
      select: { publishedAt: true },
    }),
  ]);

  // Combine all dates
  const dates = [
    ...allDates.map(p => p.createdAt),
    ...storyDates.map(s => s.createdAt),
    ...shortDates.map(s => s.publishedAt).filter(Boolean) as Date[],
  ];

  // Most active day of week
  const dayCounts = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
  for (const d of dates) dayCounts[d.getDay()]++;
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const maxDay = dayCounts.indexOf(Math.max(...dayCounts));
  const mostActiveDay = dates.length > 0 ? dayNames[maxDay] : null;

  // Weekly streak: consecutive weeks (going back) with at least 1 piece of content
  let streak = 0;
  if (dates.length > 0) {
    const now = new Date();
    const weekSets = new Set<number>();
    for (const d of dates) {
      const weekNum = Math.floor((now.getTime() - d.getTime()) / (7 * 24 * 60 * 60 * 1000));
      weekSets.add(weekNum);
    }
    for (let w = 0; w <= 12; w++) {
      if (weekSets.has(w)) streak++;
      else break;
    }
  }

  return {
    last30Days: recentPosts + recentStories + recentShorts,
    streak,
    mostActiveDay,
    joinedDate: joinDate.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
  };
}

// ─── Audience Insights ───

async function getAudienceInsights(userId: number): Promise<AudienceInsights> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [followers, following, recentFollowers] = await Promise.all([
    prisma.userFollow.count({ where: { followingId: userId } }),
    prisma.userFollow.count({ where: { followerId: userId } }),
    prisma.userFollow.count({ where: { followingId: userId, createdAt: { gte: thirtyDaysAgo } } }),
  ]);

  return {
    followers,
    following,
    ratio: following > 0 ? Math.round((followers / following) * 100) / 100 : followers,
    recentFollowers,
  };
}

// ─── Main Orchestrator ───

export async function getProfileAnalytics(userId: number): Promise<ProfileAnalyticsData | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      avatar: true,
      coverPhoto: true,
      bio: true,
      location: true,
      website: true,
      name: true,
      createdAt: true,
      joinedDate: true,
      _count: {
        select: {
          skills: true,
          interests: true,
          education: true,
          experience: true,
        },
      },
    },
  });

  if (!user) return null;

  const joinDate = user.createdAt || (user.joinedDate ? new Date(user.joinedDate) : new Date());

  const [profileCompletion, content, activity, audience] = await Promise.all([
    Promise.resolve(calcProfileCompletion(user)),
    getContentOverview(userId),
    getActivitySummary(userId, joinDate),
    getAudienceInsights(userId),
  ]);

  const totalContent = content.posts.count + content.articles.count + content.stories.count + content.shorts.count;
  const consistencyDays = activity.last30Days > 0 ? Math.min(activity.last30Days / 30, 1) : 0;

  const creatorScore = calcCreatorScore(
    totalContent,
    content.totalEngagement,
    audience.followers,
    consistencyDays,
    profileCompletion.percentage
  );

  return { profileCompletion, creatorScore, content, activity, audience };
}
