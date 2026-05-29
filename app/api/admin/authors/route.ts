import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

async function requireAdmin(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return { error: unauthorized() };
  if (user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

// GET — list all users for the admin authors management view
export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard.error) return guard.error;

  try {
    const users = await prisma.user.findMany({
      orderBy: { id: "desc" },
      select: {
        id: true,
        name: true,
        handle: true,
        email: true,
        avatar: true,
        title: true,
        role: true,
        verified: true,
        banned: true,
        canPost: true,
        joinedDate: true,
      },
    });

    // Published-article counts per user.
    const articleCountsRaw = await prisma.$queryRaw<{ userId: number; count: bigint }[]>`
      SELECT "userId", COUNT(*)::bigint AS count
      FROM "Post"
      WHERE type = 'ARTICLE' AND (status = 'published' OR status IS NULL)
      GROUP BY "userId"
    `;
    const articleCounts = new Map(articleCountsRaw.map(r => [r.userId, Number(r.count)]));

    const authors = users.map(u => ({
      id: u.id,
      name: u.name,
      handle: u.handle,
      email: u.email,
      avatar: u.avatar || "",
      title: u.title || "",
      role: u.role,
      verified: u.verified,
      banned: u.banned,
      canPost: u.canPost,
      joinedDate: u.joinedDate ?? null,
      articleCount: articleCounts.get(u.id) ?? 0,
    }));

    return NextResponse.json({ authors });
  } catch (err) {
    console.error("[admin/authors GET]", err);
    return NextResponse.json({ error: "Failed to load authors" }, { status: 500 });
  }
}

// PATCH — update role / canPost / banned for a user
export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard.error) return guard.error;

  try {
    const body = await req.json();
    const { id, role, canPost, banned, banReason } = body;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const data: Record<string, any> = {};
    if (role !== undefined) {
      const validRoles = ["NORMAL", "CIRCLE", "AUTHOR", "ADMIN"];
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      data.role = role;
      // Authors and admins implicitly can post.
      if (role === "AUTHOR" || role === "ADMIN") data.canPost = true;
    }
    if (canPost !== undefined) data.canPost = !!canPost;
    if (banned !== undefined) {
      data.banned = !!banned;
      data.banReason = banned ? (banReason ?? "Disabled by admin") : null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    await prisma.user.update({ where: { id: Number(id) }, data });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[admin/authors PATCH]", err);
    return NextResponse.json({ error: err.message ?? "Failed to update" }, { status: 500 });
  }
}

// DELETE — delete a user
export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard.error) return guard.error;

  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    // Prevent deleting yourself
    if (id === guard.user!.id) {
      return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
    }

    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[admin/authors DELETE]", err);
    return NextResponse.json({ error: err.message ?? "Failed to delete user" }, { status: 500 });
  }
}
