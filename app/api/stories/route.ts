import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

// GET /api/stories?userId=1&status=published|draft|archived
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");
    const status = req.nextUrl.searchParams.get("status") || "published";
    const now = new Date();

    const where: Record<string, unknown> = { status };

    // Only filter by expiry for published stories
    if (status === "published") {
      where.expiresAt = { gt: now };
    }
    if (userId) {
      where.userId = Number(userId);
    }

    const stories = await prisma.story.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, handle: true, avatar: true, verified: true, role: true },
        },
      },
      orderBy: { createdAt: "asc" }, // oldest first — new stories come after old
    });

    // Group by user
    const grouped: Record<number, { user: any; stories: any[] }> = {};
    for (const story of stories) {
      if (!grouped[story.userId]) {
        grouped[story.userId] = { user: story.user, stories: [] };
      }
      grouped[story.userId].stories.push({
        id: story.id,
        imageUrl: story.imageUrl,
        textOverlay: story.textOverlay,
        textColor: story.textColor,
        textPosX: story.textPosX,
        textPosY: story.textPosY,
        textScale: story.textScale,
        location: story.location,
        locPosX: story.locPosX,
        locPosY: story.locPosY,
        imgPosX: story.imgPosX,
        imgPosY: story.imgPosY,
        imgScale: story.imgScale,
        imgFit: story.imgFit,
        visibility: story.visibility,
        status: story.status,
        views: story.views,
        likes: story.likes,
        createdAt: story.createdAt.toISOString(),
        expiresAt: story.expiresAt.toISOString(),
      });
    }

    return NextResponse.json({
      storyUsers: Object.values(grouped),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/stories — create a new story (published or draft)
export async function POST(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();
  try {
    const body = await req.json();
    const userId = authUser.id;
    const { imageUrl } = body;
    if (!imageUrl) {
      return NextResponse.json({ error: "Missing imageUrl" }, { status: 400 });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const story = await prisma.story.create({
      data: {
        userId,
        imageUrl,
        textOverlay: body.textOverlay || null,
        textColor: body.textColor || null,
        textPosX: body.textPosX ?? 50,
        textPosY: body.textPosY ?? 50,
        textScale: body.textScale ?? 1,
        location: body.location || null,
        locPosX: body.locPosX ?? 50,
        locPosY: body.locPosY ?? 20,
        imgPosX: body.imgPosX ?? 0,
        imgPosY: body.imgPosY ?? 0,
        imgScale: body.imgScale ?? 1,
        imgFit: body.imgFit || "contain",
        visibility: body.visibility || "public",
        status: body.status || "published",
        createdAt: now,
        expiresAt,
      },
    });

    // Update hasStory flag only for published stories
    if ((body.status || "published") === "published") {
      await prisma.user.update({
        where: { id: userId },
        data: { hasStory: true },
      });
    }

    return NextResponse.json({ ok: true, storyId: story.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT /api/stories — update story status (archive, publish draft, etc.)
export async function PUT(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();
  try {
    const body = await req.json();
    const { storyId, action } = body;
    const userId = authUser.id;
    if (!storyId || !action) {
      return NextResponse.json({ error: "Missing storyId or action" }, { status: 400 });
    }

    if (action === "archive") {
      await prisma.story.update({ where: { id: storyId }, data: { status: "archived" } });
    } else if (action === "publish") {
      // Publish a draft — reset expiry to 24h from now
      const now = new Date();
      await prisma.story.update({
        where: { id: storyId },
        data: { status: "published", createdAt: now, expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
      });
      if (userId) {
        await prisma.user.update({ where: { id: userId }, data: { hasStory: true } });
      }
    } else if (action === "unarchive") {
      // Restore from archive — reset expiry to 24h from now
      const now = new Date();
      await prisma.story.update({
        where: { id: storyId },
        data: { status: "published", createdAt: now, expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
      });
      if (userId) {
        await prisma.user.update({ where: { id: userId }, data: { hasStory: true } });
      }
    }

    // Check remaining active stories
    if (userId && (action === "archive")) {
      const remaining = await prisma.story.count({
        where: { userId, status: "published", expiresAt: { gt: new Date() } },
      });
      if (remaining === 0) {
        await prisma.user.update({ where: { id: userId }, data: { hasStory: false } });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/stories — permanently delete a story
export async function DELETE(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();
  try {
    const { storyId } = await req.json();
    const userId = authUser.id;
    if (!storyId) {
      return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
    }

    await prisma.story.delete({ where: { id: storyId } });

    if (userId) {
      const remaining = await prisma.story.count({
        where: { userId, status: "published", expiresAt: { gt: new Date() } },
      });
      if (remaining === 0) {
        await prisma.user.update({ where: { id: userId }, data: { hasStory: false } });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PATCH /api/stories — increment views or likes (skip if own story)
export async function PATCH(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();
  try {
    const { storyId, action } = await req.json();
    const userId = authUser.id;
    if (!storyId || !action) {
      return NextResponse.json({ error: "Missing storyId or action" }, { status: 400 });
    }

    // Check story ownership — don't count self-engagement
    if (userId) {
      const story = await prisma.story.findUnique({ where: { id: storyId }, select: { userId: true } });
      if (story && story.userId === userId) {
        return NextResponse.json({ ok: true, skipped: "own_content" });
      }
    }

    if (action === "view") {
      await prisma.story.update({ where: { id: storyId }, data: { views: { increment: 1 } } });
    } else if (action === "like") {
      await prisma.story.update({ where: { id: storyId }, data: { likes: { increment: 1 } } });
    } else if (action === "unlike") {
      await prisma.story.update({ where: { id: storyId }, data: { likes: { decrement: 1 } } });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
