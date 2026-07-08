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

const VALID_ZONES = ["header", "sidebar", "body", "footer", "overlay"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { error } = await requireAdAccess(request);
    if (error) return error;

    const { id: rawId } = await params;
    const id = parseInt(rawId);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.description !== undefined) data.description = body.description ? String(body.description) : null;
    if (body.zone !== undefined && VALID_ZONES.includes(body.zone)) data.zone = body.zone;
    if (typeof body.positionX === "number") data.positionX = Math.min(1, Math.max(0, body.positionX));
    if (typeof body.positionY === "number") data.positionY = Math.min(1, Math.max(0, body.positionY));
    if (body.width !== undefined) data.width = body.width ? Math.max(1, parseInt(String(body.width))) : null;
    if (body.height !== undefined) data.height = body.height ? Math.max(1, parseInt(String(body.height))) : null;
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;

    const zone = await prisma.adPlacementZone.update({ where: { id }, data });
    return NextResponse.json(zone);
  } catch (error) {
    console.error("[PLACEMENTS_PATCH]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { error } = await requireAdAccess(request);
    if (error) return error;

    const { id: rawId } = await params;
    const id = parseInt(rawId);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    await prisma.adPlacementZone.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[PLACEMENTS_DELETE]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
