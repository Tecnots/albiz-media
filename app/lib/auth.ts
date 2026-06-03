import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function getAuthUser(request?: NextRequest) {
  try {
    let userId: number | null = null;

    // 1. Try user-id header first (for Capacitor mobile app requests)
    // Checking this first avoids calling auth() which can throw CSRF validation errors on POST requests
    if (request) {
      try {
        const headerUserId = request.headers.get("user-id");
        if (headerUserId) {
          userId = parseInt(headerUserId);
        }
      } catch (headerErr) {
        console.error("Auth - Error reading user-id header:", headerErr);
      }
    }

    // 2. Fallback to NextAuth session if no header is present
    if (!userId) {
      try {
        const session = await auth();
        if (session?.user) {
          userId = parseInt((session.user as any).id);
        }
      } catch (authErr) {
        console.error("Auth - NextAuth session check failed:", authErr);
      }
    }

    if (!userId || isNaN(userId)) return null;

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
