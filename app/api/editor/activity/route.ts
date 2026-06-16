import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "EDITOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const limitParam = parseInt(searchParams.get("limit") ?? "20");
  const limit = isNaN(limitParam) ? 20 : Math.min(Math.max(limitParam, 1), 100);

  try {
    const activity = await prisma.editorActivity.findMany({
      where: { editorId: user.id },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        action: true,
        createdAt: true,
        post: {
          select: {
            id: true,
            title: true,
            section: { select: { id: true, name: true, color: true } },
          },
        },
      },
    });
    return NextResponse.json({ activity });
  } catch (err) {
    console.error("[editor/activity GET]", err);
    return NextResponse.json({ error: "Failed to load activity" }, { status: 500 });
  }
}
