import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { blobStorageService } from "@/lib/blob-storage";

export async function GET() {
  const posts = await prisma.circlePost.findMany({
    include: { member: true },
    orderBy: { id: "asc" },
  });

  // Map circle member names to user IDs so posts can be matched with user-based circleMembers
  const users = await prisma.user.findMany({
    where: { role: "CIRCLE" },
    select: { id: true, name: true },
  });
  const userMap = new Map(users.map(u => [u.name, u.id]));

  const transformed = posts.map(p => {
    let finalImage = p.image;
    if (finalImage && blobStorageService.isAvailable) {
      const blobName = blobStorageService.extractBlobName(finalImage);
      if (blobName) {
        finalImage = blobStorageService.getFileUrl(blobName);
      }
    }
    
    return {
      memberId: userMap.get(p.member.name) || p.memberId,
      content: p.content,
      image: finalImage,
      stats: { likes: p.likes, comments: p.comments },
    };
  });

  return NextResponse.json(transformed);
}

export async function POST(request: Request) {
  try {
    const { getAuthUser, unauthorized } = await import("@/app/lib/auth");
    const authUser = await getAuthUser(request as any);
    if (!authUser || authUser.role !== "CIRCLE") {
      return NextResponse.json({ error: "Unauthorized or not a Circle member" }, { status: 403 });
    }

    const { content, image } = await request.json();
    if (!content) return NextResponse.json({ error: "Content is required" }, { status: 400 });

    // Validate the user has a CircleMember profile
    const member = await prisma.circleMember.findUnique({ where: { id: authUser.id } });
    if (!member) {
      return NextResponse.json({ error: "Circle member profile not found" }, { status: 404 });
    }

    const post = await prisma.circlePost.create({
      data: {
        memberId: member.id,
        content,
        image: image || null,
        likes: "0",
        comments: "0",
      },
    });

    // Notify audience (All Circle Members + Followers)
    try {
      const { sendCircleUpdateEmail } = await import("@/lib/circle-email-service");
      const { sendPushToUser } = await import("@/lib/fcm-send");
      
      const authorId = authUser.id;
      const plainContent = content.trim();
      const contentSnippet = plainContent.length > 100 ? plainContent.substring(0, 100) + "..." : plainContent;

      const audienceRows = await prisma.$queryRaw<any[]>`
        SELECT DISTINCT u.id, u.email, u.name, u."notificationPrefs"
        FROM "User" u
        LEFT JOIN "UserFollow" uf ON uf."followerId" = u.id AND uf."followingId" = ${authorId}
        LEFT JOIN "CircleMember" cm ON cm.id = u.id
        WHERE (uf.id IS NOT NULL OR cm.id IS NOT NULL)
          AND u.id != ${authorId}
      `;

      for (const u of audienceRows) {
        // Email
        const emailEnabled = u.notificationPrefs?.email?.circleUpdates ?? true; // By default true or whatever user chose
        // Checking explicitly against false so it defaults to true if missing, or use strict checking based on existing pattern
        if (emailEnabled !== false && u.email) {
          sendCircleUpdateEmail({
            recipientEmail: u.email,
            recipientName: u.name,
            authorName: member.name,
            authorHandle: authUser.handle || "",
            authorTitle: member.title || "Circle Member",
            contentSnippet,
            postImage: image || undefined,
          }).catch(() => {});
        }

        // Push
        const pushEnabled = u.notificationPrefs?.push?.circlePosts ?? true;
        if (pushEnabled !== false) {
          // DB Notification
          await prisma.$executeRaw`
            INSERT INTO "Notification" (type, "userId", "recipientId", time, "group", unread, "postPreview", "postImage", "message")
            VALUES ('CIRCLE_POST', ${authorId}, ${u.id}, NOW(), 'TODAY', true, ${contentSnippet.substring(0, 50)}, ${image || null}, 'shared a new update in the Circle')
          `.catch(() => {});

          // FCM Push
          sendPushToUser(u.id, {
            title: `New Circle Update from ${member.name}`,
            body: contentSnippet,
            url: "/circle",
          }).catch(() => {});
        }
      }
    } catch (notifErr) {
      console.error("Failed to send circle notifications:", notifErr);
    }

    return NextResponse.json({ success: true, id: post.id });
  } catch (error: any) {
    console.error("Error creating circle post:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
