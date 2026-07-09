import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { isAssignedEditor } from "@/app/lib/auth-guards";

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
        assignedEditorId: true,
        tags: true,
        language: true,
        createdAt: true,
        date: true,
        publishAt: true,
        scheduleJobId: true,
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

    // Verify editor covers this section. A section-mate editor (not the
    // specific assignedEditorId) may view the article to understand section
    // context, but a sectionless article has no section-level check to fall
    // back on — it previously skipped authorization entirely in that case
    // and let any editor view it (audit finding L-2), so it now requires the
    // caller to be the specifically assigned editor instead.
    let canPublish = user.role === "ADMIN";
    if (user.role === "EDITOR") {
      if (post.sectionId) {
        const assignment = await prisma.editorSectionAssignment.findUnique({
          where: { editorId_sectionId: { editorId: user.id, sectionId: post.sectionId } },
        });
        if (!assignment) {
          return NextResponse.json({ error: "Not assigned to this section" }, { status: 403 });
        }
        canPublish = assignment.canPublish;
      } else if (post.assignedEditorId !== user.id) {
        return NextResponse.json({ error: "Not assigned to this article" }, { status: 403 });
      }
    }

    // editorNotes carry internal reviewer-to-reviewer commentary — only the
    // specifically assigned editor (or an admin) should see them. Previously
    // every section-mate editor received the full notes thread for any
    // article in a shared section, not just the ones assigned to them
    // (audit finding H-1).
    const { editorNotes, ...rest } = post;
    const canSeeNotes = isAssignedEditor(user, post);

    return NextResponse.json({ article: { ...rest, editorNotes: canSeeNotes ? editorNotes : [], canPublish } });
  } catch (err) {
    console.error("[editor/article GET]", err);
    return NextResponse.json({ error: "Failed to load article" }, { status: 500 });
  }
}
