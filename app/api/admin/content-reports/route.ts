import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { logActivity } from "@/lib/activity-logger";

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  if (authUser.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = (searchParams.get("status") || "PENDING").toUpperCase();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "15")));
  const offset = (page - 1) * limit;

  const reportFilter: any = {};
  if (status !== "ALL") reportFilter.status = status;

  const postWhere = { contentReports: { some: reportFilter } };

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where: postWhere,
      include: {
        user: { select: { id: true, name: true, handle: true, avatar: true } },
        contentReports: {
          where: reportFilter,
          include: {
            reporter: { select: { id: true, name: true, handle: true, avatar: true } },
            resolver: { select: { id: true, name: true, handle: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { id: "desc" },
      skip: offset,
      take: limit,
    }),
    prisma.post.count({ where: postWhere }),
  ]);

  const data = posts.map(({ contentReports, ...post }) => ({
    postId: post.id,
    post,
    reportCount: contentReports.length,
    reasons: [...new Set(contentReports.map((r) => r.reason))],
    reports: contentReports,
    latestReportedAt: contentReports[0]?.createdAt ?? null,
  }));

  return NextResponse.json({
    success: true,
    data,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

export async function PATCH(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  if (authUser.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { postId, action, reason } = await request.json();
  if (!postId || !action) return NextResponse.json({ error: "postId and action are required" }, { status: 400 });
  if (!["dismiss", "remove"].includes(action)) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const now = new Date();
  const numPostId = Number(postId);

  if (action === "dismiss") {
    await prisma.contentReport.updateMany({
      where: { postId: numPostId, status: "PENDING" },
      data: {
        status: "DISMISSED",
        resolvedBy: authUser.id,
        resolvedAt: now,
        resolution: reason || "Content reviewed and found compliant",
      },
    });

    await prisma.post.update({
      where: { id: numPostId },
      data: { flagged: false, flagReason: null },
    });

    logActivity({
      eventType: "CONTENT_MODERATED",
      userId: authUser.id,
      meta: `dismissed all reports on post #${numPostId}`,
    });

  } else {
    const post = await prisma.post.findUnique({
      where: { id: numPostId },
      select: { id: true, title: true, content: true, userId: true },
    });
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    await prisma.post.delete({ where: { id: numPostId } });

    if (post.userId) {
      try {
        await prisma.notification.create({
          data: {
            type: "POST_REMOVED",
            userId: post.userId,
            recipientId: post.userId,
            time: now.toISOString(),
            group: "TODAY",
            unread: true,
            message: reason || "Your post was removed for violating community guidelines.",
          },
        });
      } catch {}

      try {
        const { sendPushToUser } = await import("@/lib/fcm-send");
        await sendPushToUser(post.userId, {
          title: "Post removed",
          body: reason || "Your post was removed for violating community guidelines.",
          url: "/",
        });
      } catch {}
    }

    const postTitle = post.title || post.content?.slice(0, 60) || "Untitled";
    logActivity({
      eventType: "CONTENT_MODERATED",
      userId: authUser.id,
      meta: `removed post #${numPostId} "${postTitle.slice(0, 60)}"`,
    });
  }

  return NextResponse.json({ success: true });
}