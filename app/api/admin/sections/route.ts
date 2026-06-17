import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN" && user.role !== "AUTHOR" && user.role !== "EDITOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const sections = await prisma.articleSection.findMany({
      select: { id: true, name: true, slug: true, color: true, active: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ sections });
  } catch (err) {
    console.error("[admin/sections GET]", err);
    return NextResponse.json({ error: "Failed to load sections" }, { status: 500 });
  }
}
