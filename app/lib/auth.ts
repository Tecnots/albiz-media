import { getToken } from "next-auth/jwt";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function getAuthUser(req: NextRequest) {
  try {
    console.log("Auth - Getting token with NEXTAUTH_SECRET:", process.env.NEXTAUTH_SECRET ? "exists" : "missing");
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    console.log("Auth - Token result:", token);
    
    let userId = token?.sub ? parseInt(token.sub) : NaN;

    if (isNaN(userId)) {
      const userHeader = req.headers.get("user-id") || req.headers.get("User-Id") || req.headers.get("x-user-id");
      if (userHeader) {
        userId = parseInt(userHeader);
        console.log("Auth - Found userId from header fallback:", userId);
      }
    }

    if (isNaN(userId)) {
      console.log("Auth - No token.sub or user-id header found");
      return null;
    }

    console.log("Auth - Checking user ID:", userId);

    // Use raw query to match correct table name
    const users = await prisma.$queryRaw<any[]>`
      SELECT id, role, "canPost", banned, "banReason", handle, name, email 
      FROM "User" 
      WHERE id = ${userId}
    `;

    const user = users[0];
    console.log("Auth - Found user:", user);

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
