import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { blobStorageService } from "@/lib/blob-storage";
import { messagePreview } from "@/lib/message-preview";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

// GET /api/messages/saved?skip=&limit= — the authenticated user's bookmarked
// chat messages, newest-saved first, with sender + conversation context.
// Deleted messages are excluded so cleared/removed content drops out cleanly.
export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();

  const skip = Math.max(Number(req.nextUrl.searchParams.get("skip")) || 0, 0);
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit")) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  const rows = await prisma.message.findMany({
    where: { savedByUser: authUser.id, deleted: false },
    orderBy: [{ savedAt: "desc" }, { id: "desc" }],
    skip,
    take: limit + 1,
    include: {
      sender: { select: { id: true, name: true, avatar: true, verified: true } },
      conversation: {
        select: {
          id: true,
          userId: true,
          user: { select: { id: true, name: true, handle: true, avatar: true, verified: true } },
        },
      },
    },
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const messages = page.map((m) => {
    const other = m.conversation?.user ?? null;
    return {
      id: m.id,
      conversationId: m.conversationId,
      preview: messagePreview({
        text: m.text,
        encrypted: m.encrypted,
        attachmentType: m.attachmentType,
        attachmentName: m.attachmentName,
        attachmentUrl: m.attachmentUrl,
      }),
      encrypted: m.encrypted,
      edited: m.edited,
      fromMe: m.fromMe,
      time: m.time,
      createdAt: m.createdAt,
      savedAt: m.savedAt,
      attachmentType: m.attachmentType,
      attachmentName: m.attachmentName,
      attachmentUrl: m.attachmentUrl ? (blobStorageService.resolveMediaUrl(m.attachmentUrl) ?? m.attachmentUrl) : null,
      sender: m.sender
        ? { id: m.sender.id, name: m.sender.name, avatar: blobStorageService.resolveMediaUrl(m.sender.avatar) ?? m.sender.avatar, verified: m.sender.verified }
        : null,
      otherUser: other
        ? { id: other.id, name: other.name, handle: other.handle, avatar: blobStorageService.resolveMediaUrl(other.avatar) ?? other.avatar, verified: other.verified }
        : null,
    };
  });

  return NextResponse.json({ messages, hasMore });
}
