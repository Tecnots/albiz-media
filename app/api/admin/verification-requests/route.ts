import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { logActivity } from "@/lib/activity-logger";
import { notifyAdmin } from "@/lib/admin-notifier";
import { blobStorageService } from "@/lib/blob-storage";

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  if (authUser.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = (searchParams.get("status") || "PENDING").toUpperCase();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(50, parseInt(searchParams.get("limit") || "20"));
  const offset = (page - 1) * limit;

  const where: any = {};
  if (status !== "ALL") where.status = status;

  const [requests, total] = await Promise.all([
    prisma.verificationRequest.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            handle: true,
            email: true,
            avatar: true,
            followers: true,
            joinedDate: true,
            verified: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
    }),
    prisma.verificationRequest.count({ where }),
  ]);

  const resolved = requests.map((r: any) => ({
    ...r,
    user: r.user ? { ...r.user, avatar: blobStorageService.resolveMediaUrl(r.user.avatar) } : r.user,
  }));
  return NextResponse.json({
    success: true,
    data: resolved,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

export async function PATCH(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  if (authUser.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, action, note } = await request.json();
  if (!id || !action) return NextResponse.json({ error: "id and action are required" }, { status: 400 });
  if (!["approve", "reject"].includes(action)) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const vr = await prisma.verificationRequest.findUnique({
    where: { id: Number(id) },
    include: { user: { select: { id: true, name: true, handle: true, avatar: true, email: true } } },
  });
  if (!vr) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (vr.status !== "PENDING") return NextResponse.json({ error: "Request already processed" }, { status: 400 });

  if (action === "approve") {
    await prisma.$transaction([
      prisma.verificationRequest.update({
        where: { id: vr.id },
        data: { status: "APPROVED", reviewedBy: authUser.id, reviewNote: note || null, updatedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: vr.userId },
        data: { verified: true },
      }),
      prisma.notification.create({
        data: {
          type: "VERIFICATION_APPROVED",
          userId: vr.userId,
          recipientId: vr.userId,
          time: new Date().toISOString(),
          group: "TODAY",
          unread: true,
          message: "Your account has been verified.",
        },
      }),
    ]);

    logActivity({
      eventType: "VERIFICATION_APPROVED",
      userId: vr.user.id,
      userName: vr.user.name,
      handle: vr.user.handle,
      avatar: vr.user.avatar || undefined,
    });

    try {
      const { sendPushToUser } = await import("@/lib/fcm-send");
      await sendPushToUser(vr.userId, {
        title: "Account verified",
        body: "Your account has been verified. A badge has been added to your profile.",
        url: "/",
      });
    } catch {}

  } else {
    await prisma.$transaction([
      prisma.verificationRequest.update({
        where: { id: vr.id },
        data: { status: "REJECTED", reviewedBy: authUser.id, reviewNote: note || null, updatedAt: new Date() },
      }),
      prisma.notification.create({
        data: {
          type: "VERIFICATION_REJECTED",
          userId: vr.userId,
          recipientId: vr.userId,
          time: new Date().toISOString(),
          group: "TODAY",
          unread: true,
          message: note || "Your verification request was not approved at this time.",
        },
      }),
    ]);

    logActivity({
      eventType: "VERIFICATION_REJECTED",
      userId: vr.user.id,
      userName: vr.user.name,
      handle: vr.user.handle,
      avatar: vr.user.avatar || undefined,
      meta: note || undefined,
    });

    try {
      const { sendPushToUser } = await import("@/lib/fcm-send");
      await sendPushToUser(vr.userId, {
        title: "Verification update",
        body: note || "Your verification request was not approved at this time.",
        url: "/",
      });
    } catch {}
  }

  return NextResponse.json({ success: true });
}