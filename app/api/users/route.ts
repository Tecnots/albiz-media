import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { blobStorageService } from "@/lib/blob-storage";

export async function GET() {
  const users = await prisma.user.findMany({ orderBy: { id: "asc" } });

  // Transform to match frontend shape (exclude password)
  const transformed = users.map(u => {
    let avatarUrl = u.avatar;
    let coverPhotoUrl = u.coverPhoto;

    if (blobStorageService.isAvailable) {
      if (avatarUrl) {
        const blobName = blobStorageService.extractBlobName(avatarUrl);
        if (blobName) avatarUrl = blobStorageService.getFileUrl(blobName);
      }
      if (coverPhotoUrl) {
        const blobName = blobStorageService.extractBlobName(coverPhotoUrl);
        if (blobName) coverPhotoUrl = blobStorageService.getFileUrl(blobName);
      }
    }

    return {
      id: u.id,
      name: u.name,
      handle: u.handle,
      title: u.title,
      avatar: avatarUrl,
      verified: u.verified,
      isPremium: u.isPremium,
      hasStory: u.hasStory,
      role: u.role,
      bio: u.bio,
      location: u.location,
      website: u.website,
      coverPhoto: coverPhotoUrl,
      joinedDate: u.joinedDate,
      followers: u.followers,
      followingCount: u.followingCount,
    };
  });

  return NextResponse.json(transformed);
}
