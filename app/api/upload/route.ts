import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { blobStorageService, MAX_UPLOAD_SIZE, MAX_VIDEO_UPLOAD_SIZE } from "@/lib/blob-storage";
import { prisma } from "@/lib/prisma";
import { checkUploadAbuse } from "@/lib/abuse-detection";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

// category: avatar | cover | posts | videos | highlights | stories | ads | music | misc
const VALID_CATEGORIES = ["avatar", "cover", "posts", "videos", "highlights", "stories", "messages", "ads", "music", "misc"];

// Formats playable by the native <video> element across current browsers.
const ALLOWED_VIDEO_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v", "video/ogg"];
const ALLOWED_VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "m4v", "ogv", "ogg"];

// Safe raster image types — SVG is excluded because it can carry inline scripts.
const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const ALLOWED_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp"];
// Includes the formats MediaRecorder produces for voice messages: webm/opus
// (Chrome, Firefox, Android WebView) and mp4/aac (Safari, iOS WKWebView).
const ALLOWED_AUDIO_MIME_TYPES = ["audio/mpeg", "audio/mp4", "audio/aac", "audio/ogg", "audio/wav", "audio/webm"];
const ALLOWED_AUDIO_EXTENSIONS = ["mp3", "m4a", "aac", "ogg", "oga", "wav", "webm"];

const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-rar-compressed",
  "application/vnd.rar",
];
const ALLOWED_DOCUMENT_EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "zip", "rar"];

// A MediaRecorder blob's type often carries a codecs parameter
// (e.g. "audio/webm;codecs=opus"). Compare against the base MIME only.
function baseMime(mime: string): string {
  return mime.split(";")[0].trim().toLowerCase();
}

function hasValidImageSignature(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
  // GIF: 47 49 46 38
  if (buffer.subarray(0, 4).toString("ascii") === "GIF8") return true;
  // WebP: "RIFF" at 0 + "WEBP" at 8
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return true;
  return false;
}

// Verify the file's actual bytes match a known video container signature,
// so a renamed/mislabeled file can't ride through on a spoofed MIME type.
function hasValidVideoSignature(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  // ISO base media file format (mp4, mov, m4v): "ftyp" box at offset 4
  if (buffer.subarray(4, 8).toString("ascii") === "ftyp") return true;
  // WebM/Matroska: EBML header
  if (buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return true;
  // Ogg: "OggS" magic
  if (buffer.subarray(0, 4).toString("ascii") === "OggS") return true;
  return false;
}

export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  const uploadAbuse = await checkUploadAbuse(authUser.id);
  if (uploadAbuse.blocked) {
    return NextResponse.json({ error: uploadAbuse.reason }, {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil((uploadAbuse.retryAfterMs ?? 60_000) / 1000)) },
    });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const userId = String(authUser.id);
    const category = (formData.get("category") as string) || "misc";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const folder = VALID_CATEGORIES.includes(category) ? category : "misc";

    // Determine if video or audio (from the base MIME, ignoring codecs params)
    const mime = baseMime(file.type);
    const isVideo = mime.startsWith("video/");
    const isAudio = mime.startsWith("audio/");
    const isDocument = ALLOWED_DOCUMENT_MIME_TYPES.includes(mime) || ALLOWED_DOCUMENT_EXTENSIONS.includes(ext);
    const actualFolder = isVideo ? "videos" : folder;

    if (isVideo) {
      if (!ALLOWED_VIDEO_MIME_TYPES.includes(mime) || !ALLOWED_VIDEO_EXTENSIONS.includes(ext)) {
        return NextResponse.json(
          { error: "Unsupported video format. Use MP4, WebM, MOV, or OGG." },
          { status: 400 },
        );
      }
    } else if (isAudio) {
      if (!ALLOWED_AUDIO_MIME_TYPES.includes(mime) || !ALLOWED_AUDIO_EXTENSIONS.includes(ext)) {
        return NextResponse.json(
          { error: "Unsupported audio format. Use MP3, M4A, AAC, OGG, WAV, or WebM." },
          { status: 400 },
        );
      }
    } else if (isDocument) {
      if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(mime) || !ALLOWED_DOCUMENT_EXTENSIONS.includes(ext)) {
        return NextResponse.json(
          { error: "Unsupported document format. Use PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV, ZIP, or RAR." },
          { status: 400 },
        );
      }
    } else {
      if (!ALLOWED_IMAGE_MIME_TYPES.includes(mime) || !ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
        return NextResponse.json(
          { error: "Unsupported file type. Use JPEG, PNG, GIF, or WebP." },
          { status: 400 },
        );
      }
    }

    // Validate file size (videos get a larger allowance than other uploads)
    const maxSize = isVideo ? MAX_VIDEO_UPLOAD_SIZE : MAX_UPLOAD_SIZE;
    if (file.size > maxSize) {
      const maxMB = Math.round(maxSize / (1024 * 1024));
      return NextResponse.json(
        { error: `File too large. Maximum size is ${maxMB}MB.` },
        { status: 400 },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (isVideo && !hasValidVideoSignature(buffer)) {
      return NextResponse.json(
        { error: "File content doesn't match a valid video format." },
        { status: 400 },
      );
    }

    if (!isVideo && !isAudio && !isDocument && !hasValidImageSignature(buffer)) {
      return NextResponse.json(
        { error: "File content doesn't match a valid image format." },
        { status: 400 },
      );
    }

    // Azure Storage upload (if configured)
    if (blobStorageService.isAvailable) {
      try {
        const blobFilename = blobStorageService.generateBlobName(file.name);
        const blobName = `users/${userId}/${actualFolder}/${blobFilename}`;

        // Upload with retry logic
        await blobStorageService.uploadFile(buffer, blobName, mime);

        // Generate SAS URL
        const url = blobStorageService.getFileUrl(blobName);

        // Create BlobInfo audit record
        try {
          await prisma.blobInfo.create({
            data: {
              blobName,
              container: blobStorageService.containerName,
              filename: file.name,
              contentType: mime,
              size: BigInt(buffer.length),
              source: actualFolder,
              uploadedBy: authUser.id,
            },
          });
        } catch (dbErr) {
          // Don't fail the upload if audit record fails
          console.error("[Upload] Failed to create BlobInfo record:", dbErr);
        }

        return NextResponse.json({ url, blobName, category: actualFolder });
      } catch (azureErr: any) {
        console.error("Azure upload failed, falling back to local storage:", azureErr);
        // Fall through to local storage
      }
    }

    // Local file storage fallback
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 8);
    const filename = `${timestamp}-${random}.${ext}`;
    const localPath = join(process.cwd(), "public", "uploads", actualFolder, String(userId));

    await mkdir(localPath, { recursive: true });
    await writeFile(join(localPath, filename), buffer);

    const url = `/uploads/${actualFolder}/${userId}/${filename}`;

    return NextResponse.json({ url, category: actualFolder });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
