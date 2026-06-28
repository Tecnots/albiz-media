import { prisma } from "./lib/prisma";

async function main() {
  const userId = 1; // Try to find a user that has followers
  const followers = await prisma.userFollow.findMany({
    select: { followerId: true, followingId: true },
    take: 10
  });
  console.log("Followers found:", followers);
  
  if (followers.length > 0) {
    const testUserId = followers[0].followingId;
    console.log("Testing with followingId:", testUserId);
    
    const pushFollowers = await prisma.$queryRaw<{ id: number }[]>`
      SELECT u.id
      FROM "UserFollow" uf
      JOIN "User" u ON u.id = uf."followerId"
      WHERE uf."followingId" = ${testUserId}
        AND (
          u."notificationPrefs" IS NULL
          OR u."notificationPrefs"->'push'->>'posts' IS NULL
          OR (u."notificationPrefs"->'push'->>'posts')::boolean = true
        )
    `;
    console.log("pushFollowers count:", pushFollowers.length);
    console.log("pushFollowers:", pushFollowers);
    
    // Check if these followers have tokens
    for (const f of pushFollowers) {
      const tokens = await prisma.pushToken.findMany({ where: { userId: f.id } });
      console.log(`User ${f.id} has ${tokens.length} tokens`);
    }
  }
}
main().catch(console.error);
