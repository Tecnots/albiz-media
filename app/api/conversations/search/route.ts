import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { blobStorageService } from "@/lib/blob-storage";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 50;
const MESSAGE_PAGE_SIZE = 50;

// GET /api/conversations/search?q=&limit= — efficient, read-only conversation
// search. Matches the participant's name/handle, the last-message preview, and
// (crucially) message BODY text across a thread's full history — all in the
// database with a LIMIT, so it never requires loading every conversation.
// Results are merged into the client's live state and stay synchronized by the
// normal poll thereafter.
export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();

  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  if (!q) return NextResponse.json({ conversations: [], serverTime: new Date().toISOString() });

  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit")) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  const conversations = await prisma.conversation.findMany({
    where: {
      participantId: authUser.id,
      OR: [
        { user: { name: { contains: q, mode: "insensitive" } } },
        { user: { handle: { contains: q, mode: "insensitive" } } },
        { lastMessage: { contains: q, mode: "insensitive" } },
        { messages: { some: { deleted: false, encrypted: false, text: { contains: q, mode: "insensitive" } } } },
      ],
    },
    include: {
      messages: { orderBy: { id: "desc" }, take: MESSAGE_PAGE_SIZE },
      user: {
        select: {
          id: true, name: true, handle: true, avatar: true,
          lastSeenAt: true, role: true, verified: true, title: true,
        },
      },
    },
    orderBy: { id: "desc" },
    take: limit,
  });

  for (const conv of conversations) {
    (conv as Record<string, unknown>).hasMoreMessages = conv.messages.length >= MESSAGE_PAGE_SIZE;
    conv.messages.reverse();
    if (conv.user) {
      conv.user.avatar = blobStorageService.resolveMediaUrl(conv.user.avatar) ?? conv.user.avatar;
    }
    for (const msg of conv.messages) {
      if (msg.attachmentUrl) {
        msg.attachmentUrl = blobStorageService.resolveMediaUrl(msg.attachmentUrl) ?? msg.attachmentUrl;
      }
    }
  }

  return NextResponse.json({ conversations, serverTime: new Date().toISOString() });
}
