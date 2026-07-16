import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";
import { blobStorageService } from "@/lib/blob-storage";
import { generateShortThumbnailNow } from "@/lib/workers/thumbnail-worker";
import { isSafeMediaUrl } from "@/lib/url-validation";
import { rateLimit } from "@/lib/rate-limit";

const ALLOWED_ROLES = ["UPLOADER", "ADMIN"];

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(authUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status  = searchParams.get("status") ?? undefined;
  const page    = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit   = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")));
  const skip    = (page - 1) * limit;

  const where = {
    userId: authUser.id,
    ...(status ? { status } : {}),
  };

  const [shorts, total] = await Promise.all([
    prisma.short.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true, title: true, description: true, videoUrl: true,
        thumbnailUrl: true, format: true, status: true,
        views: true, likes: true, shares: true,
        rejectionNote: true, publishedAt: true,
        createdAt: true, updatedAt: true,
      },
    }),
    prisma.short.count({ where }),
  ]);

  const resolvedShorts = shorts.map((s: any) => ({
    ...s,
    videoUrl: blobStorageService.resolveMediaUrl(s.videoUrl),
    thumbnailUrl: blobStorageService.resolveMediaUrl(s.thumbnailUrl),
  }));
  return NextResponse.json({ shorts: resolvedShorts, total, page, pages: Math.ceil(total / limit) });
}

export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(authUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // No rate limit previously existed on Short creation (security hardening pass).
  const limit = await rateLimit(`shorts:create:${authUser.id}`, 20, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(limit.error, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) },
    });
  }

  const body = await request.json();
  const { title, description, videoUrl, thumbnailUrl, format } = body;

  if (!title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (!videoUrl?.trim()) return NextResponse.json({ error: "Video is required" }, { status: 400 });
  // Previously these accepted any string with no protocol/host check at all
  // (audit finding M-12) — blobStorageService.resolveMediaUrl falls through
  // to returning unknown-format values verbatim, so an arbitrary internal or
  // link-local URL would be stored and later fetched as-is.
  if (!isSafeMediaUrl(videoUrl.trim())) {
    return NextResponse.json({ error: "Video URL must be a valid public http(s) URL" }, { status: 400 });
  }
  if (thumbnailUrl?.trim() && !isSafeMediaUrl(thumbnailUrl.trim())) {
    return NextResponse.json({ error: "Thumbnail URL must be a valid public http(s) URL" }, { status: 400 });
  }

  const VALID_FORMATS = ["vertical", "horizontal", "square"];
  const resolvedFormat = VALID_FORMATS.includes(format) ? format : "vertical";

  const short = await prisma.short.create({
    data: {
      title:       title.trim().slice(0, 200),
      description: description?.trim().slice(0, 1000) ?? null,
      videoUrl:    videoUrl.trim(),
      thumbnailUrl: thumbnailUrl?.trim() ?? null,
      format:      resolvedFormat,
      status:      "draft",
      userId:      authUser.id,
    },
  });

  if (!short.thumbnailUrl) {
    after(() => generateShortThumbnailNow(short.id));
  }

  return NextResponse.json({ short }, { status: 201 });
}
