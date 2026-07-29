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

async function getPermissionsWithCounts() {
  const [permissions, roleCounts] = await Promise.all([
    prisma.permission.findMany({
      orderBy: { id: "asc" },
      include: { rolePermissions: { select: { role: true } } },
    }),
    prisma.user.groupBy({
      by: ["role"],
      _count: { id: true },
    }),
  ]);

  return {
    permissions: permissions.map((p) => ({
      id: p.id,
      key: p.key,
      label: p.label,
      roles: p.rolePermissions.map((rp) => rp.role),
    })),
    roleCounts: Object.fromEntries(
      roleCounts.map((rc) => [rc.role, rc._count.id])
    ),
  };
}

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const data = await getPermissionsWithCounts();
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const { sync } = await req.json();
  if (!Array.isArray(sync)) {
    return NextResponse.json({ error: "Missing sync array" }, { status: 400 });
  }

  // Auto-create missing permissions (idempotent upsert)
  for (const { key, label } of sync) {
    if (!key || !label) continue;
    await prisma.permission.upsert({
      where: { key },
      create: { key, label },
      update: {},
    });
  }

  const data = await getPermissionsWithCounts();
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const { permissionId, role, enabled } = await req.json();

  if (!permissionId || !role || typeof enabled !== "boolean") {
    return NextResponse.json({ error: "Missing permissionId, role, or enabled" }, { status: 400 });
  }

  const permission = await prisma.permission.findUnique({ where: { id: permissionId } });
  if (!permission) {
    return NextResponse.json({ error: "Permission not found" }, { status: 404 });
  }

  if (enabled) {
    await prisma.rolePermission.upsert({
      where: { role_permissionId: { role, permissionId } },
      create: { role, permissionId },
      update: {},
    });
  } else {
    await prisma.rolePermission.deleteMany({
      where: { role, permissionId },
    });
  }

  return NextResponse.json({ ok: true });
}
