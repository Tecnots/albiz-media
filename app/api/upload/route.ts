import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { blobStorageService, MAX_UPLOAD_SIZE } from "@/lib/blob-storage";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

// category: avatar | cover | posts | videos | highlights | stories | misc
const VALID_CATEGORIES = ["avatar", "cover", "posts", "videos", "highlights", "stories", "messages", "misc"];

export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const userId = String(authUser.id);
    const category = (formData.get("category") as string) || "misc";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_UPLOAD_SIZE) {
      const maxMB = Math.round(MAX_UPLOAD_SIZE / (1024 * 1024));
      return NextResponse.json(
        { error: `File too large. Maximum size is ${maxMB}MB.` },
        { status: 400 },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const folder = VALID_CATEGORIES.includes(category) ? category : "misc";

    // Determine if video
    const isVideo = file.type.startsWith("video/");
    const actualFolder = isVideo ? "videos" : folder;

    // Azure Storage upload (if configured)
    if (blobStorageService.isAvailable) {
      try {
        const blobFilename = blobStorageService.generateBlobName(file.name);
        const blobName = `users/${userId}/${actualFolder}/${blobFilename}`;

        // Upload with retry logic
        await blobStorageService.uploadFile(buffer, blobName, file.type);

        // Generate SAS URL
        const url = blobStorageService.getFileUrl(blobName);

        // Create BlobInfo audit record
        try {
          await prisma.blobInfo.create({
            data: {
              blobName,
              container: blobStorageService.containerName,
              filename: file.name,
              contentType: file.type,
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
    return NextResponse.json({ error: err.message || "Upload failed" }, { status: 500 });
  }
}
