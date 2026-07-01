import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function getAuthUser(request?: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return null;

    const userId = parseInt((session.user as any).id);
    if (isNaN(userId)) return null;

    const users = await prisma.$queryRaw<any[]>`
      SELECT id, role, "canPost", banned, handle, name, email, "sessionVersion"
      FROM "User"
      WHERE id = ${userId}
    `;

    const user = users[0];
    if (!user || user.banned) return null;

    // Invalidate sessions whose version no longer matches the DB.
    // This fires when a password is changed, a ban is applied, or an admin
    // forces a logout by incrementing sessionVersion.
    const tokenVersion = (session.user as any).sessionVersion ?? 1;
    if (tokenVersion !== user.sessionVersion) return null;

    return user;
  } catch (error) {
    console.error("Auth - Error getting user:", error);
    return null;
  }
}

export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

/** Increment sessionVersion to immediately invalidate all existing JWTs for a user. */
export async function invalidateUserSessions(userId: number): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "User" SET "sessionVersion" = "sessionVersion" + 1 WHERE id = ${userId}
  `;
}
