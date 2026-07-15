import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { blobStorageService } from "@/lib/blob-storage";

const PAGE_SIZE = 50;

// GET /api/conversations/[id]/messages?before=<messageId>&limit=<n>
// Cursor pagination for older history. The conversation poll only ships the
// newest page; this loads progressively older messages without disturbing it.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();

  const { id } = await params;
  const conversationId = Number(id);
  if (isNaN(conversationId)) {
    return NextResponse.json({ error: "Invalid conversation ID" }, { status: 400 });
  }

  // Only the owner of this conversation view may read its messages.
  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, participantId: authUser.id },
    select: { id: true },
  });
  if (!conv) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const before = Number(req.nextUrl.searchParams.get("before")) || 0;
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || PAGE_SIZE, PAGE_SIZE);

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      ...(before ? { id: { lt: before } } : {}),
    },
    orderBy: { id: "desc" },
    take: limit,
  });

  const hasMore = messages.length >= limit;

  // Resolve media URLs, then restore ascending order for prepend.
  for (const msg of messages) {
    if (msg.attachmentUrl) {
      msg.attachmentUrl = blobStorageService.resolveMediaUrl(msg.attachmentUrl) ?? msg.attachmentUrl;
    }
  }
  messages.reverse();

  return NextResponse.json({ messages, hasMore });
}
