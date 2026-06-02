import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { blobStorageService } from "@/lib/blob-storage";

function resolveAvatar(image: string | null): string | null {
  if (!image) return null;
  if (blobStorageService.isAvailable) {
    const blobName = blobStorageService.extractBlobName(image);
    if (blobName) return blobStorageService.getFileUrl(blobName);
  }
  return image;
}

// GET /api/user/mute  → list of muted users
export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();

  try {
    const rows = await prisma.$queryRaw<{
      mutedId: number; name: string; handle: string;
      avatar: string | null; verified: boolean; role: string;
    }[]>`
      SELECT um."mutedId", u.name, u.handle, u.avatar, u.verified, u.role
      FROM "UserMute" um
      JOIN "User" u ON u.id = um."mutedId"
      WHERE um."userId" = ${authUser.id}
      ORDER BY um."createdAt" DESC
    `;
    return NextResponse.json(
      rows.map(r => ({ ...r, avatar: resolveAvatar(r.avatar) }))
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/user/mute  body: { mutedId: number }
export async function POST(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const mutedId = parseInt(body.mutedId);
  if (isNaN(mutedId)) return NextResponse.json({ error: "Invalid mutedId" }, { status: 400 });

  const userId = authUser.id;
  if (userId === mutedId) return NextResponse.json({ error: "Cannot mute yourself" }, { status: 400 });

  try {
    await prisma.$executeRaw`
      INSERT INTO "UserMute" ("userId", "mutedId", "createdAt")
      VALUES (${userId}, ${mutedId}, NOW())
      ON CONFLICT ("userId", "mutedId") DO NOTHING
    `;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/user/mute  body: { mutedId: number }
export async function DELETE(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const mutedId = parseInt(body.mutedId);
  if (isNaN(mutedId)) return NextResponse.json({ error: "Invalid mutedId" }, { status: 400 });

  const userId = authUser.id;

  try {
    await prisma.$executeRaw`
      DELETE FROM "UserMute" WHERE "userId" = ${userId} AND "mutedId" = ${mutedId}
    `;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
