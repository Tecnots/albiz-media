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
  const { error } = await requireAdmin(req);
  if (error) return error;

  const permissions = await prisma.permission.findMany({
    orderBy: { id: "asc" },
    include: { rolePermissions: { select: { role: true } } },
  });

  return NextResponse.json({
    permissions: permissions.map((p) => ({
      id: p.id,
      key: p.key,
      label: p.label,
      roles: p.rolePermissions.map((rp) => rp.role),
    })),
  });
}

export async function PATCH(req: NextRequest) {
  const { user, error } = await requireAdmin(req);
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
