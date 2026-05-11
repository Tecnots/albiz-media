import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getValidAccessToken } from "@/lib/social-auth";
import { saveSocialMessage } from "@/lib/social-sync";

// GET /api/social/threads/[id]/messages
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const messages = await prisma.socialMessage.findMany({
      where: { threadId: Number(id) },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ messages });
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

    const { connection, externalUserId, platform } = thread;
    const accessToken = await getValidAccessToken(connection.id);

    if (!accessToken) return NextResponse.json({ error: "Failed to get access token" }, { status: 401 });

    let externalId = `sent_${Date.now()}`;

    // Platform specific sending
    if (platform === "twitter") {
      const url = `https://api.twitter.com/2/dm_conversations/with/${externalUserId}/messages`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("[social/send/twitter] error:", errText);
        return NextResponse.json({ error: "Failed to send to Twitter", detail: errText }, { status: res.status });
      }

      const data = await res.json();
      externalId = data.data?.dm_event_id || externalId;
    } else {
      // Fallback or other platforms (Instagram/Messenger/WhatsApp)
      // Implementation for other platforms would go here
      return NextResponse.json({ error: `Replying to ${platform} is not implemented yet` }, { status: 501 });
    }

    // Save to DB
    await saveSocialMessage(
      platform,
      connection.id,
      externalId,
      externalUserId,
      null,
      null,
      text,
      "outbound"
    );

    return NextResponse.json({ ok: true, externalId });
  } catch (err: unknown) {
    console.error("[social/send] fatal error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
