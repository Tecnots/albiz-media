import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parseStat(s: string): number {
  if (!s) return 0;
  const c = s.replace(/,/g, "").trim().toLowerCase();
  if (c.endsWith("m")) return Math.round(parseFloat(c) * 1_000_000);
  if (c.endsWith("k")) return Math.round(parseFloat(c) * 1_000);
  return parseInt(c) || 0;
}

function formatStat(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(Math.max(0, n));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const postId = Number(id);
    if (!postId) return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });

    // Try to get userId from request body (optional — shares can be anonymous)
    let userId: number | null = null;
    try {
      const body = await request.json();
      if (body?.userId) userId = Number(body.userId);
    } catch {}

    const rows = await prisma.$queryRaw<{ shares: string }[]>`
      SELECT shares FROM "Post" WHERE id = ${postId} LIMIT 1
    `;
    if (!rows.length) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    // Increment the denormalised share count on Post
    const newCount = parseStat(rows[0].shares) + 1;
    const formatted = formatStat(newCount);
    await prisma.$executeRaw`UPDATE "Post" SET shares = ${formatted} WHERE id = ${postId}`;

    // Record a timestamped share event for analytics
    await prisma.postShareEvent.create({
      data: { postId, userId },
    });

    return NextResponse.json({ shares: formatted });
  } catch (err: any) {
    console.error("[share]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
