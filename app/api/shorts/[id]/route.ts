import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";
import { blobStorageService } from "@/lib/blob-storage";
import { generateShortThumbnailNow } from "@/lib/workers/thumbnail-worker";
import { isSafeMediaUrl } from "@/lib/url-validation";

const ALLOWED_ROLES = ["UPLOADER", "ADMIN"];
const EDITABLE_STATUSES = ["draft", "rejected"];

async function resolveShort(id: number, userId: number, isAdmin: boolean) {
  const short = await prisma.short.findUnique({ where: { id } });
  if (!short) return { error: "Not found", status: 404 };
  if (!isAdmin && short.userId !== userId) return { error: "Forbidden", status: 403 };
  return { short };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(authUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const result = await resolveShort(parseInt(id), authUser.id, authUser.role === "ADMIN");
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const s = result.short as any;
  return NextResponse.json({ short: { ...s, videoUrl: blobStorageService.resolveMediaUrl(s.videoUrl), thumbnailUrl: blobStorageService.resolveMediaUrl(s.thumbnailUrl) } });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(authUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const result = await resolveShort(parseInt(id), authUser.id, authUser.role === "ADMIN");
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const { short } = result;
  if (!EDITABLE_STATUSES.includes(short.status) && authUser.role !== "ADMIN") {
    return NextResponse.json({ error: "This short cannot be edited in its current status" }, { status: 422 });
  }

  const body = await request.json();
  const { title, description, videoUrl, thumbnailUrl, format } = body;

  // Previously accepted any string with no protocol/host validation at all
  // (audit finding M-12). videoUrl is required and cannot be cleared, so an
  // explicit null/empty value is rejected outright rather than passed to
  // .trim(), which would throw and crash the request with a 500 instead of
  // a clean 400 (caught by this pass's own self-review).
  if (videoUrl !== undefined) {
    if (!videoUrl || !isSafeMediaUrl(String(videoUrl).trim())) {
      return NextResponse.json({ error: "Video URL must be a valid public http(s) URL" }, { status: 400 });
    }
  }
  if (thumbnailUrl !== undefined && thumbnailUrl && !isSafeMediaUrl(String(thumbnailUrl).trim())) {
    return NextResponse.json({ error: "Thumbnail URL must be a valid public http(s) URL" }, { status: 400 });
  }

  const VALID_FORMATS = ["vertical", "horizontal", "square"];
  const updates: Record<string, any> = {};
  if (title !== undefined)        updates.title        = title.trim().slice(0, 200);
  if (description !== undefined)  updates.description  = description?.trim().slice(0, 1000) ?? null;
  if (videoUrl !== undefined)     updates.videoUrl     = videoUrl.trim();
  if (thumbnailUrl !== undefined) updates.thumbnailUrl = thumbnailUrl?.trim() ?? null;
  if (format !== undefined && VALID_FORMATS.includes(format)) updates.format = format;

  const updated = await prisma.short.update({ where: { id: short.id }, data: updates }) as any;

  if (updates.videoUrl !== undefined && !updated.thumbnailUrl) {
    after(() => generateShortThumbnailNow(updated.id));
  }

  return NextResponse.json({ short: { ...updated, videoUrl: blobStorageService.resolveMediaUrl(updated.videoUrl), thumbnailUrl: blobStorageService.resolveMediaUrl(updated.thumbnailUrl) } });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(authUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const result = await resolveShort(parseInt(id), authUser.id, authUser.role === "ADMIN");
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const { short } = result;
  if (!EDITABLE_STATUSES.includes(short.status) && authUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Only draft or rejected shorts can be deleted" }, { status: 422 });
  }

  await prisma.short.delete({ where: { id: short.id } });
  return NextResponse.json({ success: true });
}
