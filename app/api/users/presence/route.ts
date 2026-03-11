import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { userId, publicKey } = await req.json();
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  try {
    const data: Record<string, unknown> = { lastSeenAt: new Date() };
    if (publicKey) data.publicKey = publicKey;

    await prisma.user.update({
      where: { id: userId },
      data,
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Presence error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
