import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { sendFollowEmail } from "@/lib/circle-email-service";
import { sendPushToUser } from "@/lib/fcm-send";
import { rateLimit } from "@/lib/rate-limit";
import { checkFollowAbuse, checkUnfollowAbuse } from "@/lib/abuse-detection";

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return unauthorized();

    // Rate limit: 60 follow actions per minute per user
    const followLimit = await rateLimit(`follow:${authUser.id}`, 60, 60 * 1000);
    if (!followLimit.allowed) {
      return NextResponse.json(followLimit.error, {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((followLimit.resetAt - Date.now()) / 1000)) },
      });
    }

    // Abuse detection: blocks rapid follow campaigns
    const abuse = await checkFollowAbuse(authUser.id);
    if (abuse.blocked) {
      return NextResponse.json({ error: abuse.reason }, {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((abuse.retryAfterMs ?? 60_000) / 1000)) },
      });
    }

    const body = await request.json();
    const followingId = parseInt(String(body.followingId), 10);
    if (isNaN(followingId)) {
      return NextResponse.json({ error: 'Invalid followingId' }, { status: 400 });
    }

    if (authUser.id === followingId) {
      return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
    }

    let isNewFollow = false;
    
    try {
      await prisma.userFollow.create({
        data: { followerId: authUser.id, followingId },
      });
      isNewFollow = true;
    } catch (err: any) {
      // If unique constraint error, it means already following
      if (err.code === 'P2002') {
        isNewFollow = false;
      } else {
        throw err;
      }
    }

    // Create notification + email only if this is a new follow
    if (isNewFollow) {
      try {
        const recipient = await prisma.user.findUnique({
          where: { id: followingId },
          select: { name: true, email: true, notificationPrefs: true },
        });
        const prefs = recipient?.notificationPrefs as any;

        // Push notification
        const pushEnabled = prefs?.push?.follows ?? true;
        if (pushEnabled) {
          await prisma.$executeRaw`
            INSERT INTO "Notification" (type, "userId", "recipientId", time, "group", unread, "postPreview", "postImage")
            VALUES ('FOLLOW', ${authUser.id}, ${followingId}, NOW(), 'TODAY', true, '', '')
            ON CONFLICT (type, "userId", "recipientId", "postId") DO UPDATE SET time = NOW(), unread = true
          `;
        }

        const follower = await prisma.user.findUnique({
          where: { id: authUser.id },
          select: { name: true, handle: true },
        });

        // Browser push
        if (pushEnabled && follower) {
          sendPushToUser(followingId, {
            title: `${follower.name} followed you`,
            body: "You have a new follower",
            url: `/${follower.handle}`,
          }).catch(() => {});
        }

        // Email notification
        const emailEnabled = prefs?.email?.follows ?? true;
        if (emailEnabled && recipient?.email && follower) {
          sendFollowEmail({
            recipientEmail: recipient.email,
            recipientName: recipient.name,
            followerName: follower.name,
            followerHandle: follower.handle,
          }).catch(() => {});
        }
      } catch (err) {
        console.error("Error creating follow notification:", err);
      }
    }

    return NextResponse.json({ success: true, action: "followed" });
  } catch (err: any) {
    console.error("Follow endpoint error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return unauthorized();

    const abuse = await checkUnfollowAbuse(authUser.id);
    if (abuse.blocked) {
      return NextResponse.json({ error: abuse.reason }, {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((abuse.retryAfterMs ?? 60_000) / 1000)) },
      });
    }

    // Try to get from URL params first (Capacitor safe), fallback to JSON body
    const searchParams = request.nextUrl.searchParams;
    let followingId = searchParams.get('followingId');
    
    if (!followingId) {
      try {
        const body = await request.json();
        followingId = body.followingId;
      } catch (e) {
        // Ignore JSON parse error if body is stripped
      }
    }

    if (!followingId) {
      return NextResponse.json({ error: "Missing followingId" }, { status: 400 });
    }

    const targetId = parseInt(followingId.toString(), 10);

    // Record unfollow event before deleting so analytics can track churn
    await prisma.userUnfollowEvent.create({
      data: { followerId: authUser.id, followingId: targetId },
    }).catch(() => {});

    await prisma.userFollow.deleteMany({
      where: { followerId: authUser.id, followingId: targetId },
    });

    return NextResponse.json({ success: true, action: "unfollowed" });
  } catch (err: any) {
    console.error("Unfollow endpoint error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
