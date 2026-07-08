import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { blobStorageService } from "@/lib/blob-storage";

/**
 * POST /api/blob/retrieve
 * Body: { blobName: string }
 * Returns a fresh SAS URL for the given blob (cached internally).
 */
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  try {
    const body = await request.json();
    const { blobName } = body;

    if (!blobName || typeof blobName !== "string") {
      return NextResponse.json({ error: "blobName is required" }, { status: 400 });
    }

    // Enforce ownership — admins may retrieve any blob; regular users only their own
    if (authUser.role !== "ADMIN" && !blobName.startsWith(`users/${authUser.id}/`)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!blobStorageService.isAvailable) {
      return NextResponse.json({ error: "Azure Blob Storage is not configured" }, { status: 503 });
    }

    // Check blob exists
    const exists = await blobStorageService.fileExists(blobName);
    if (!exists) {
      return NextResponse.json({ error: "Blob not found" }, { status: 404 });
    }

    // Get properties + SAS URL
    const props = await blobStorageService.getBlobProperties(blobName);
    const url = blobStorageService.getFileUrl(blobName);

    return NextResponse.json({
      blobName,
      url,
      size: Number(props.size),
      contentType: props.contentType,
      createdAt: props.createdAt?.toISOString(),
    });
  } catch (err: any) {
    console.error("[Blob Retrieve] Error:", err);
    return NextResponse.json({ error: "Failed to retrieve blob" }, { status: 500 });
  }
}
