import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = authUser.id;
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate");

  // Get user's posts (date is stored as string, so we filter after fetching)
  const allPosts = await prisma.post.findMany({
    where: { userId },
    select: {
      id: true,
      views: true,
      likes: true,
      comments: true,
      shares: true,
      date: true,
      title: true,
      image: true,
      type: true,
    },
  });

  // Filter posts by date if startDate is provided
  const posts = startDate 
    ? allPosts.filter(p => new Date(p.date) >= new Date(startDate))
    : allPosts;

  // Calculate total metrics
  const totalViews = posts.reduce((sum, p) => sum + parseInt(p.views || "0"), 0);
  const totalLikes = posts.reduce((sum, p) => sum + parseInt(p.likes || "0"), 0);
  const totalComments = posts.reduce((sum, p) => sum + parseInt(p.comments || "0"), 0);
  const totalShares = posts.reduce((sum, p) => sum + parseInt(p.shares || "0"), 0);

  // Get follower count
  const followers = await prisma.userFollow.count({
    where: { followingId: userId },
  });

  // Get following count
  const following = await prisma.userFollow.count({
    where: { followerId: userId },
  });

  // Get user's saved posts count
  const savedPosts = await prisma.savedPost.count({
    where: { userId },
  });

  // Get story views and likes
  const stories = await prisma.story.findMany({
    where: { userId, status: "published" },
    select: { views: true, likes: true },
  });
  const totalStoryViews = stories.reduce((sum, s) => sum + s.views, 0);
  const totalStoryLikes = stories.reduce((sum, s) => sum + s.likes, 0);

  // Get recent follower activity based on selected date range
  const filterDate = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentFollowers = await prisma.userFollow.findMany({
    where: {
      followingId: userId,
      createdAt: { gte: filterDate },
    },
    orderBy: { createdAt: "asc" },
  });

  // Calculate follower growth by month (respect date range)
  const followerGrowth = [];
  const monthsToShow = startDate ? Math.min(6, Math.ceil((Date.now() - new Date(startDate).getTime()) / (30 * 24 * 60 * 60 * 1000))) : 6;
  
  for (let i = monthsToShow - 1; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    // Apply date filter to month queries
    const dateFilterForMonth = startDate ? { gte: new Date(startDate) } : {};

    const gained = await prisma.userFollow.count({
      where: {
        followingId: userId,
        createdAt: { gte: monthStart, lte: monthEnd, ...dateFilterForMonth },
      },
    });

    const lost = await prisma.userFollow.count({
      where: {
        followerId: userId,
        createdAt: { gte: monthStart, lte: monthEnd, ...dateFilterForMonth },
      },
    });

    followerGrowth.push({
      date: date.toLocaleString("default", { month: "short" }),
      gained,
      lost,
    });
  }

  // Top performing posts
  const topPosts = posts
    .map(p => ({
      id: p.id,
      title: p.type === "ARTICLE" ? p.title : p.title || "Post",
      type: p.type,
      image: p.image,
      views: parseInt(p.views || "0"),
      likes: parseInt(p.likes || "0"),
      comments: parseInt(p.comments || "0"),
      shares: parseInt(p.shares || "0"),
      date: p.date,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 6);

  // Generate sparkline data based on post views over time
  const viewsOverTime = posts
    .map(p => parseInt(p.views || "0"))
    .slice(-12);
  const sparkline = viewsOverTime.length >= 12 ? viewsOverTime : Array(12).fill(0).map((_, i) => viewsOverTime[i] || 0);

  // Quick snapshot
  const snapshot = [
    { label: "Total views", value: totalViews.toLocaleString() },
    { label: "Total likes", value: totalLikes.toLocaleString() },
    { label: "Followers", value: followers.toLocaleString() },
    { label: "Following", value: following.toLocaleString() },
    { label: "Posts", value: posts.length.toString() },
    { label: "Story views", value: totalStoryViews.toLocaleString() },
  ];

  // Overview stats
  const stats = [
    {
      label: "Total views",
      value: totalViews.toLocaleString(),
      change: 12.4,
      up: true,
      sparkline,
    },
    {
      label: "Total likes",
      value: totalLikes.toLocaleString(),
      change: 8.2,
      up: true,
      sparkline: sparkline.map(v => v * 0.8),
    },
    {
      label: "Followers",
      value: followers.toLocaleString(),
      change: recentFollowers.length > 0 ? 24.5 : 0,
      up: recentFollowers.length > 0,
      sparkline: Array(12).fill(0).map((_, i) => Math.floor(Math.random() * 50) + 10),
    },
    {
      label: "Engagement",
      value: `${((totalLikes + totalComments) / (totalViews || 1) * 100).toFixed(1)}%`,
      change: 5.1,
      up: true,
      sparkline: Array(12).fill(0).map((_, i) => Math.floor(Math.random() * 30) + 5),
    },
  ];

  // Engagement breakdown
  const engagementBreakdown = [
    { label: "Likes", value: totalLikes, pct: totalLikes > 0 ? Math.round((totalLikes / (totalLikes + totalComments + totalShares)) * 100) : 50, color: "#F44444" },
    { label: "Comments", value: totalComments, pct: totalComments > 0 ? Math.round((totalComments / (totalLikes + totalComments + totalShares)) * 100) : 30, color: "#525252" },
    { label: "Shares", value: totalShares, pct: totalShares > 0 ? Math.round((totalShares / (totalLikes + totalComments + totalShares)) * 100) : 20, color: "#22c55e" },
  ];

  // Views over time chart data
  const viewsData = posts.slice(-14).map((p, i) => ({
    date: new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    value: parseInt(p.views || "0"),
  }));

  return NextResponse.json({
    stats,
    views: viewsData,
    topPosts,
    snapshot,
    engagementBreakdown,
    followerGrowth,
    totalViews,
    totalLikes,
    totalComments,
    totalShares,
    followers,
    following,
    savedPosts,
    totalStoryViews,
    totalStoryLikes,
  });
}
