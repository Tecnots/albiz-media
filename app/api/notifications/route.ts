import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { blobStorageService } from "@/lib/blob-storage";

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return NextResponse.json([]);

  const recipientId = authUser.id;

  const page = Math.max(0, parseInt(request.nextUrl.searchParams.get("page") ?? "0", 10) || 0);
  const take = 50;

  // Fetch a wider window so we can group actor-flood notifications (e.g. 50
  // different users liking the same post) into one row with an actorCount.
  const FETCH_MULTIPLIER = 5;
  const rawNotifications = await prisma.notification.findMany({
    where: { recipientId },
    orderBy: { id: 'desc' },
    take: take * FETCH_MULTIPLIER,
    skip: page * take,
  });

  // Group by (type, postId) for types that generate actor floods.
  // Keep the most-recent row per group and annotate with actorCount.
  const GROUPABLE_TYPES = new Set(["LIKE", "NEW_POST", "MENTION", "LIKE_STORY", "NEW_STORY"]);
  const groupKey = (n: any) =>
    GROUPABLE_TYPES.has(n.type) ? `${n.type}:${n.postId ?? ""}` : `single:${n.id}`;

  const seen = new Map<string, { notif: any; count: number }>();
  for (const n of rawNotifications) {
    const k = groupKey(n);
    const entry = seen.get(k);
    if (!entry) {
      seen.set(k, { notif: n, count: 1 });
    } else {
      entry.count += 1;
    }
  }

  const grouped = Array.from(seen.values())
    .sort((a, b) => b.notif.id - a.notif.id)
    .slice(0, take);

  const transformed = grouped.map(({ notif: n, count }) => ({
    id: n.id,
    type: n.type.toLowerCase(),
    userId: n.userId,
    time: n.time,
    group: n.group,
    unread: n.unread,
    postPreview: n.postPreview,
    postImage: blobStorageService.resolveMediaUrl(n.postImage),
    postId: n.postId,
    message: n.message,
    actorCount: count,
  }));

  return NextResponse.json(transformed);
}

export async function PATCH(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  try {
    const body = await request.json();
    const userId = authUser.id;

    if (body.action === "mark_all_read") {
      if (!userId) return NextResponse.json({ error: "Missing user" }, { status: 400 });
      await prisma.$executeRaw`UPDATE "Notification" SET unread = false WHERE "recipientId" = ${userId} AND unread = true`;
    } else if (body.ids?.length) {
      const ids = body.ids as number[];
      await prisma.$executeRaw`UPDATE "Notification" SET unread = false WHERE id = ANY(${ids}::int[])`;
    } else {
      return NextResponse.json({ error: "Provide action or ids" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
