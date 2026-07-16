import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeStoryStickers } from "@/app/lib/storySticker";

const MAX_ANSWER_LENGTH = 500;

// POST /api/stories/[storyId]/question-response — submit (or update) a
// private answer to a story's Question sticker. Mirrors poll-vote's
// upsert-on-unique-key pattern: resubmitting is an update, not a duplicate.
export async function POST(req: NextRequest, { params }: { params: Promise<{ storyId: string }> }) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();

  const limit = await rateLimit(`question-response:${authUser.id}`, 60, 60 * 60 * 1000);
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
    const { stickerId, answer } = await req.json();
    if (!stickerId || typeof answer !== "string" || !answer.trim()) {
      return NextResponse.json({ error: "Missing stickerId or answer" }, { status: 400 });
    }
    if (answer.trim().length > MAX_ANSWER_LENGTH) {
      return NextResponse.json({ error: `Answer must be ${MAX_ANSWER_LENGTH} characters or fewer` }, { status: 400 });
    }

    const story = await prisma.story.findUnique({
      where: { id: storyIdNum },
      select: { userId: true, stickers: true, expiresAt: true, imageUrl: true },
    });
    if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
    if (story.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: "Story has expired" }, { status: 410 });
    }

    const elements = normalizeStoryStickers(story.stickers);
    const question = elements.find((el) => el.id === stickerId && el.type === "question");
    if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });

    await prisma.storyQuestionResponse.upsert({
      where: { storyId_stickerId_userId: { storyId: storyIdNum, stickerId, userId: authUser.id } },
      create: { storyId: storyIdNum, stickerId, userId: authUser.id, answer: answer.trim() },
      update: { answer: answer.trim() },
    });

    // Notify the story owner — same Notification table/push pattern as
    // LIKE_STORY (app/api/stories/route.ts), just a distinct type.
    if (story.userId !== authUser.id) {
      try {
        const owner = await prisma.user.findUnique({
          where: { id: story.userId },
          select: { notificationPrefs: true },
        });
        const prefs = owner?.notificationPrefs as any;
        const pushEnabled = prefs?.push?.stories ?? true;
        if (pushEnabled) {
          await prisma.$executeRaw`
            INSERT INTO "Notification" (type, "userId", "recipientId", time, "group", unread, "postPreview", "postImage", "postId")
            VALUES ('STORY_QUESTION_RESPONSE', ${authUser.id}, ${story.userId}, NOW(), 'TODAY', true, '', ${story.imageUrl || ""}, ${storyIdNum})
            ON CONFLICT (type, "userId", "recipientId", "postId") DO NOTHING
          `;
          const responder = await prisma.user.findUnique({ where: { id: authUser.id }, select: { name: true, avatar: true } });
          if (responder) {
            const { sendPushToUser } = await import("@/lib/fcm-send");
            await sendPushToUser(story.userId, {
              title: `${responder.name} answered your question`,
              body: "Tap to view",
              url: `/?story=${story.userId}`,
              icon: responder.avatar || undefined,
              image: story.imageUrl || undefined,
            }).catch((err) => console.error("Push question-response err:", err));
          }
        }
      } catch (err) {
        console.error("question-response notify error:", err);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("POST question-response error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET /api/stories/[storyId]/question-response?stickerId= — the caller's
// own existing answer, if any, so the viewer can prefill it (supports
// "intentionally updating" a prior response instead of only ever blank).
export async function GET(req: NextRequest, { params }: { params: Promise<{ storyId: string }> }) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();

  const { storyId } = await params;
  const stickerId = req.nextUrl.searchParams.get("stickerId");
  if (!stickerId) return NextResponse.json({ error: "Missing stickerId" }, { status: 400 });

  const response = await prisma.storyQuestionResponse.findUnique({
    where: { storyId_stickerId_userId: { storyId: Number(storyId), stickerId, userId: authUser.id } },
    select: { answer: true },
  });

  return NextResponse.json({ answer: response?.answer ?? null });
}
