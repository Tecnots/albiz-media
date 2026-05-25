import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { blobStorageService } from "@/lib/blob-storage";

export async function GET() {
  const posts = await prisma.circlePost.findMany({
    include: { member: true },
    orderBy: { id: "asc" },
  });

  // Map circle member names to user IDs so posts can be matched with user-based circleMembers
  const users = await prisma.user.findMany({
    where: { role: "CIRCLE" },
    select: { id: true, name: true },
  });
  const userMap = new Map(users.map(u => [u.name, u.id]));

  const transformed = posts.map(p => {
    let finalImage = p.image;
    if (finalImage && blobStorageService.isAvailable) {
      const blobName = blobStorageService.extractBlobName(finalImage);
      if (blobName) {
        finalImage = blobStorageService.getFileUrl(blobName);
      }
    }
    
    return {
      memberId: userMap.get(p.member.name) || p.memberId,
      content: p.content,
      image: finalImage,
      stats: { likes: p.likes, comments: p.comments },
    };
  });

  return NextResponse.json(transformed);
}
