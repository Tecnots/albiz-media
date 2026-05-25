import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { blobStorageService } from "@/lib/blob-storage";

/**
 * GET /api/blob/download?blob_name=...&download=true
 * Streams the raw file bytes through the server.
 * Set download=true to force browser to save the file.
 */
export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  try {
    const { searchParams } = request.nextUrl;
    const blobName = searchParams.get("blob_name");
    const forceDownload = searchParams.get("download") === "true";

    if (!blobName) {
      return NextResponse.json({ error: "blob_name query parameter is required" }, { status: 400 });
    }

    if (!blobStorageService.isAvailable) {
      return NextResponse.json({ error: "Azure Blob Storage is not configured" }, { status: 503 });
    }

    // Check blob exists
    const exists = await blobStorageService.fileExists(blobName);
    if (!exists) {
      return NextResponse.json({ error: "Blob not found" }, { status: 404 });
    }

    // Get properties for content-type
    const props = await blobStorageService.getBlobProperties(blobName);

    // Download raw bytes
    const buffer = await blobStorageService.downloadFile(blobName);

    // Build headers
    const headers: Record<string, string> = {
      "Content-Type": props.contentType,
      "Content-Length": String(buffer.length),
    };

    if (forceDownload) {
      // Extract a filename from the blob path
      const filename = blobName.split("/").pop() || "download";
      headers["Content-Disposition"] = `attachment; filename="${filename}"`;
    } else {
      headers["Content-Disposition"] = "inline";
    }

    return new NextResponse(buffer, { status: 200, headers });
  } catch (err: any) {
    console.error("[Blob Download] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to download blob" }, { status: 500 });
  }
}
