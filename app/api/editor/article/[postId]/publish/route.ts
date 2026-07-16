import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { transitionPostState } from "@/lib/editor-workflow";
import { notifyAuthorOfPublish } from "@/lib/workflow-notifications";

export async function POST(
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
  if (isNaN(postId)) {
    return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
  }

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, sectionId: true, userId: true, status: true, title: true, assignedEditorId: true, type: true, user: { select: { email: true, name: true } } },
    });
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    // Section/canPublish is only required of EDITOR callers — ADMIN is a
    // superuser here, matching the schedule/unschedule routes. Previously
    // this block ran unconditionally, so an ADMIN with no personal
    // EditorSectionAssignment row for the section was blocked from using
    // this route at all (audit finding M-8).
    let canPublish = user.role === "ADMIN";
    if (user.role === "EDITOR") {
      if (!post.sectionId) {
        return NextResponse.json({ error: "Article has no section" }, { status: 400 });
      }
      const assignment = await prisma.editorSectionAssignment.findUnique({
        where: { editorId_sectionId: { editorId: user.id, sectionId: post.sectionId } },
      });
      if (!assignment) {
        return NextResponse.json({ error: "You are not assigned to this section" }, { status: 403 });
      }
      if (!assignment.canPublish) {
        return NextResponse.json({ error: "You do not have publish permission for this section" }, { status: 403 });
      }
      canPublish = true;
    }

    try {
      await transitionPostState(
        postId,
        user.id,
        user.role,
        post.status,
        "published",
        post.assignedEditorId,
        canPublish,
        user.canPost || false,
        "publish",
        post.type
      );
    } catch (err: any) {
      console.error("[editor/article/publish] state transition failed:", err?.message);
      const isConflict = typeof err?.message === "string" && err.message.startsWith("CONFLICT");
      return NextResponse.json(
        { error: isConflict ? err.message : "Unable to publish this article. Please verify the article status and try again." },
        { status: isConflict ? 409 : 403 }
      );
    }


    await notifyAuthorOfPublish(post.id, user.id, post).catch((e) =>
      console.error("[editor/article/publish] author notification failed:", e)
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[editor/article/publish POST]", err);
    return NextResponse.json({ error: "Failed to publish" }, { status: 500 });
  }
}
