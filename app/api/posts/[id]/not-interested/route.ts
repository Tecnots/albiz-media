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

  try {
    // Write PostEngagement signal
    await prisma.$executeRaw`
      INSERT INTO "PostEngagement" ("userId", "postId", action, "createdAt")
      VALUES (${userId}, ${postId}, 'not_interested', NOW())
    `;

    // Also write PostImpression so the post is filtered out from future feeds
    await prisma.$executeRaw`
      INSERT INTO "PostImpression" ("userId", "postId", "seenAt")
      VALUES (${userId}, ${postId}, NOW())
      ON CONFLICT ("userId", "postId") DO NOTHING
    `;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[not-interested]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
