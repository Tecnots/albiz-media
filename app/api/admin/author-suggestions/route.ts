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

// GET /api/admin/author-suggestions — list all suggestions sent by this admin
export async function GET(req: NextRequest) {
  const { user, error } = await requireAdmin(req);
  if (error) return error;

  const suggestions = await (prisma as any).authorSuggestion.findMany({
    where: { adminId: user!.id },
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { id: true, name: true, handle: true, avatar: true } },
    },
  });

  return NextResponse.json(suggestions);
}

// POST /api/admin/author-suggestions — send suggestion to author(s)
export async function POST(req: NextRequest) {
  const { user, error } = await requireAdmin(req);
  if (error) return error;

  const { authorIds, title, description, deadline } = await req.json();
  if (!title?.trim() || !authorIds?.length) {
    return NextResponse.json({ error: "title and authorIds are required" }, { status: 400 });
  }

  const created = await (prisma as any).authorSuggestion.createMany({
    data: (authorIds as number[]).map((authorId: number) => ({
      authorId,
      adminId: user!.id,
      title: title.trim(),
      description: description?.trim() || null,
      deadline: deadline?.trim() || null,
      status: "pending",
    })),
  });

  return NextResponse.json({ count: created.count });
}

// DELETE /api/admin/author-suggestions?id=X — remove a suggestion
export async function DELETE(req: NextRequest) {
  const { user, error } = await requireAdmin(req);
  if (error) return error;

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Previously deleted by id alone — any admin could delete any other
  // admin's suggestion, unlike GET which correctly scopes by adminId (audit
  // finding L-3).
  const result = await (prisma as any).authorSuggestion.deleteMany({ where: { id, adminId: user!.id } });
  if (result.count === 0) {
    return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
