import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function getAuthUser(request?: NextRequest) {
  try {
    const cookie = request?.headers.get("cookie") || "";
    
    const sessionRes = await fetch(`${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/auth/session`, {
      headers: { cookie },
    });
    
    if (!sessionRes.ok) return null;
    
    const session = await sessionRes.json();
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
