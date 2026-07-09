import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";
import { enqueue } from "@/lib/job-queue";

const ALLOWED_ROLES = ["UPLOADER", "ADMIN"];
const SUBMITTABLE_STATUSES = ["draft", "rejected"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(authUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const shortId = parseInt(id);
  if (isNaN(shortId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const short = await prisma.short.findUnique({ where: { id: shortId } });
  if (!short) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (short.userId !== authUser.id && authUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!SUBMITTABLE_STATUSES.includes(short.status)) {
    return NextResponse.json({ error: "Only draft or rejected shorts can be submitted for review" }, { status: 422 });
  }
  if (!short.title?.trim()) {
    return NextResponse.json({ error: "Short must have a title before submitting" }, { status: 400 });
  }
  if (!short.videoUrl?.trim()) {
    return NextResponse.json({ error: "Short must have a video before submitting" }, { status: 400 });
  }

  // Optimistic lock: guard the write on the status we just validated so a
  // concurrent request can't race past the SUBMITTABLE_STATUSES check above
  // (security hardening pass — consistent with the lock added to the admin
  // transition route).
  const result = await prisma.short.updateMany({
    where: { id: shortId, status: short.status },
    data: { status: "in_review", rejectionNote: null },
  });
  if (result.count === 0) {
    return NextResponse.json(
      { error: "This short's status changed since you last loaded it. Refresh and try again." },
      { status: 409 }
    );
  }
  const updated = await prisma.short.findUnique({ where: { id: shortId } });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Safety net: covers the rare case where the create-time enqueue was
  // missed or its job died silently — never leave a submitted short without
  // a thumbnail.
  if (!updated.thumbnailUrl) {
    await enqueue("generate-short-thumbnail", { shortId: updated.id }).catch((e) =>
      console.error("[shorts submit] thumbnail enqueue failed:", e)
    );
  }

  return NextResponse.json({ short: updated });
}
