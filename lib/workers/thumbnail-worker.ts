import { prisma } from "@/lib/prisma";
import { blobStorageService } from "@/lib/blob-storage";
import { generateVideoThumbnail } from "@/lib/video-thumbnail";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { enqueue, completeJob, type JobPayloads } from "@/lib/job-queue";

// Mirrors app/api/upload/route.ts's Azure-or-local-disk storage convention,
// since a server-generated thumbnail needs to land in the exact same place a
// user-picked one would (so every downstream reader treats them identically).
async function storeGeneratedThumbnail(buffer: Buffer, userId: number): Promise<string> {
  if (blobStorageService.isAvailable) {
    const blobName = `users/${userId}/posts/${blobStorageService.generateBlobName("thumbnail.jpg")}`;
    await blobStorageService.uploadFile(buffer, blobName, "image/jpeg");
    return blobStorageService.getFileUrl(blobName);
  }
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const localPath = join(process.cwd(), "public", "uploads", "posts", String(userId));
  await mkdir(localPath, { recursive: true });
  await writeFile(join(localPath, filename), buffer);
  return `/uploads/posts/${userId}/${filename}`;
}

export async function processGenerateThumbnailJob(payload: JobPayloads["generate-short-thumbnail"]): Promise<void> {
  const { shortId } = payload;

  const short = await prisma.short.findUnique({
    where: { id: shortId },
    select: { id: true, userId: true, videoUrl: true, thumbnailUrl: true },
  });
  if (!short) return; // deleted since this job was enqueued
  if (short.thumbnailUrl) return; // a thumbnail already exists (user-picked, or a prior run) — never overwrite

  const videoUrl = blobStorageService.resolveMediaUrl(short.videoUrl);
  if (!videoUrl) throw new Error("Short has no resolvable video URL");
  const absoluteUrl = videoUrl.startsWith("http")
    ? videoUrl
    : `${process.env.APP_URL || "http://localhost:3000"}${videoUrl}`;

  const res = await fetch(absoluteUrl);
  if (!res.ok) throw new Error(`Failed to fetch video for thumbnail generation: ${res.status}`);
  const videoBuffer = Buffer.from(await res.arrayBuffer());

  const ext = (short.videoUrl.split(".").pop() || "mp4").split("?")[0];
  const thumbBuffer = await generateVideoThumbnail(videoBuffer, ext);
  const thumbnailUrl = await storeGeneratedThumbnail(thumbBuffer, short.userId);

  // Re-check right before writing: an admin/uploader may have set a custom
  // thumbnail while this job was running the extraction above.
  await prisma.short.updateMany({
    where: { id: short.id, thumbnailUrl: null },
    data: { thumbnailUrl },
  });
}

// Enqueues the existing generate-short-thumbnail job (for admin visibility /
// retry bookkeeping via the job queue) and, since the per-minute dispatcher
// that would otherwise drain it isn't scheduled anywhere, also runs the same
// worker immediately so newly-created/edited Shorts get a thumbnail without
// waiting on that dispatcher. Safe to call unconditionally after enqueueing:
// processGenerateThumbnailJob() is a no-op once thumbnailUrl is already set.
export async function generateShortThumbnailNow(shortId: number): Promise<void> {
  const jobId = await enqueue("generate-short-thumbnail", { shortId }).catch(() => "");
  try {
    await processGenerateThumbnailJob({ shortId });
    if (jobId) await completeJob(jobId).catch(() => {});
  } catch (err) {
    // Leave the enqueued job pending — a future cron run or manual admin
    // replay (see app/api/admin/jobs) will retry it through the normal path.
    console.error(`[thumbnail-worker] Immediate generation failed for short #${shortId}:`, err);
  }
}
