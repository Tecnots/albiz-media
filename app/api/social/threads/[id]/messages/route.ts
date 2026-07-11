import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveSocialMessage, sendToSocialPlatform } from "@/lib/social-sync";
import { blobStorageService } from "@/lib/blob-storage";

// GET /api/social/threads/[id]/messages
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const messages = await (prisma.socialMessage as any).findMany({
      where: { threadId: Number(id) },
      orderBy: { createdAt: "asc" },
    });
    // attachmentUrl is stored as a bare blob name — resolve to a fresh, fetchable URL
    const resolved = messages.map((m: any) => ({
      ...m,
      attachmentUrl: blobStorageService.resolveMediaUrl(m.attachmentUrl),
    }));
    return NextResponse.json({ messages: resolved });
  } catch (err: unknown) {
    return NextResponse.json(
      { messages: [], error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}

// POST /api/social/threads/[id]/messages
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { text } = await request.json();
    if (!text) return NextResponse.json({ error: "Message text is required" }, { status: 400 });

    const thread = await prisma.socialThread.findUnique({
      where: { id: Number(id) },
      include: { connection: true },
    });

    if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

    const { connection, externalUserId } = thread;
    const platform = thread.platform ?? connection.platform;

    const result = await sendToSocialPlatform(connection, externalUserId, text);

    // Save outbound message to DB regardless of send result. A retryable
    // failure is flagged so the background sweep (lib/workers/social-sync-worker.ts)
    // picks it up and attempts delivery again later without the user having to resend.
    await saveSocialMessage(
      platform,
      connection.id,
      result.externalId,
      externalUserId,
      null,
      null,
      text,
      "outbound",
      new Date(),
      null,
      null,
      !result.sent && result.retryable
    );

    if (!result.sent) {
      console.warn(`[social/send/${platform}] connection ${connection.id} send failed but message saved locally (retryable=${result.retryable}): ${result.error}`);
      return NextResponse.json({ ok: false, externalId: result.externalId, warning: result.error });
    }

    return NextResponse.json({ ok: true, externalId: result.externalId });
  } catch (err: unknown) {
    console.error("[social/send] fatal error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
