import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

// GET /api/users/search?q=... — search any non-banned user by name/handle (not Circle-only,
// unlike /api/users/circle). Used by the Story mention picker.
export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();

  const limit = await rateLimit(`user-search:${authUser.id}`, 60, 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(limit.error, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) },
    });
  }

  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim() ?? "";
  const exclude = Number(searchParams.get("exclude")) || 0;
  if (q.length < 1) return NextResponse.json([]);

  const users = await prisma.user.findMany({
    where: {
      banned: false,
      ...(exclude ? { id: { not: exclude } } : {}),
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { handle: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, handle: true, avatar: true, verified: true },
    orderBy: { name: "asc" },
    take: 20,
  });

  return NextResponse.json(users);
}
