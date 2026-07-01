import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

export async function POST(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();

  const { userId, publicKey } = await req.json();
  if (!userId || authUser.id !== userId) {
    return NextResponse.json({ error: "Missing or invalid userId" }, { status: 400 });
  }

  try {
    const data: Record<string, unknown> = { lastSeenAt: new Date() };
    if (publicKey) data.publicKey = publicKey;

    await prisma.user.update({
      where: { id: authUser.id },
      data,
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Presence error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
