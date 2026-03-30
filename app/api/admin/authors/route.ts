import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      orderBy: [{ role: "asc" }, { id: "asc" }],
      select: {
        id: true, name: true, handle: true, email: true, role: true,
        avatar: true, title: true, verified: true, joinedDate: true, banned: true, canPost: true,
        _count: { select: { posts: { where: { type: "ARTICLE" } } } },
      },
    });

    return NextResponse.json({
      authors: users.map(u => ({
        id: u.id,
        name: u.name,
        handle: u.handle,
        email: u.email,
        role: u.role,
        avatar: u.avatar,
        title: u.title,
        verified: u.verified,
        joinedDate: u.joinedDate,
        banned: u.banned,
        canPost: u.canPost,
        articleCount: u._count.posts,
      })),
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error", authors: [] }, { status: 500 });
  }
}

// PATCH — change role or canPost
export async function PATCH(request: Request) {
  try {
    const { id, role, canPost } = await request.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const data: Record<string, unknown> = {};
    if (role !== undefined) {
      const validRoles = ["NORMAL", "CIRCLE", "AUTHOR", "ADMIN"];
      if (!validRoles.includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      data.role = role;
    }
    if (canPost !== undefined) data.canPost = canPost;

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, role: true, canPost: true },
    });

    return NextResponse.json({ user });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
