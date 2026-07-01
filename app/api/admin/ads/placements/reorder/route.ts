import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

async function requireAdAccess(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return { error: unauthorized() as Response, authUser: null };
  if (authUser.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), authUser: null };
  }
  return { error: null, authUser };
}

export async function POST(request: NextRequest) {
  try {
    const { error } = await requireAdAccess(request);
    if (error) return error;

    const body = await request.json();
    const ids: number[] = Array.isArray(body.ids)
      ? body.ids.map(Number).filter((n: number) => !isNaN(n))
      : [];

    if (ids.length === 0) return NextResponse.json({ error: "ids array required" }, { status: 400 });

    await prisma.$transaction(
      ids.map((id, i) =>
        prisma.adPlacementZone.update({ where: { id }, data: { sortOrder: i } }),
      ),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[PLACEMENTS_REORDER]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
