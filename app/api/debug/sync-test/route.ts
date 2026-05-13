import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveSocialMessage } from "@/lib/social-sync";

export async function GET(request: NextRequest) {
  const userIdStr = request.nextUrl.searchParams.get("userId") || "1";
  const userId = Number(userIdStr);

  console.log(`[debug/sync-test] Starting for userId ${userId}`);

  try {
    const conn = await prisma.socialConnection.findFirst({
      where: { userId, platform: "twitter", active: true }
    });

    if (!conn) {
      return NextResponse.json({ 
        error: "No active Twitter connection found for this user. Please connect Twitter first.",
        searchedUserId: userId
      }, { status: 404 });
    }

    console.log(`[debug/sync-test] Found connection ${conn.id}. Saving mock message...`);

    const externalUserId = "test_user_999";
    const externalId = `debug_msg_${Date.now()}`;
    
    await saveSocialMessage(
      "twitter",
      conn.id,
      externalId,
      externalUserId,
      "@albiz_test",
      null,
      "This is a debug test message to verify the database flow.",
      "inbound"
    );

    const thread = await prisma.socialThread.findFirst({
      where: { connectionId: conn.id, externalUserId }
    });

    return NextResponse.json({ 
      success: true, 
      message: "Diagnostic message saved successfully.",
      connectionId: conn.id,
      threadId: thread?.id,
      externalUserId
    });

  } catch (err: any) {
    console.error("[debug/sync-test] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
