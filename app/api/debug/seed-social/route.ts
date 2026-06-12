import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveSocialMessage } from "@/lib/social-sync";

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const userId = Number(request.nextUrl.searchParams.get("userId") || 1);

  try {
    // 1. Create/Ensure a connection
    const conn = await prisma.socialConnection.upsert({
      where: { userId_platform: { userId, platform: "twitter" } },
      create: {
        userId,
        platform: "twitter",
        platformUserId: "demo_user_123",
        platformHandle: "@albiz_demo",
        accessToken: "demo_token",
        active: true,
      },
      update: { active: true }
    });

    // 2. Add some mock threads and messages
    const demoThreads = [
      { id: "tw_user_1", handle: "@elonmusk", text: "When is the next Albiz update?" },
      { id: "tw_user_2", handle: "@jack", text: "Nice work on the omnichannel inbox!" },
      { id: "tw_user_3", handle: "@nasa", text: "We need Albiz on Mars." },
    ];

    for (const t of demoThreads) {
      await saveSocialMessage(
        "twitter",
        conn.id,
        `msg_${t.id}_${Date.now()}`,
        t.id,
        t.handle,
        `https://ui-avatars.com/api/?name=${t.handle.substring(1)}&background=random`,
        t.text,
        "inbound"
      );
    }

    return NextResponse.json({ success: true, message: "Demo data seeded. Please refresh your inbox." });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
