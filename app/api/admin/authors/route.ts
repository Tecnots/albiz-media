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

// GET — paginated AUTHOR-role users for admin management
export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard.error) return guard.error;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
  const skipPagination = searchParams.get("all") === "1";
  const offset = (page - 1) * limit;

  try {
    const where: any = { role: "AUTHOR" };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { handle: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { id: "desc" },
        ...(skipPagination ? {} : { skip: offset, take: limit }),
        select: {
          id: true,
          name: true,
          handle: true,
          email: true,
          avatar: true,
          title: true,
          bio: true,
          location: true,
          website: true,
          role: true,
          verified: true,
          banned: true,
          banReason: true,
          canPost: true,
          joinedDate: true,
          followers: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    // Published-article counts per user (scan is efficient since it's a COUNT with no joins)
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
      bio: u.bio || "",
      location: u.location || "",
      website: u.website || "",
      role: u.role,
      verified: u.verified,
      banned: u.banned,
      banReason: u.banReason || null,
      canPost: u.canPost,
      joinedDate: u.joinedDate ?? null,
      articleCount: articleCounts.get(u.id) ?? 0,
      followers: Number(u.followers ?? 0),
    }));

    return NextResponse.json({
      authors,
      total,
      page: skipPagination ? 1 : page,
      limit: skipPagination ? total : limit,
      pages: skipPagination ? 1 : Math.ceil(total / limit),
    });
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

    const data: Record<string, unknown> = {};
    if (role !== undefined) {
      const validRoles = ["NORMAL", "CIRCLE", "AUTHOR", "EDITOR", "ADMIN"];
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      data.role = role;
      // Authors and admins can publish; editors and below cannot by default
      if (role === "AUTHOR" || role === "ADMIN") data.canPost = true;
      else data.canPost = false;
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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update";
    console.error("[admin/authors PATCH]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
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

    if (id === guard.user!.id) {
      return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
    }

    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete user";
    console.error("[admin/authors DELETE]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}