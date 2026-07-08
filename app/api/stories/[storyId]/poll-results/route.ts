import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { normalizeStoryStickers } from "@/app/lib/storySticker";

// GET /api/stories/[storyId]/poll-results?stickerId=... — live vote tallies + the caller's own vote
export async function GET(req: NextRequest, { params }: { params: Promise<{ storyId: string }> }) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();

  try {
    const { storyId } = await params;
    const storyIdNum = Number(storyId);
    if (isNaN(storyIdNum)) return NextResponse.json({ error: "Invalid storyId" }, { status: 400 });
    const stickerId = req.nextUrl.searchParams.get("stickerId");
    if (!stickerId) return NextResponse.json({ error: "Missing stickerId" }, { status: 400 });

    const story = await prisma.story.findUnique({ where: { id: storyIdNum }, select: { stickers: true } });
    if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });

    const elements = normalizeStoryStickers(story.stickers);
    const poll = elements.find((el) => el.id === stickerId && el.type === "poll");
    if (!poll) return NextResponse.json({ error: "Poll not found" }, { status: 404 });

    const optionTexts = poll.data.options ?? [];

    const [grouped, myVote] = await Promise.all([
      prisma.storyPollVote.groupBy({
        by: ["option"],
        where: { storyId: storyIdNum, stickerId },
        _count: true,
      }),
      prisma.storyPollVote.findUnique({
        where: { storyId_stickerId_userId: { storyId: storyIdNum, stickerId, userId: authUser.id } },
        select: { option: true },
      }),
    ]);

    const counts = optionTexts.map((_, i) => grouped.find((g) => g.option === i)?._count ?? 0);
    const total = counts.reduce((a, b) => a + b, 0);

    return NextResponse.json({
      options: optionTexts.map((text, i) => ({ index: i, text, count: counts[i] })),
      total,
      myVote: myVote?.option ?? null,
    });
  } catch (e: any) {
    console.error("GET poll-results error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
