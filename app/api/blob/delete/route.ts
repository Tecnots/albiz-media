import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { blobStorageService } from "@/lib/blob-storage";
import { prisma } from "@/lib/prisma";

/**
 * DELETE /api/blob/delete
 * Body: { blobName: string }
 * Permanently deletes the blob from Azure and soft-deletes the BlobInfo record.
 */
export async function DELETE(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  try {
    const body = await request.json();
    const { blobName } = body;

    if (!blobName || typeof blobName !== "string") {
      return NextResponse.json({ error: "blobName is required" }, { status: 400 });
    }

    if (!blobStorageService.isAvailable) {
      return NextResponse.json({ error: "Azure Blob Storage is not configured" }, { status: 503 });
    }

    // Check blob exists in Azure
    const exists = await blobStorageService.fileExists(blobName);
    if (!exists) {
      return NextResponse.json({ error: "Blob not found" }, { status: 404 });
    }

    // Delete from Azure (permanent)
    await blobStorageService.deleteFile(blobName);

    // Soft-delete the BlobInfo record if it exists
    try {
      await prisma.blobInfo.updateMany({
        where: { blobName, deletedAt: null },
        data: { deletedAt: new Date() },
      });
    } catch (dbErr) {
      // Don't fail the delete if audit record update fails
      console.error("[Blob Delete] Failed to soft-delete BlobInfo:", dbErr);
    }

    return NextResponse.json({ message: "File deleted successfully", blobName });
  } catch (err: any) {
    console.error("[Blob Delete] Error:", err);
    return NextResponse.json({ error: "Failed to delete blob" }, { status: 500 });
  }
}
