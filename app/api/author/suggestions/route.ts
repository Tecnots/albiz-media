import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

async function requireAuthor(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return { error: unauthorized() };
  if (user.role !== "AUTHOR" && user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

// GET /api/author/suggestions — fetch suggestions for the current author
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuthor(req);
  if (error) return error;

  const suggestions = await (prisma as any).authorSuggestion.findMany({
    where: { authorId: user!.id },
    orderBy: { createdAt: "desc" },
    include: {
      admin: { select: { id: true, name: true, avatar: true } },
    },
  });

  return NextResponse.json(suggestions);
}

// PATCH /api/author/suggestions — update status (accepted | completed | dismissed)
export async function PATCH(req: NextRequest) {
  const { user, error } = await requireAuthor(req);
  if (error) return error;

  const { id, status } = await req.json();
  if (!id || !["accepted", "completed", "dismissed"].includes(status)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const suggestion = await (prisma as any).authorSuggestion.findUnique({ where: { id } });
  if (!suggestion || suggestion.authorId !== user!.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await (prisma as any).authorSuggestion.update({
    where: { id },
    data: { status },
  });

  return NextResponse.json(updated);
}
