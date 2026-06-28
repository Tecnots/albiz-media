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

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard.error) return guard.error;

  const { searchParams } = new URL(req.url);
  const editorId = searchParams.get("editorId");

  if (editorId) {
    const id = Number(editorId);
    if (!id) return NextResponse.json({ error: "Invalid editorId" }, { status: 400 });
    try {
      const [posts, activity] = await Promise.all([
        prisma.post.findMany({
          where: { assignedEditorId: id },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true, title: true, status: true, createdAt: true,
            section: { select: { name: true, color: true } },
          },
        }),
        prisma.editorActivity.findMany({
          where: { editorId: id },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true, action: true, createdAt: true,
            post: { select: { id: true, title: true } },
          },
        }),
      ]);
      return NextResponse.json({ posts, activity });
    } catch (err) {
      console.error("[admin/editors GET detail]", err);
      return NextResponse.json({ error: "Failed to load editor detail" }, { status: 500 });
    }
  }

  try {
    const editors = await prisma.user.findMany({
      where: { role: "EDITOR" },
      orderBy: { id: "desc" },
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
        verified: true,
        banned: true,
        banReason: true,
        joinedDate: true,
        followers: true,
        editorAssignments: {
          select: {
            id: true,
            sectionId: true,
            canPublish: true,
            section: {
              select: { id: true, name: true, slug: true, color: true },
            },
          },
        },
        _count: {
          select: {
            assignedPosts: true,
            sentEditorNotes: true,
            editorActivity: true,
          },
        },
      },
    });

    return NextResponse.json({
      editors: editors.map(e => ({
        id: e.id,
        name: e.name,
        handle: e.handle,
        email: e.email,
        avatar: e.avatar || "",
        title: e.title || "",
        bio: e.bio || "",
        location: e.location || "",
        website: e.website || "",
        verified: e.verified,
        banned: e.banned,
        banReason: e.banReason || null,
        joinedDate: e.joinedDate ?? null,
        followers: Number(e.followers ?? 0),
        assignments: e.editorAssignments.map(a => ({
          id: a.id,
          sectionId: a.sectionId,
          canPublish: a.canPublish,
          section: a.section,
        })),
        assignedPostCount: e._count.assignedPosts,
        noteCount: e._count.sentEditorNotes,
        activityCount: e._count.editorActivity,
      })),
    });
  } catch (err) {
    console.error("[admin/editors GET]", err);
    return NextResponse.json({ error: "Failed to load editors" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard.error) return guard.error;

  try {
    const body = await req.json();
    const { id, role, banned, banReason, addSection, removeSection, updateSection } = body;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    if (addSection) {
      const { sectionId, canPublish } = addSection;
      await prisma.editorSectionAssignment.upsert({
        where: { editorId_sectionId: { editorId: Number(id), sectionId: Number(sectionId) } },
        update: { canPublish: !!canPublish },
        create: { editorId: Number(id), sectionId: Number(sectionId), canPublish: !!canPublish },
      });
      return NextResponse.json({ success: true });
    }

    if (removeSection !== undefined) {
      await prisma.editorSectionAssignment.deleteMany({
        where: { editorId: Number(id), sectionId: Number(removeSection) },
      });
      return NextResponse.json({ success: true });
    }

    if (updateSection) {
      const { sectionId, canPublish } = updateSection;
      await prisma.editorSectionAssignment.update({
        where: { editorId_sectionId: { editorId: Number(id), sectionId: Number(sectionId) } },
        data: { canPublish: !!canPublish },
      });
      return NextResponse.json({ success: true });
    }

    const data: Record<string, unknown> = {};
    if (role !== undefined) {
      const validRoles = ["NORMAL", "CIRCLE", "AUTHOR", "ADMIN", "EDITOR"];
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      data.role = role;
      if (role === "AUTHOR" || role === "ADMIN") data.canPost = true;
      else if (role !== "EDITOR") data.canPost = false;
    }
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
    console.error("[admin/editors PATCH]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

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
    const msg = err instanceof Error ? err.message : "Failed to delete";
    console.error("[admin/editors DELETE]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
