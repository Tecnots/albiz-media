import { auth } from "@/auth";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function getAuthUser(_req?: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return null;

    const userId = parseInt((session.user as any).id);
    if (isNaN(userId)) return null;

    const users = await prisma.$queryRaw<any[]>`
      SELECT id, role, "canPost", banned, handle, name, email
      FROM "User"
      WHERE id = ${userId}
    `;

    const user = users[0];
    if (!user || user.banned) return null;
    return user;
  } catch (error) {
    console.error("Auth - Error getting user:", error);
    return null;
  }
}

export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
