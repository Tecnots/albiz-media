import { NextResponse } from "next/server";
import { prisma, Prisma } from "@/lib/prisma";
import { blobStorageService } from "@/lib/blob-storage";
import { transitionPostState } from "@/lib/editor-workflow";
import { getAuthUser } from "@/app/lib/auth";
import { logActivity } from "@/lib/activity-logger";
import { randomUUID } from "crypto";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authUser = await getAuthUser(request as any);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (authUser.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const featured = searchParams.get("featured") === "true";
    const flagged = searchParams.get("flagged") === "true";
    const search = searchParams.get("search");

    const where: any = {};
    if (type && type !== "All") {
      where.type = type.toUpperCase() === "ARTICLES" || type.toUpperCase() === "ARTICLE" ? "ARTICLE" : "POST";
    }
    if (status && status !== "all") where.status = status;
    if (featured) where.featured = true;
    if (flagged) where.flagged = true;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { handle: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const page = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10) || 0);
    const pageSize = 50;

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, handle: true, avatar: true, role: true }
          },
          assignedEditor: {
            select: { id: true, name: true, handle: true, avatar: true }
          },
          section: {
            select: { id: true, name: true, color: true }
          },
          articleContent: {
            select: { paragraphs: true }
          },
        },
        orderBy: { id: 'desc' },
        take: pageSize,
        skip: page * pageSize,
      }),
      prisma.post.count({ where }),
    ]);

    const formattedPosts = posts.map((post: any) => {
      const html = post.articleContent?.paragraphs?.[0] ?? post.content ?? "";
      const wordCount = html ? html.replace(/<[^>]*>/g, " ").trim().split(/\s+/).filter(Boolean).length : 0;
      return {
        id: post.id,
        userId: post.userId,
        userName: post.user.name,
        userHandle: post.user.handle,
        avatar: blobStorageService.resolveMediaUrl(post.user.avatar),
        type: post.type,
        title: post.title,
        description: post.description,
        content: post.content,
        date: post.date,
        createdAt: post.createdAt,
        publishAt: post.publishAt,
        image: blobStorageService.resolveMediaUrl(post.image),
        tags: post.tags,
        views: post.views,
        likes: post.likes,
        comments: post.comments,
        status: post.status,
        featured: post.featured,
        pinned: post.pinned,
        flagged: post.flagged,
        flagReason: post.flagReason,
        sectionId: post.sectionId,
        section: post.section ?? null,
        assignedEditorId: post.assignedEditorId,
        assignedEditor: post.assignedEditor
          ? { ...post.assignedEditor, avatar: blobStorageService.resolveMediaUrl(post.assignedEditor.avatar) }
          : null,
        wordCount,
      };
    });

    return NextResponse.json({ posts: formattedPosts, total, page, pageSize });
  } catch (error) {
    console.error("Admin Posts GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const authUser = await getAuthUser(request as any);
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { postId, action } = body;

    if (!postId) {
      return NextResponse.json({ error: "Post ID is required" }, { status: 400 });
    }

    // Publish approved articles — handled separately since it needs no field update
    if (action === "publish") {
      if (authUser.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const postToPublish = await prisma.post.findUnique({
        where: { id: Number(postId) },
        select: { status: true, assignedEditorId: true },
      });
      if (!postToPublish) return NextResponse.json({ error: "Post not found" }, { status: 404 });
      if (postToPublish.status !== "approved") {
        return NextResponse.json({ error: "Only approved articles can be published" }, { status: 400 });
      }
      await transitionPostState(
        Number(postId), authUser.id, authUser.role,
        "approved", "published",
        postToPublish.assignedEditorId,
        true, true, "publish"
      );
      return NextResponse.json({ success: true, status: "published" });
    }

    if (action === "schedule") {
      if (authUser.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const { publishAt } = body as { publishAt?: string };
      if (!publishAt) return NextResponse.json({ error: "publishAt is required" }, { status: 400 });
      const publishDate = new Date(publishAt);
      if (isNaN(publishDate.getTime()) || publishDate <= new Date()) {
        return NextResponse.json({ error: "publishAt must be a valid future date" }, { status: 400 });
      }

      const postToSchedule = await prisma.post.findUnique({
        where: { id: Number(postId) },
        select: { status: true, scheduleJobId: true, userId: true, title: true },
      });
      if (!postToSchedule) return NextResponse.json({ error: "Post not found" }, { status: 404 });

      const jobId = randomUUID();
      const prevJobId = postToSchedule.scheduleJobId;

      try {
        await prisma.$transaction(async (tx: any) => {
          const locked = await tx.$queryRaw(
            Prisma.sql`SELECT status FROM "Post" WHERE id = ${Number(postId)} FOR UPDATE`
          ) as { status: string }[];
          if (!locked.length) throw new Error("NOT_FOUND");
          if (locked[0].status !== "approved") throw new Error("NOT_APPROVED");

          await tx.job.create({
            data: {
              id: jobId,
              type: "publish-scheduled-article",
              payload: { postId: Number(postId), scheduleJobId: jobId } as Prisma.InputJsonValue,
              maxAttempts: 3,
              priority: 10,
              scheduledAt: publishDate,
            },
          });

          await tx.$executeRaw`
            UPDATE "Post"
            SET status = 'scheduled', "publishAt" = ${publishDate}, "scheduleJobId" = ${jobId}
            WHERE id = ${Number(postId)}
          `;
        });
      } catch (err: any) {
        if (err.message === "NOT_FOUND") return NextResponse.json({ error: "Post not found" }, { status: 404 });
        if (err.message === "NOT_APPROVED") return NextResponse.json({ error: "Article is no longer eligible for scheduling" }, { status: 409 });
        console.error("[admin schedule] Transaction failed:", err);
        return NextResponse.json({ error: "Failed to schedule article" }, { status: 500 });
      }

      if (prevJobId) {
        prisma.job.update({
          where: { id: prevJobId },
          data: { status: "dead", lastError: "Superseded by new schedule" },
        }).catch(() => { });
      }

      await logActivity({
        eventType: "ARTICLE_SCHEDULED",
        userId: authUser.id,
        meta: JSON.stringify({ postId: Number(postId), publishAt: publishDate.toISOString(), jobId }),
      });
      return NextResponse.json({ success: true, status: "scheduled", jobId, publishAt: publishDate.toISOString() });
    }

    if (action === "unschedule") {
      if (authUser.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const postToUnschedule = await prisma.post.findUnique({
        where: { id: Number(postId) },
        select: { scheduleJobId: true },
      });
      if (!postToUnschedule) return NextResponse.json({ error: "Post not found" }, { status: 404 });

      const updated = await prisma.$executeRaw`
        UPDATE "Post"
        SET status = 'approved', "publishAt" = NULL, "scheduleJobId" = NULL
        WHERE id = ${Number(postId)}
          AND status = 'scheduled'
      `;

      if (updated === 0) {
        return NextResponse.json(
          { error: "Article is no longer scheduled — it may have already been published" },
          { status: 409 }
        );
      }

      if (postToUnschedule.scheduleJobId) {
        prisma.job.update({
          where: { id: postToUnschedule.scheduleJobId },
          data: { status: "dead", lastError: "Cancelled by admin" },
        }).catch(() => { });
      }

      await logActivity({
        eventType: "ARTICLE_UNSCHEDULED",
        userId: authUser.id,
        meta: JSON.stringify({ postId: Number(postId), cancelledJobId: postToUnschedule.scheduleJobId }),
      });
      return NextResponse.json({ success: true, status: "approved" });
    }

    if (action === "reassign") {
      if (authUser.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const { editorId } = body;
      const postToReassign = await prisma.post.findUnique({
        where: { id: Number(postId) },
        select: { sectionId: true },
      });
      if (!postToReassign) return NextResponse.json({ error: "Post not found" }, { status: 404 });

      if (editorId !== null && editorId !== undefined) {
        const targetEditor = await prisma.user.findUnique({
          where: { id: Number(editorId) },
          select: { banned: true, role: true },
        });
        if (!targetEditor) return NextResponse.json({ error: "Editor not found" }, { status: 404 });
        if (targetEditor.banned) return NextResponse.json({ error: "Cannot assign to a banned editor" }, { status: 400 });
        if (targetEditor.role !== "EDITOR" && targetEditor.role !== "ADMIN") {
          return NextResponse.json({ error: "User is not an editor" }, { status: 400 });
        }
        if (postToReassign.sectionId) {
          const sectionAssignment = await prisma.editorSectionAssignment.findUnique({
            where: { editorId_sectionId: { editorId: Number(editorId), sectionId: postToReassign.sectionId } },
          });
          if (!sectionAssignment) {
            return NextResponse.json({ error: "This editor is not assigned to the article's section" }, { status: 400 });
          }
        }
        await prisma.$executeRaw`UPDATE "Post" SET "assignedEditorId" = ${Number(editorId)} WHERE id = ${Number(postId)}`;
      } else {
        await prisma.$executeRaw`UPDATE "Post" SET "assignedEditorId" = NULL WHERE id = ${Number(postId)}`;
      }
      return NextResponse.json({ success: true });
    }

    // Simple workflow status transitions
    const SIMPLE_TRANSITIONS: Record<string, string> = {
      submit: "submitted",
      start_review: "under_review",
      approve: "approved",
      request_revision: "revision_requested",
      reject: "rejected",
      archive: "archived",
      restore_draft: "draft",
      unpublish: "draft",
    };

    if (action in SIMPLE_TRANSITIONS) {
      if (authUser.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const newStatus = SIMPLE_TRANSITIONS[action];
      await prisma.post.update({ where: { id: Number(postId) }, data: { status: newStatus } });
      return NextResponse.json({ success: true, status: newStatus });
    }

    if (authUser.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    let data: any = {};
    switch (action) {
      case "feature":
        data.featured = true;
        break;
      case "unfeature":
        data.featured = false;
        break;
      case "pin":
        data.pinned = true;
        break;
      case "unpin":
        data.pinned = false;
        break;
      case "dismiss-flag":
        data.flagged = false;
        data.flagReason = null;
        break;
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    let updatedPost = await prisma.post.update({
      where: { id: Number(postId) },
      data,
    });

    // Only transition back to published if the post was already published before
    // it was flagged. Posts in other workflow states (submitted, approved, etc.)
    // should remain in their current state — the flag dismissal should not
    // bypass the editorial review pipeline.
    if (action === "dismiss-flag" && updatedPost.status === "published") {
      await transitionPostState(
        Number(postId),
        authUser.id,
        authUser.role,
        updatedPost.status,
        "published",
        updatedPost.assignedEditorId,
        true,
        true,
        "dismiss-flag"
      );
    }

    return NextResponse.json(updatedPost);
  } catch (error) {
    console.error("Admin Posts PATCH Error:", error);
    return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const authUser = await getAuthUser(request as any);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (authUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const body = await request.json();
    const { postId, reason } = body;

    if (!postId) {
      return NextResponse.json({ error: "Post ID is required" }, { status: 400 });
    }

    // 1. Fetch post details before deletion to notify the user
    const post = await prisma.post.findUnique({
      where: { id: Number(postId) },
      select: { userId: true, title: true, content: true, image: true }
    });

    if (post) {
      // 2. Create notification for the user
      await prisma.notification.create({
        data: {
          type: "POST_REMOVED" as any, // Cast because of recent schema change
          userId: authUser.id,
          recipientId: post.userId,
          time: new Date().toISOString(),
          group: "TODAY",
          unread: true,
          postPreview: post.title || post.content?.substring(0, 50) || "content",
          postImage: post.image,
          message: reason || "Your post was removed for violating community guidelines."
        }
      });
    }

    // 3. Delete the post
    await prisma.post.delete({
      where: { id: Number(postId) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin Posts DELETE Error:", error);
    return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });
  }
}
