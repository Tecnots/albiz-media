import { NextRequest, NextResponse } from "next/server";
import { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } from "@azure/storage-blob";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = process.env.AZURE_STORAGE_CONTAINER || "media";

function parseConnectionString(cs: string) {
  const parts: Record<string, string> = {};
  cs.split(";").forEach(part => {
    const idx = part.indexOf("=");
    if (idx > 0) parts[part.slice(0, idx)] = part.slice(idx + 1);
  });
  return { accountName: parts.AccountName, accountKey: parts.AccountKey };
}

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

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const folder = VALID_CATEGORIES.includes(category) ? category : "misc";

    // Determine if video
    const isVideo = file.type.startsWith("video/");
    const actualFolder = isVideo ? "videos" : folder;

    // Azure Storage upload (if configured)
    if (connectionString) {
      try {
        // Structure: users/{userId}/{category}/{timestamp}-{random}.{ext}
        const blobName = `users/${userId}/${actualFolder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const blobService = BlobServiceClient.fromConnectionString(connectionString);
        const container = blobService.getContainerClient(containerName);
        await container.createIfNotExists();

        const blockBlob = container.getBlockBlobClient(blobName);
        await blockBlob.uploadData(buffer, {
          blobHTTPHeaders: { blobContentType: file.type },
        });

        // Generate 1-year SAS URL
        const { accountName, accountKey } = parseConnectionString(connectionString);
        const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
        const expiresOn = new Date();
        expiresOn.setFullYear(expiresOn.getFullYear() + 1);

        const sasToken = generateBlobSASQueryParameters({
          containerName,
          blobName,
          permissions: BlobSASPermissions.parse("r"),
          expiresOn,
        }, sharedKeyCredential).toString();

        const url = `${blockBlob.url}?${sasToken}`;

        return NextResponse.json({ url, category: actualFolder });
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
