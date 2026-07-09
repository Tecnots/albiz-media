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

function toKey(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

const VALID_ZONES = ["header", "sidebar", "body", "footer", "overlay"];

export async function GET(request: NextRequest) {
  // Previously unauthenticated — leaked ad placement-zone configuration to
  // anyone (audit finding C-5).
  const { error } = await requireAdAccess(request);
  if (error) return error;
  try {
    const zones = await prisma.adPlacementZone.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json(zones);
  } catch (error) {
    console.error("[PLACEMENTS_GET]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error } = await requireAdAccess(request);
    if (error) return error;

    const body = await request.json();
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const key = body.key ? String(body.key).trim() : toKey(name);
    if (!key) return NextResponse.json({ error: "Key is required" }, { status: 400 });

    const existing = await prisma.adPlacementZone.findUnique({ where: { key } });
    if (existing) return NextResponse.json({ error: "A placement with this key already exists" }, { status: 409 });

    const agg = await prisma.adPlacementZone.aggregate({ _max: { sortOrder: true } });
    const sortOrder = (agg._max.sortOrder ?? -1) + 1;

    const zone = await prisma.adPlacementZone.create({
      data: {
        name,
        key,
        description: body.description ? String(body.description) : null,
        zone: VALID_ZONES.includes(body.zone) ? body.zone : "body",
        positionX: typeof body.positionX === "number" ? Math.min(1, Math.max(0, body.positionX)) : 0.5,
        positionY: typeof body.positionY === "number" ? Math.min(1, Math.max(0, body.positionY)) : 0.5,
        width: body.width ? Math.max(1, parseInt(String(body.width))) : null,
        height: body.height ? Math.max(1, parseInt(String(body.height))) : null,
        isActive: true,
        sortOrder,
      },
    });

    return NextResponse.json(zone);
  } catch (error) {
    console.error("[PLACEMENTS_POST]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
