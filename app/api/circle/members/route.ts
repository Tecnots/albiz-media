import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      handle: true,
      avatar: true,
      title: true,
      verified: true,
    },
    orderBy: { name: "asc" },
  });

  // Transform to match expected format
  const members = users.map(user => ({
    id: user.id,
    name: user.name,
    handle: user.handle,
    avatar: user.avatar || "",
    title: user.title || "",
    verified: user.verified,
    hasInitial: !user.avatar,
    initial: user.name.charAt(0).toUpperCase(),
    initialBg: `hsl(${Math.random() * 360}, 70%, 50%)`,
  }));

  return NextResponse.json(members);
}
