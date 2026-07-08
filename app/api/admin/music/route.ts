import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { blobStorageService } from "@/lib/blob-storage";

// Music library management — ADMIN only, same gate as /api/admin/ads.
async function requireAdminAccess(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return { error: unauthorized() as Response, authUser: null };
  if (authUser.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), authUser: null };
  }
  return { error: null, authUser };
}

export async function GET(request: NextRequest) {
  const { error } = await requireAdminAccess(request);
  if (error) return error;

  const tracks = await prisma.musicTrack.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(
    tracks.map((t) => ({
      ...t,
      audioUrl: blobStorageService.resolveMediaUrl(t.audioUrl) ?? t.audioUrl,
      artworkUrl: t.artworkUrl ? blobStorageService.resolveMediaUrl(t.artworkUrl) : null,
    }))
  );
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdminAccess(request);
  if (error) return error;

  try {
    const { title, artist, category, durationMs, audioUrl, artworkUrl } = await request.json();
    if (!title?.trim() || !artist?.trim() || !category?.trim() || !audioUrl?.trim() || !Number.isFinite(durationMs) || durationMs <= 0) {
      return NextResponse.json({ error: "Missing or invalid track fields" }, { status: 400 });
    }

    const track = await prisma.musicTrack.create({
      data: { title: title.trim(), artist: artist.trim(), category: category.trim(), durationMs, audioUrl: audioUrl.trim(), artworkUrl: artworkUrl?.trim() || null },
    });
    return NextResponse.json(track, { status: 201 });
  } catch (err) {
    console.error("[ADMIN_MUSIC_POST]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const { error } = await requireAdminAccess(request);
  if (error) return error;

  try {
    const { id, active } = await request.json();
    if (!Number.isInteger(id) || typeof active !== "boolean") {
      return NextResponse.json({ error: "Missing id or active" }, { status: 400 });
    }
    const track = await prisma.musicTrack.update({ where: { id }, data: { active } });
    return NextResponse.json(track);
  } catch (err) {
    console.error("[ADMIN_MUSIC_PATCH]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
