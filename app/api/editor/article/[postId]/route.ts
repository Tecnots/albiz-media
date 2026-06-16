import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "EDITOR" && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { postId: postIdStr } = await params;
  const postId = parseInt(postIdStr);
  if (isNaN(postId)) return NextResponse.json({ error: "Invalid post id" }, { status: 400 });

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        title: true,
        description: true,
        image: true,
        status: true,
        sectionId: true,
        tags: true,
        language: true,
        createdAt: true,
        date: true,
        user: { select: { id: true, name: true, avatar: true, handle: true, title: true } },
        section: { select: { id: true, name: true, color: true } },
        articleContent: { select: { paragraphs: true } },
        editorNotes: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            note: true,
            type: true,
            priority: true,
            resolvedAt: true,
            resolvedBy: true,
            createdAt: true,
            editor: { select: { id: true, name: true, avatar: true } },
          },
        },
      },
    });

    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Verify editor covers this section
    if (user.role === "EDITOR" && post.sectionId) {
      const assignment = await prisma.editorSectionAssignment.findUnique({
        where: { editorId_sectionId: { editorId: user.id, sectionId: post.sectionId } },
      });
      if (!assignment) {
        return NextResponse.json({ error: "Not assigned to this section" }, { status: 403 });
      }
      const canPublish = assignment.canPublish;
      return NextResponse.json({ article: { ...post, canPublish } });
    }

    return NextResponse.json({ article: { ...post, canPublish: false } });
  } catch (err) {
    console.error("[editor/article GET]", err);
    return NextResponse.json({ error: "Failed to load article" }, { status: 500 });
  }
}
