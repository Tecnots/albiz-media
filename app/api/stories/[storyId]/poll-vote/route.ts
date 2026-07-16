import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeStoryStickers } from "@/app/lib/storySticker";

// POST /api/stories/[storyId]/poll-vote — vote (or change a vote) on a story poll sticker
export async function POST(req: NextRequest, { params }: { params: Promise<{ storyId: string }> }) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();

  const limit = await rateLimit(`poll-vote:${authUser.id}`, 60, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(limit.error, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) },
    });
  }

  try {
    const { storyId } = await params;
    const storyIdNum = Number(storyId);
    if (isNaN(storyIdNum)) return NextResponse.json({ error: "Invalid storyId" }, { status: 400 });
    const { stickerId, option } = await req.json();
    if (!stickerId || typeof option !== "number") {
      return NextResponse.json({ error: "Missing stickerId or option" }, { status: 400 });
    }

    const story = await prisma.story.findUnique({
      where: { id: storyIdNum },
      select: { userId: true, stickers: true, expiresAt: true },
    });
    if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
    if (story.userId === authUser.id) {
      return NextResponse.json({ error: "Cannot vote on own story" }, { status: 403 });
    }
    if (story.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: "Story has expired" }, { status: 410 });
    }

    const elements = normalizeStoryStickers(story.stickers);
    const poll = elements.find((el) => el.id === stickerId && el.type === "poll");
    if (!poll) return NextResponse.json({ error: "Poll not found" }, { status: 404 });

    const options = poll.data.options ?? [];
    if (option < 0 || option >= options.length) {
      return NextResponse.json({ error: "Invalid option" }, { status: 400 });
    }

    await prisma.storyPollVote.upsert({
      where: { storyId_stickerId_userId: { storyId: storyIdNum, stickerId, userId: authUser.id } },
      create: { storyId: storyIdNum, stickerId, userId: authUser.id, option },
      update: { option },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("POST poll-vote error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
