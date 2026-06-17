import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";

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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const postId = parseInt(id);
  if (isNaN(postId)) return NextResponse.json({ ok: true });

  const body = await req.json().catch(() => ({}));
  const action: string        = body.action    ?? "view";
  const dwellSeconds: number  = parseFloat(body.dwellSeconds ?? "0") || 0;
  const position: number | null = body.position ? parseInt(body.position) : null;

  // Fast path: userId from body avoids session fetch roundtrip
  let userId: number | null = body.userId ? parseInt(body.userId) : null;
  if (!userId || isNaN(userId)) {
    const authUser = await getAuthUser(req);
    if (!authUser) return NextResponse.json({ ok: true });
    userId = authUser.id;
  }

  const ua = req.headers.get("user-agent") || "";
  const device = /Mobile|Android|iPhone/i.test(ua) ? "Mobile"
    : /Tablet|iPad/i.test(ua) ? "Tablet"
    : "Desktop";

  try {
    let newViews: string | null = null;

    if (action === "view") {
      // Only "view" creates a PostImpression and increments Post.views
      const inserted = await prisma.$queryRaw<{ id: number }[]>`
        INSERT INTO "PostImpression" ("userId", "postId", "seenAt", position, device)
        VALUES (${userId}, ${postId}, NOW(), ${position}, ${device})
        ON CONFLICT ("userId", "postId") DO NOTHING
        RETURNING id
      `;

      if (inserted.length > 0) {
        // Genuinely new view — increment Post.views
        const postRows = await prisma.$queryRaw<{ views: string }[]>`
          SELECT views FROM "Post" WHERE id = ${postId} LIMIT 1
        `;
        if (postRows.length > 0) {
          const current = parseStat(postRows[0].views ?? "0");
          newViews = formatStat(current + 1);
          await prisma.$executeRaw`UPDATE "Post" SET views = ${newViews} WHERE id = ${postId}`;
        }
      }
    }

    // Engagement signals — write to PostEngagement only (no impression, no view count)
    if (action === "dwell" && dwellSeconds > 0) {
      await prisma.$executeRaw`
        INSERT INTO "PostEngagement" ("userId", "postId", action, value, "createdAt")
        VALUES (${userId}, ${postId}, 'dwell', ${dwellSeconds}, NOW())
      `;
    }

    if (action === "scroll_past") {
      await prisma.$executeRaw`
        INSERT INTO "PostEngagement" ("userId", "postId", action, value, "createdAt")
        VALUES (${userId}, ${postId}, 'scroll_past', 1.0, NOW())
      `;
    }

    if (action === "follow_author") {
      await prisma.$executeRaw`
        INSERT INTO "PostEngagement" ("userId", "postId", action, value, "createdAt")
        VALUES (${userId}, ${postId}, 'follow_author', 1.0, NOW())
      `;
    }

    return NextResponse.json({ ok: true, views: newViews });
  } catch (err: any) {
    console.error("Impression error:", err?.message);
    return NextResponse.json({ ok: true });
  }
}
