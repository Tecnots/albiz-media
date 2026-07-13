import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  const likeLimit = await rateLimit(`short-like:${authUser.id}`, 60, 60 * 1000);
  if (!likeLimit.allowed) {
    return NextResponse.json(likeLimit.error, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((likeLimit.resetAt - Date.now()) / 1000)) },
    });
  }

  try {
    const { id } = await params;
    const shortId = Number(id);
    if (!shortId) return NextResponse.json({ error: "Invalid short ID" }, { status: 400 });

    const { action } = await request.json();
    const userId = authUser.id;
    if (action !== "like" && action !== "unlike") {
      return NextResponse.json({ error: "Action must be 'like' or 'unlike'" }, { status: 400 });
    }

    const rows = await prisma.$queryRaw<any[]>`SELECT id FROM "Short" WHERE id = ${shortId} LIMIT 1`;
    if (!rows.length) return NextResponse.json({ error: "Short not found" }, { status: 404 });

    let diff = 0;
    if (action === "like") {
      const affected = await prisma.$executeRaw`
        INSERT INTO "ShortLike" ("shortId", "userId") VALUES (${shortId}, ${userId})
        ON CONFLICT ("shortId", "userId") DO NOTHING
      `;
      if (affected > 0) {
        diff = 1;
        // Fire-and-forget engagement signal for the recommendation engine (mirrors watch route).
        prisma.$executeRaw`
          INSERT INTO "ShortWatchEvent" ("shortId", "userId", "action", "createdAt")
          VALUES (${shortId}, ${userId}, 'like', NOW())
        `.catch(() => {});
      }
    } else {
      const affected = await prisma.$executeRaw`DELETE FROM "ShortLike" WHERE "shortId" = ${shortId} AND "userId" = ${userId}`;
      if (affected > 0) diff = -1;
    }

    const countRows = await prisma.$queryRaw<any[]>`SELECT COUNT(*)::int as count FROM "ShortLike" WHERE "shortId" = ${shortId}`;
    const realCount = countRows[0]?.count || 0;

    if (diff !== 0) {
      await prisma.$executeRaw`UPDATE "Short" SET likes = ${realCount} WHERE id = ${shortId}`;
    }

    return NextResponse.json({ likes: realCount, liked: action === "like" });
  } catch (err) {
    console.error("[shorts/like]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
