import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { blobStorageService } from "@/lib/blob-storage";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

// GET /api/users/circle?q=&skip=&limit= — paginated CIRCLE-member search for the
// new-conversation picker. Filtering and paging happen in the database so the
// full member table is never loaded into memory.
export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();

  const { searchParams } = req.nextUrl;
  const exclude = Number(searchParams.get("exclude")) || 0;
  const q = searchParams.get("q")?.trim() || "";
  const skip = Math.max(Number(searchParams.get("skip")) || 0, 0);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  const where = {
    role: "CIRCLE" as const,
    banned: false,
    ...(exclude ? { id: { not: exclude } } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { handle: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  // Fetch one extra row to know whether another page exists.
  const rows = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      handle: true,
      title: true,
      avatar: true,
      verified: true,
      lastSeenAt: true,
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    skip,
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const users = hasMore ? rows.slice(0, limit) : rows;
  for (const u of users) {
    u.avatar = blobStorageService.resolveMediaUrl(u.avatar) ?? u.avatar;
  }

  return NextResponse.json({ users, hasMore });
}
