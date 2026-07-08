import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { blobStorageService } from "@/lib/blob-storage";
import { normalizeStoryStickers } from "@/app/lib/storySticker";

// GET /api/stories/[storyId]/insights — get story insights (viewers, likes, shares)
export async function GET(req: NextRequest, { params }: { params: Promise<{ storyId: string }> }) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();
  try {
    const { storyId } = await params;
    const storyIdNum = Number(storyId);
    if (isNaN(storyIdNum)) return NextResponse.json({ error: "Invalid storyId" }, { status: 400 });
    const userId = authUser.id;

    // Get story and verify ownership
    const story = await prisma.story.findUnique({
      where: { id: storyIdNum },
      select: { userId: true, views: true, likes: true, shares: true, stickers: true },
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
      take: 200,
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
      take: 200,
    });

    // Question-sticker responses — only meaningful if the story actually
    // has one. Private by design: only reachable through this
    // author-only-gated endpoint, never surfaced to other viewers.
    const hasQuestionSticker = normalizeStoryStickers(story.stickers).some((el) => el.type === "question");
    const responses = hasQuestionSticker
      ? await prisma.storyQuestionResponse.findMany({
          where: { storyId: storyIdNum },
          include: {
            user: { select: { id: true, name: true, handle: true, avatar: true, verified: true, role: true } },
          },
          orderBy: { respondedAt: "desc" },
        })
      : [];

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
      avatar: blobStorageService.resolveMediaUrl(v.user.avatar),
      viewedAt: formatRelativeTime(v.viewedAt),
    }));

    const formattedLikes = likes.map(l => ({
      ...l.user,
      avatar: blobStorageService.resolveMediaUrl(l.user.avatar),
      likedAt: formatRelativeTime(l.likedAt),
    }));

    const formattedResponses = responses.map(r => ({
      ...r.user,
      avatar: blobStorageService.resolveMediaUrl(r.user.avatar),
      answer: r.answer,
      respondedAt: formatRelativeTime(r.respondedAt),
    }));

    // Exclude story author from viewers
    const viewersExcludingAuthor = formattedViewers.filter(v => v.id !== story.userId);

    // Separate Circle members (followers of story author) from others
    const circleViewers = viewersExcludingAuthor.filter(v => followerIds.has(v.id));
    const otherViewers = viewersExcludingAuthor.filter(v => !followerIds.has(v.id));

    const circleLikes = formattedLikes.filter(l => followerIds.has(l.id));
    const otherLikes = formattedLikes.filter(l => !followerIds.has(l.id));

    const circleResponses = formattedResponses.filter(r => followerIds.has(r.id));
    const otherResponses = formattedResponses.filter(r => !followerIds.has(r.id));

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
      hasQuestionSticker,
      questionResponses: {
        circle: circleResponses,
        other: otherResponses,
      },
    };

    return NextResponse.json(response);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
