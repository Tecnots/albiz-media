import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyAdmin } from "@/lib/admin-notifier";
import { blobStorageService } from "@/lib/blob-storage";
import { getAuthUser, unauthorized, invalidateUserSessions } from "@/app/lib/auth";
import { logActivity } from "@/lib/activity-logger";
import { writeAuditLog, extractIp } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request as any);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (authUser.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const tab = searchParams.get("tab") || "All";

    // Fetch by IDs (used by admin notifications page)
    const idsParam = searchParams.get("ids");
    if (idsParam) {
      const ids = idsParam.split(",").map(Number).filter(Boolean);
      const users = await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, handle: true, avatar: true, role: true },
      });
      return NextResponse.json(users.map(u => ({ ...u, avatar: blobStorageService.resolveMediaUrl(u.avatar) })));
    }

    const where: any = {};

    if (query) {
      where.OR = [
        { name: { contains: query, mode: "insensitive" } },
        { handle: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
      ];
    }

    if (tab === "Circle") {
      where.role = "CIRCLE";
    } else if (tab === "Normal") {
      where.role = "NORMAL";
    } else if (tab === "Shorts") {
      where.role = "SHORTS_CREATOR";
    } else if (tab === "Verified") {
      where.verified = true;
    } else if (tab === "Banned") {
      where.banned = true;
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { id: "desc" },
      select: {
        id: true,
        name: true,
        handle: true,
        email: true,
        avatar: true,
        role: true,
        verified: true,
        banned: true,
        joinedDate: true,
        followers: true,
      },
    });

    const formattedUsers = users.map((u: { id: any; name: any; handle: any; email: any; avatar: any; role: any; verified: any; banned: any; joinedDate: any; followers: any; }) => ({
      id: u.id,
      name: u.name,
      handle: u.handle,
      email: u.email,
      avatar: blobStorageService.resolveMediaUrl(u.avatar) || "",
      role: u.role,
      verified: u.verified,
      status: u.banned ? ("banned" as const) : ("active" as const),
      joinDate: u.joinedDate || "Recent",
      followers: u.followers || "0",
    }));

    return NextResponse.json(formattedUsers);
  } catch (error) {
    console.error("[ADMIN_USERS_GET]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return unauthorized();
    if (authUser.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { action, reason } = body;

    // Support both single userId and bulk userIds
    let userIds: number[] = [];
    if (Array.isArray(body.userIds) && body.userIds.length > 0) {
      userIds = body.userIds.map(Number).filter(Boolean);
    } else if (body.userId) {
      userIds = [Number(body.userId)];
    }

    if (!userIds.length) {
      return NextResponse.json({ error: "No user IDs provided" }, { status: 400 });
    }

    if (!["ban", "unban", "promote_circle", "promote_author", "promote_shorts_creator", "verify", "unverify"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Fetch affected users for notifications
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, handle: true, email: true },
    });

    const ip = extractIp(request);

    if (action === "ban") {
      await prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: {
          banned: true,
          banReason: reason || "Violation of platform terms",
        },
      });
      // Invalidate all sessions for banned users immediately
      await Promise.all(userIds.map(id => invalidateUserSessions(id)));
      for (const user of users) {
        notifyAdmin({
          type: "SYSTEM",
          title: "User banned",
          message: `${user.name} (@${user.handle}) was banned — ${reason || "Violation of platform terms"}`,
          metadata: { userId: user.id, action: "ban" },
        });
        logActivity({ eventType: "BAN", userId: user.id, meta: reason || "Violation of platform terms" });
        writeAuditLog({ action: "USER_BAN", actorId: authUser.id, targetId: user.id, targetType: "user", meta: { reason }, ip });
      }
    } else if (action === "unban") {
      await prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: { banned: false, banReason: null },
      });
      for (const user of users) {
        logActivity({ eventType: "UNBAN", userId: user.id });
        writeAuditLog({ action: "USER_UNBAN", actorId: authUser.id, targetId: user.id, targetType: "user", ip });
      }
    } else if (action === "promote_circle") {
      await prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: { role: "CIRCLE" },
      });
      for (const user of users) {
        writeAuditLog({ action: "USER_ROLE_CHANGE", actorId: authUser.id, targetId: user.id, targetType: "user", meta: { newRole: "CIRCLE" }, ip });
      }
    } else if (action === "promote_author") {
      await prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: { role: "AUTHOR" },
      });
      for (const user of users) {
        notifyAdmin({
          type: "AUTHOR_REQUEST",
          title: "Author promoted",
          message: `${user.name} (@${user.handle}) was promoted to Author`,
          metadata: { userId: user.id, action: "promote_author" },
        });
        writeAuditLog({ action: "USER_ROLE_CHANGE", actorId: authUser.id, targetId: user.id, targetType: "user", meta: { newRole: "AUTHOR" }, ip });
      }
    } else if (action === "promote_shorts_creator") {
      await prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: { role: "SHORTS_CREATOR" },
      });
      for (const user of users) {
        writeAuditLog({ action: "USER_ROLE_CHANGE", actorId: authUser.id, targetId: user.id, targetType: "user", meta: { newRole: "SHORTS_CREATOR" }, ip });
      }
    } else if (action === "verify") {
      await prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: { verified: true },
      });
    } else if (action === "unverify") {
      await prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: { verified: false },
      });
    }

    return NextResponse.json({ success: true, affected: users.length });
  } catch (error) {
    console.error("[ADMIN_USERS_PATCH]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return unauthorized();
    if (authUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    // Prevent deleting yourself
    if (id === authUser.id) {
      return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
    }

    // Fetch user info before deletion so the activity log captures it
    const userToDelete = await prisma.user.findUnique({
      where: { id },
      select: { name: true, handle: true, avatar: true },
    });
    logActivity({
      eventType: "DELETE_ACCOUNT",
      userId: id,
      userName: userToDelete?.name,
      handle: userToDelete?.handle,
      avatar: userToDelete?.avatar ?? undefined,
    });
    writeAuditLog({ action: "USER_DELETE", actorId: authUser.id, targetId: id, targetType: "user", meta: { handle: userToDelete?.handle }, ip: extractIp(request) });
    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[ADMIN_USERS_DELETE]", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
