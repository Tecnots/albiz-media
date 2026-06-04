import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();

  const { id } = await params;
  const postId = parseInt(id);
  if (isNaN(postId)) return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });

  const userId = authUser.id;
  const body   = await req.json().catch(() => ({}));
  const action = body.action === "unlike" ? "unlike" : "like";

  try {
    if (action === "like") {
      await prisma.$executeRaw`
        INSERT INTO "CirclePostLike" ("postId", "userId", "createdAt")
        VALUES (${postId}, ${userId}, NOW())
        ON CONFLICT ("postId", "userId") DO NOTHING
      `;
    } else {
      await prisma.$executeRaw`
        DELETE FROM "CirclePostLike" WHERE "postId" = ${postId} AND "userId" = ${userId}
      `;
    }

    const countRows = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count FROM "CirclePostLike" WHERE "postId" = ${postId}
    `;
    const count = Number(countRows[0]?.count ?? 0);

    return NextResponse.json({ success: true, likes: String(count), liked: action === "like" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
