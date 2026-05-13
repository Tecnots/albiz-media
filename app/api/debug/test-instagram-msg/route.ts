import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveSocialMessage } from "@/lib/social-sync";

// Simulate an Instagram DM arriving via webhook
export async function GET() {
  try {
    const conn = await prisma.socialConnection.findFirst({
      where: { platform: "instagram", active: true }
    });
    if (!conn) return NextResponse.json({ error: "No instagram connection found" }, { status: 404 });

    await saveSocialMessage(
      "instagram",
      conn.id,
      "test_msg_" + Date.now(),
      "real_test_sender_001",
      "@testuser",
      null,
      "Hello! This is a real test Instagram message.",
      "inbound"
    );

    return NextResponse.json({ success: true, message: "Test Instagram message saved to connection " + conn.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
