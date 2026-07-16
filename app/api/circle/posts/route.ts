import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { blobStorageService } from "@/lib/blob-storage";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  if (authUser.role !== "CIRCLE" && authUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const circleUsers = await prisma.user.findMany({
    where: { role: "CIRCLE" },
    select: { id: true },
  });
  const circleUserIds = circleUsers.map((u: { id: number }) => u.id);

  if (!circleUserIds.length) {
    return NextResponse.json([]);
  }

  const posts = await prisma.post.findMany({
    where: {
      userId: { in: circleUserIds },
      status: "published",
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const transformed = posts.map((p: {
    image: string | null; id: number; userId: number;
    content: string | null; likes: string; comments: string; createdAt: Date;
  }) => {
    const finalImage = blobStorageService.resolveMediaUrl(p.image);
    return {
      id: p.id,
      memberId: p.userId,
      content: p.content || "",
      image: finalImage,
      stats: { likes: p.likes || "0", comments: p.comments || "0" },
      createdAt: p.createdAt,
    };
  });

  return NextResponse.json(transformed);
}
