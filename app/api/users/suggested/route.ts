import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const currentUserId = Number(request.nextUrl.searchParams.get("currentUserId"));
  
  // Fetch users excluding the current user
  const users = await prisma.user.findMany({
    where: currentUserId ? { id: { not: currentUserId } } : undefined,
    orderBy: { id: "asc" },
    take: 10, // Limit to 10 suggested users
  });

  // Transform to match frontend shape
  const transformed = users.map(u => ({
    id: u.id,
    name: u.name,
    handle: u.handle,
    title: u.title,
    avatar: u.avatar,
    verified: u.verified,
  }));

  return NextResponse.json(transformed);
}
