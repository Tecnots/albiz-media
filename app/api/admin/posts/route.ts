import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest) {
  try {
    const { postId, action } = await request.json();
    if (!postId) return NextResponse.json({ error: "Missing postId" }, { status: 400 });

    switch (action) {
      case "feature":
        await prisma.$executeRaw`UPDATE "Post" SET featured = true WHERE id = ${postId}`;
        break;
      case "unfeature":
        await prisma.$executeRaw`UPDATE "Post" SET featured = false WHERE id = ${postId}`;
        break;
      case "pin":
        await prisma.$executeRaw`UPDATE "Post" SET pinned = true WHERE id = ${postId}`;
        break;
      case "unpin":
        await prisma.$executeRaw`UPDATE "Post" SET pinned = false WHERE id = ${postId}`;
        break;
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true, postId, action });
  } catch (err: any) {
    console.error("Admin post update error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { postId } = await request.json();
    if (!postId) return NextResponse.json({ error: "Missing postId" }, { status: 400 });

    // Delete related records first
    await prisma.$executeRaw`DELETE FROM "PostComment" WHERE "postId" = ${postId}`;
    await prisma.$executeRaw`DELETE FROM "ArticleContent" WHERE "postId" = ${postId}`;
    await prisma.$executeRaw`DELETE FROM "SavedPost" WHERE "postId" = ${postId}`;
    await prisma.$executeRaw`DELETE FROM "Post" WHERE id = ${postId}`;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Admin post delete error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
