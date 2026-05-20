import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const INITIAL_COLORS = ["#F44444","#F97316","#EAB308","#22C55E","#3B82F6","#8B5CF6","#EC4899","#14B8A6"];

export async function GET() {
  const users = await prisma.user.findMany({
    where: { role: "CIRCLE", banned: false },
    select: {
      id: true,
      name: true,
      handle: true,
      avatar: true,
      title: true,
      verified: true,
    },
    orderBy: { followers: "desc" },
  });

  const members = users.map((user, i) => ({
    id: user.id,
    name: user.name,
    handle: user.handle,
    avatar: user.avatar || "",
    title: user.title || "",
    verified: user.verified,
    rank: i + 1,
    hasInitial: !user.avatar,
    initial: user.name.charAt(0).toUpperCase(),
    initialBg: INITIAL_COLORS[i % INITIAL_COLORS.length],
  }));

  return NextResponse.json(members);
}
