import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";

async function requireAdmin(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (user.role !== "ADMIN") return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user };
}

const TRANSITION_MAP: Record<string, { from: string[]; to: string }> = {
  approve:  { from: ["in_review"],           to: "approved"  },
  reject:   { from: ["in_review", "approved", "published"], to: "rejected"  },
  publish:  { from: ["approved"],            to: "published" },
  unpublish:{ from: ["published"],           to: "approved"  },
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin(request);
  if (guard.error) return guard.error;

  const { id } = await params;
  const shortId = parseInt(id);
  if (isNaN(shortId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const short = await prisma.short.findUnique({ where: { id: shortId } });
  if (!short) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { action, rejectionNote } = body;

  const transition = TRANSITION_MAP[action];
  if (!transition) {
    return NextResponse.json({ error: "Invalid action. Use: approve, reject, publish, unpublish" }, { status: 400 });
  }
  if (!transition.from.includes(short.status)) {
    return NextResponse.json({
      error: `Cannot ${action} a short in "${short.status}" status`,
    }, { status: 422 });
  }
  if (action === "reject" && !rejectionNote?.trim()) {
    return NextResponse.json({ error: "A rejection reason is required" }, { status: 400 });
  }

  const data: Record<string, any> = { status: transition.to };
  if (action === "reject") {
    data.rejectionNote = rejectionNote.trim().slice(0, 1000);
  }
  if (action === "approve" || action === "unpublish") {
    data.rejectionNote = null;
  }
  if (action === "publish") {
    data.publishedAt = new Date();
    data.rejectionNote = null;
  }

  const updated = await prisma.short.update({ where: { id: shortId }, data });
  return NextResponse.json({ short: updated });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin(request);
  if (guard.error) return guard.error;

  const { id } = await params;
  const shortId = parseInt(id);
  if (isNaN(shortId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const short = await prisma.short.findUnique({
    where: { id: shortId },
    include: {
      user: { select: { id: true, name: true, handle: true, avatar: true, email: true } },
    },
  });
  if (!short) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ short });
}
