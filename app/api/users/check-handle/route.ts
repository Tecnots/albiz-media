import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const handle = searchParams.get("handle");
  const exclude = searchParams.get("exclude");

  if (!handle || handle.length < 3 || !/^[a-zA-Z0-9_]+$/.test(handle)) {
    return NextResponse.json({ available: false, reason: "invalid" });
  }

  const existing = await prisma.user.findUnique({ where: { handle: handle.toLowerCase() } });
  const taken = existing && existing.handle !== exclude;

  return NextResponse.json({ available: !taken });
}
