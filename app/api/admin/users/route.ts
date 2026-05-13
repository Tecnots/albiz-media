import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const tab = searchParams.get("tab") || "All";

    const where: any = {};

    // Search filter
    if (query) {
      where.OR = [
        { name: { contains: query, mode: "insensitive" } },
        { handle: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
      ];
    }

    // Tab filter
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

    // Map to the format expected by the frontend
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

export async function PATCH(request: Request) {
  try {
    const { userId, action, reason } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    if (action === "ban") {
      await prisma.user.update({
        where: { id: userId },
        data: { 
          banned: true,
          banReason: reason || "Violation of platform terms"
        },
      });
    } else if (action === "unban") {
      await prisma.user.update({
        where: { id: userId },
        data: { 
          banned: false,
          banReason: null
        },
      });
    } else if (action === "promote_circle") {
      await prisma.user.update({
        where: { id: userId },
        data: { role: "CIRCLE" },
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ADMIN_USERS_PATCH]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
