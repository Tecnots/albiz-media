import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyAdmin } from "@/lib/admin-notifier";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { logActivity } from "@/lib/activity-logger";

export async function GET(request: Request) {
  try {
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
      return NextResponse.json(users);
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

    const formattedUsers = users.map((u) => ({
      id: u.id,
      name: u.name,
      handle: u.handle,
      email: u.email,
      avatar: u.avatar || "",
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

    if (!["ban", "unban", "promote_circle", "promote_author", "verify", "unverify"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Fetch affected users for notifications
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, handle: true, email: true },
    });

    if (action === "ban") {
      await prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: {
          banned: true,
          banReason: reason || "Violation of platform terms",
        },
      });
      for (const user of users) {
        notifyAdmin({
          type: "SYSTEM",
          title: "User banned",
          message: `${user.name} (@${user.handle}) was banned — ${reason || "Violation of platform terms"}`,
          metadata: { userId: user.id, action: "ban" },
        });
        logActivity({ eventType: "BAN", userId: user.id, meta: reason || "Violation of platform terms" });
      }
    } else if (action === "unban") {
      await prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: { banned: false, banReason: null },
      });
      for (const user of users) {
        logActivity({ eventType: "UNBAN", userId: user.id });
      }
    } else if (action === "promote_circle") {
      await prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: { role: "CIRCLE" },
      });
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
    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[ADMIN_USERS_DELETE]", error);
    return NextResponse.json({ error: error.message || "Failed to delete user" }, { status: 500 });
  }
}
