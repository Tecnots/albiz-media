import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

// GET /api/stories/[storyId]/insights — get story insights (viewers, likes, shares)
export async function GET(req: NextRequest, { params }: { params: Promise<{ storyId: string }> }) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();
  try {
    const { storyId } = await params;
    const storyIdNum = Number(storyId);
    const userId = authUser.id;

    // Get story and verify ownership
    const story = await prisma.story.findUnique({
      where: { id: storyIdNum },
      select: { userId: true, views: true, likes: true, shares: true },
    });

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    if (story.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get followers of the story author (circle members via following)
    const followers = await prisma.userFollow.findMany({
      where: { followingId: story.userId },
      select: { followerId: true },
    });
    const followerIds = new Set(followers.map(f => f.followerId));

    // Get viewers with user details
    const viewers = await prisma.storyView.findMany({
      where: { storyId: storyIdNum },
      include: {
        user: {
          select: { id: true, name: true, handle: true, avatar: true, verified: true, role: true },
        },
      },
      orderBy: { viewedAt: "desc" },
    });

    // Get likes with user details
    const likes = await prisma.storyLike.findMany({
      where: { storyId: storyIdNum },
      include: {
        user: {
          select: { id: true, name: true, handle: true, avatar: true, verified: true, role: true },
        },
      },
      orderBy: { likedAt: "desc" },
    });

    // Format viewers with relative time
    const formatRelativeTime = (date: Date) => {
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSecs < 60) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${diffDays}d ago`;
    };

    const formattedViewers = viewers.map(v => ({
      ...v.user,
      viewedAt: formatRelativeTime(v.viewedAt),
    }));

    const formattedLikes = likes.map(l => ({
      ...l.user,
      likedAt: formatRelativeTime(l.likedAt),
    }));

    // Exclude story author from viewers
    const viewersExcludingAuthor = formattedViewers.filter(v => v.id !== story.userId);

    // Separate Circle members (followers of story author) from others
    const circleViewers = viewersExcludingAuthor.filter(v => followerIds.has(v.id));
    const otherViewers = viewersExcludingAuthor.filter(v => !followerIds.has(v.id));

    const circleLikes = formattedLikes.filter(l => followerIds.has(l.id));
    const otherLikes = formattedLikes.filter(l => !followerIds.has(l.id));

    const response = {
      stats: {
        views: story.views,
        likes: story.likes,
        shares: story.shares,
      },
      viewers: {
        circle: circleViewers,
        other: otherViewers,
      },
      likes: {
        circle: circleLikes,
        other: otherLikes,
      },
    };

    console.log("Insights response:", response);

    return NextResponse.json(response);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
