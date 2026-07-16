import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { blobStorageService } from "@/lib/blob-storage";
import { sendNewStoryEmail, sendStoryLikeEmail } from "@/lib/circle-email-service";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeStoryStickers, validateStickerElement } from "@/app/lib/storySticker";

// GET /api/stories?userId=1&status=published|draft|archived
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");
    const status = req.nextUrl.searchParams.get("status") || "published";
    const now = new Date();

    const authUser = await getAuthUser(req);
    const canSeeCircle = authUser?.role === "CIRCLE" || authUser?.role === "ADMIN";
    const isOwnerRequest = !!(userId && authUser?.id === Number(userId));

    // Drafts/archived stories are private — only the owner may list them.
    // (Previously any caller could read anyone's drafts via ?userId=X&status=draft.)
    if (status !== "published" && !isOwnerRequest) {
      return NextResponse.json({ storyUsers: [] });
    }

    const where: Record<string, unknown> = { status };

    // Only filter by expiry for published stories
    if (status === "published") {
      where.expiresAt = { gt: now };
    }
    if (userId) {
      where.userId = Number(userId);
    }
    // "circle"-visibility stories were previously returned to any caller —
    // the restriction only ever existed client-side. Enforce it here too,
    // preserving the existing coarse rule (any Circle/Admin sees any
    // author's circle stories; an owner always sees their own regardless).
    if (!isOwnerRequest) {
      where.visibility = canSeeCircle ? { in: ["public", "circle"] } : "public";
    }

    const stories = await prisma.story.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, handle: true, avatar: true, verified: true, role: true },
        },
      },
      orderBy: { createdAt: "asc" }, // oldest first — new stories come after old
      take: 500,
    });

    // Group by user
    const grouped: Record<number, { user: any; stories: any[] }> = {};
    for (const story of stories) {
      if (!grouped[story.userId]) {
        const avatarUrl = blobStorageService.resolveMediaUrl(story.user.avatar);
        grouped[story.userId] = { user: { ...story.user, avatar: avatarUrl }, stories: [] };
      }

      const finalImageUrl = blobStorageService.resolveMediaUrl(story.imageUrl);

      grouped[story.userId].stories.push({
        id: story.id,
        imageUrl: finalImageUrl,
        textOverlay: story.textOverlay,
        textColor: story.textColor,
        textBold: story.textBold ?? false,
        textItalic: story.textItalic ?? false,
        textAlign: story.textAlign ?? "center",
        textPosX: story.textPosX,
        textPosY: story.textPosY,
        textScale: story.textScale,
        textRotation: story.textRotation ?? 0,
        textOpacity: story.textOpacity ?? 1,
        textBackgroundColor: story.textBackgroundColor ?? null,
        location: story.location,
        locationLat: story.locationLat ?? null,
        locationLng: story.locationLng ?? null,
        locationPlaceId: story.locationPlaceId ?? null,
        locPosX: story.locPosX,
        locPosY: story.locPosY,
        imgPosX: story.imgPosX,
        imgPosY: story.imgPosY,
        imgScale: story.imgScale,
        imgFit: story.imgFit,
        stickers: story.stickers ?? null,
        visibility: story.visibility,
        status: story.status,
        views: story.views,
        likes: story.likes,
        shares: story.shares || 0,
        createdAt: story.createdAt.toISOString(),
        expiresAt: story.expiresAt.toISOString(),
      });
    }

    return NextResponse.json({
      storyUsers: Object.values(grouped),
    });
  } catch (e: any) {
    console.error("GET /api/stories error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/stories — create a new story (published or draft)
export async function POST(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();

  if (authUser.role !== "CIRCLE" && authUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Stories require a Circle subscription" }, { status: 403 });
  }

  const storyLimit = await rateLimit(`story:${authUser.id}`, 20, 60 * 60 * 1000);
  if (!storyLimit.allowed) {
    return NextResponse.json(storyLimit.error, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((storyLimit.resetAt - Date.now()) / 1000)) },
    });
  }

  try {
    const body = await req.json();
    const userId = authUser.id;
    const { imageUrl } = body;
    if (!imageUrl) {
      return NextResponse.json({ error: "Missing imageUrl" }, { status: 400 });
    }

    // `stickers`, if present, must be the current array-of-elements shape —
    // reject a stale client sending the old positional-only map.
    let stickerElements: ReturnType<typeof normalizeStoryStickers> = [];
    if (body.stickers != null) {
      if (!Array.isArray(body.stickers)) {
        return NextResponse.json({ error: "Invalid stickers: expected an array" }, { status: 400 });
      }
      stickerElements = normalizeStoryStickers(body.stickers);
      for (const el of stickerElements) {
        const err = validateStickerElement(el);
        if (err) return NextResponse.json({ error: err }, { status: 400 });
      }
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Wrap story create + hasStory flag update atomically (H-10)
    const storyStatus = body.status || "published";
    const story = await prisma.$transaction(async (tx) => {
      const created = await tx.story.create({
        data: {
          userId,
          imageUrl,
          textOverlay: body.textOverlay || null,
          textColor: body.textColor || null,
          textBold: body.textBold ?? false,
          textItalic: body.textItalic ?? false,
          textAlign: body.textAlign ?? "center",
          textPosX: body.textPosX ?? 50,
          textPosY: body.textPosY ?? 50,
          textScale: body.textScale ?? 1,
          textRotation: body.textRotation ?? 0,
          textOpacity: body.textOpacity ?? 1,
          textBackgroundColor: body.textBackgroundColor || null,
          location: body.location || null,
          locationLat: body.locationLat ?? null,
          locationLng: body.locationLng ?? null,
          locationPlaceId: body.locationPlaceId || null,
          locPosX: body.locPosX ?? 50,
          locPosY: body.locPosY ?? 20,
          imgPosX: body.imgPosX ?? 0,
          imgPosY: body.imgPosY ?? 0,
          imgScale: body.imgScale ?? 1,
          imgFit: body.imgFit || "contain",
          stickers: body.stickers ?? null,
          visibility: body.visibility || "public",
          status: storyStatus,
          createdAt: now,
          expiresAt,
        },
      });
      if (storyStatus === "published") {
        await tx.user.update({ where: { id: userId }, data: { hasStory: true } });
      }
      return created;
    });

    // Update hasStory flag only for published stories
    if (storyStatus === "published") {

      // Notify followers if this is a CIRCLE user publishing a story
      try {
        const author = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true, name: true, handle: true, image: true },
        });
        if (author?.role === "CIRCLE") {
          const storyImageUrl = body.imageUrl || "";

          // Push notifications — filtered by follower's push.stories preference
          await prisma.$executeRaw`
            INSERT INTO "Notification" (type, "userId", "recipientId", time, "group", unread, "postPreview", "postImage", "postId")
            SELECT 'NEW_STORY', ${userId}, uf."followerId", NOW(), 'TODAY', true, '', ${storyImageUrl}, ${story.id}
            FROM "UserFollow" uf
            JOIN "User" u ON u.id = uf."followerId"
            WHERE uf."followingId" = ${userId}
              AND (
                u."notificationPrefs" IS NULL
                OR u."notificationPrefs"->'push'->>'stories' IS NULL
                OR (u."notificationPrefs"->'push'->>'stories')::boolean = true
              )
            ON CONFLICT (type, "userId", "recipientId", "postId") DO NOTHING
          `;

          // Send FCM push notifications
          const pushFollowers = await prisma.$queryRaw<{ id: number }[]>`
            SELECT u.id
            FROM "UserFollow" uf
            JOIN "User" u ON u.id = uf."followerId"
            WHERE uf."followingId" = ${userId}
              AND (
                u."notificationPrefs" IS NULL
                OR u."notificationPrefs"->'push'->>'stories' IS NULL
                OR (u."notificationPrefs"->'push'->>'stories')::boolean = true
              )
          `;
          if (pushFollowers.length > 0) {
            const { sendPushToUser } = await import("@/lib/fcm-send");
            await Promise.allSettled(
              pushFollowers.map((f: { id: number; }) =>
                sendPushToUser(f.id, {
                  title: `${author.name} posted a new story`,
                  body: "Tap to view",
                  url: `/?story=${userId}`,
                  icon: author.image || undefined,
                  image: storyImageUrl || undefined,
                })
              )
            ).catch((err) => console.error("Push story err:", err));
          }

          // Email notifications — followers who have email.stories enabled
          const emailFollowers = await prisma.$queryRaw<{ email: string; name: string }[]>`
            SELECT u.email, u.name
            FROM "UserFollow" uf
            JOIN "User" u ON u.id = uf."followerId"
            WHERE uf."followingId" = ${userId}
              AND u.email IS NOT NULL
              AND (
                u."notificationPrefs" IS NULL
                OR u."notificationPrefs"->'email'->>'stories' IS NULL
                OR (u."notificationPrefs"->'email'->>'stories')::boolean = true
              )
          `;
          // Fire-and-forget
          Promise.allSettled(
            emailFollowers.map((f: { email: any; name: any; }) =>
              sendNewStoryEmail({
                recipientEmail: f.email,
                recipientName: f.name,
                authorName: author.name,
                authorHandle: author.handle,
                storyImage: storyImageUrl || undefined,
              })
            )
          ).catch(() => {});
        }
      } catch (notifErr) {
        console.error("Error creating new story notifications:", notifErr);
      }

      // Notify any mentioned users — independent of the author's role, since
      // anyone (not just CIRCLE authors) can be mentioned.
      const mentions = stickerElements.filter((el) => el.type === "mention" && el.data.userId);
      if (mentions.length > 0) {
        try {
          const mentionAuthor = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, avatar: true },
          });
          for (const el of mentions) {
            const recipientId = el.data.userId as number;
            if (recipientId === userId) continue;
            await prisma.$executeRaw`
              INSERT INTO "Notification" (type, "userId", "recipientId", time, "group", unread, "postPreview", "postImage", "postId", message)
              VALUES ('MENTION', ${userId}, ${recipientId}, NOW(), 'TODAY', true, '', ${imageUrl}, ${story.id}, 'mentioned you in their story')
              ON CONFLICT (type, "userId", "recipientId", "postId") DO NOTHING
            `;
            if (mentionAuthor) {
              const { sendPushToUser } = await import("@/lib/fcm-send");
              await sendPushToUser(recipientId, {
                title: `${mentionAuthor.name} mentioned you in their story`,
                body: "Tap to view",
                url: `/?story=${userId}`,
                icon: mentionAuthor.avatar || undefined,
                image: imageUrl || undefined,
              }).catch((err) => console.error("Push story mention err:", err));
            }
          }
        } catch (mentionErr) {
          console.error("Error creating story mention notifications:", mentionErr);
        }
      }
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
      const updated = await prisma.story.updateMany({ where: { id: storyId, userId }, data: { status: "archived" } });
      if (updated.count === 0) {
        return NextResponse.json({ error: "Story not found or not owned by you" }, { status: 404 });
      }
    } else if (action === "publish") {
      // Publish a draft — reset expiry to 24h from now
      const now = new Date();
      const updated = await prisma.story.updateMany({
        where: { id: storyId, userId },
        data: { status: "published", createdAt: now, expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
      });
      if (updated.count === 0) {
        return NextResponse.json({ error: "Story not found or not owned by you" }, { status: 404 });
      }
      if (userId) {
        await prisma.user.update({ where: { id: userId }, data: { hasStory: true } });
      }
    } else if (action === "unarchive") {
      // Restore from archive — reset expiry to 24h from now
      const now = new Date();
      const updated = await prisma.story.updateMany({
        where: { id: storyId, userId },
        data: { status: "published", createdAt: now, expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
      });
      if (updated.count === 0) {
        return NextResponse.json({ error: "Story not found or not owned by you" }, { status: 404 });
      }
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

    const deleted = await prisma.story.deleteMany({ where: { id: storyId, userId } });
    if (deleted.count === 0) {
      return NextResponse.json({ error: "Story not found or not owned by you" }, { status: 404 });
    }

    // Clean up notification rows that reference this story so they don't
    // accumulate as orphans after the story is gone.
    await prisma.$executeRaw`DELETE FROM "Notification" WHERE "postId" = ${storyId}`.catch(() => {});

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

// PATCH /api/stories — increment views or likes (skip if own content)
export async function PATCH(req: NextRequest) {
  // Views and shares are public — logged-out visitors can view stories.
  // Likes/unlikes still require authentication.
  const authUser = await getAuthUser(req);
  try {
    const { storyId, action } = await req.json();
    const userId = authUser?.id;
    if (!storyId || !action) {
      return NextResponse.json({ error: "Missing storyId or action" }, { status: 400 });
    }

    if (action === "view") {
      if (!userId) {
        // Anonymous viewer — increment the public view counter, no per-user dedupe
        await prisma.story.update({ where: { id: storyId }, data: { views: { increment: 1 } } });
        return NextResponse.json({ ok: true });
      }
      // Check if already viewed
      const existingView = await prisma.storyView.findUnique({
        where: { storyId_userId: { storyId, userId } },
      });
      if (!existingView) {
        // Get story to check if viewer is the author
        const story = await prisma.story.findUnique({
          where: { id: storyId },
          select: { userId: true },
        });

        // Only increment view count if viewer is not the author
        if (story && story.userId !== userId) {
          await prisma.$transaction([
            prisma.storyView.create({ data: { storyId, userId } }),
            prisma.story.update({ where: { id: storyId }, data: { views: { increment: 1 } } }),
          ]);
        } else {
          // Still record the view but don't increment count
          await prisma.storyView.create({ data: { storyId, userId } });
        }
      }
    } else if (action === "like") {
      if (!userId) return unauthorized();
      const existingLike = await prisma.storyLike.findUnique({
        where: { storyId_userId: { storyId, userId } },
      });
      if (!existingLike) {
        await prisma.$transaction([
          prisma.storyLike.create({ data: { storyId, userId } }),
          prisma.story.update({ where: { id: storyId }, data: { likes: { increment: 1 } } }),
        ]);

        // Notify + email story owner
        try {
          const story = await prisma.story.findUnique({
            where: { id: storyId },
            select: { userId: true, imageUrl: true },
          });
          if (story && story.userId !== userId) {
            const owner = await prisma.user.findUnique({
              where: { id: story.userId },
              select: { name: true, email: true, notificationPrefs: true },
            });
            const prefs = owner?.notificationPrefs as any;

            // Push notification
            const pushEnabled = prefs?.push?.likes ?? true;
            if (pushEnabled) {
              await prisma.$executeRaw`
                INSERT INTO "Notification" (type, "userId", "recipientId", time, "group", unread, "postPreview", "postImage", "postId")
                VALUES ('LIKE_STORY', ${userId}, ${story.userId}, NOW(), 'TODAY', true, '', ${story.imageUrl || ""}, ${storyId})
                ON CONFLICT (type, "userId", "recipientId", "postId") DO NOTHING
              `;
              
              const liker = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, avatar: true } });
              if (liker) {
                const { sendPushToUser } = await import("@/lib/fcm-send");
                await sendPushToUser(story.userId, {
                  title: `${liker.name} liked your story`,
                  body: "Tap to view",
                  url: `/?story=${story.userId}`,
                  icon: liker.avatar || undefined,
                  image: story.imageUrl || undefined,
                }).catch((err) => console.error("Push story like err:", err));
              }
            }

            // Email notification
            const emailEnabled = prefs?.email?.likes ?? false;
            if (emailEnabled && owner?.email) {
              const liker = await prisma.user.findUnique({
                where: { id: userId },
                select: { name: true, handle: true },
              });
              if (liker) {
                sendStoryLikeEmail({
                  recipientEmail: owner.email,
                  recipientName: owner.name,
                  likerName: liker.name,
                  likerHandle: liker.handle,
                  storyImage: story.imageUrl || undefined,
                }).catch(() => {});
              }
            }
          }
        } catch (notifErr) {
          console.error("Error creating story like notification:", notifErr);
        }
      }
    } else if (action === "unlike") {
      if (!userId) return unauthorized();
      const existingLike = await prisma.storyLike.findUnique({
        where: { storyId_userId: { storyId, userId } },
      });
      if (existingLike) {
        await prisma.$transaction([
          prisma.storyLike.delete({ where: { storyId_userId: { storyId, userId } } }),
          prisma.story.update({ where: { id: storyId }, data: { likes: { decrement: 1 } } }),
        ]);
      }
    } else if (action === "share") {
      await prisma.story.updateMany({ where: { id: storyId }, data: { shares: { increment: 1 } } });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
