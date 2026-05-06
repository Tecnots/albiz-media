import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/users/circle — returns all CIRCLE users for new-conversation picker
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const exclude = Number(searchParams.get("exclude")) || 0;
  const q = searchParams.get("q")?.trim().toLowerCase() || "";

  const users = await prisma.user.findMany({
    where: {
      role: "CIRCLE",
      banned: false,
      ...(exclude ? { id: { not: exclude } } : {}),
    },
    select: {
      id: true,
      name: true,
      handle: true,
      title: true,
      avatar: true,
      verified: true,
      lastSeenAt: true,
    },
    orderBy: { name: "asc" },
  });

  const filtered = q
    ? users.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.handle.toLowerCase().includes(q)
      )
    : users;

  return NextResponse.json(filtered);
}
