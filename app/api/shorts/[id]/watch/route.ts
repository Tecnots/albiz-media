import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";

const VALID_ACTIONS = new Set([
  "view", "like", "share", "comment", "skip", "complete",
  "follow_after", "not_interested",
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const shortId = parseInt(id);
  if (isNaN(shortId)) {
    return NextResponse.json({ error: "Invalid short ID" }, { status: 400 });
  }

  const authUser = await getAuthUser(req).catch(() => null);
  const userId   = authUser?.id ?? null;
  const sessionId = req.cookies.get("session_id")?.value ?? null;

  // Require at least one identifier for rate-limiting purposes
  if (!userId && !sessionId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is valid for a bare "view" event
  }

  const action     = VALID_ACTIONS.has(body.action) ? (body.action as string) : "view";
  const watchedMs  = Math.max(0, parseInt(body.watchedMs  ?? "0") || 0);
  const durationMs = Math.max(0, parseInt(body.durationMs ?? "0") || 0);
  const watchPct   = durationMs > 0 ? Math.min(1, watchedMs / durationMs) : (Number(body.watchPct) || 0);
  const completed  = Boolean(body.completed ?? (watchPct >= 0.9));
  const loopCount  = Math.min(20, Math.max(0, parseInt(body.loopCount ?? "0") || 0));
  const fastSkip   = Boolean(body.fastSkip ?? (action === "skip" && watchedMs < 2000));

  try {
    // A Short's view counter should only ever increment once per
    // authenticated user — reopening the same Short later must not keep
    // bumping it. Check for a prior view/complete event from this user
    // BEFORE inserting the current one (anonymous/session-only viewers keep
    // the previous always-increment behavior — this is scoped to logged-in
    // users, per the reported bug).
    let countsAsNewView = false;
    if (action === "view" || action === "complete") {
      if (userId) {
        const existing = await prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*)::bigint AS count FROM "ShortWatchEvent"
          WHERE "shortId" = ${shortId} AND "userId" = ${userId} AND action IN ('view', 'complete')
        `;
        countsAsNewView = Number(existing[0]?.count ?? 0) === 0;
      } else {
        countsAsNewView = true;
      }
    }

    await prisma.$executeRaw`
      INSERT INTO "ShortWatchEvent"
        ("shortId", "userId", "sessionId", "action", "watchedMs", "durationMs",
         "watchPct", "completed", "loopCount", "fastSkip", "createdAt")
      VALUES
        (${shortId}, ${userId}, ${sessionId}, ${action}, ${watchedMs}, ${durationMs},
         ${watchPct}, ${completed}, ${loopCount}, ${fastSkip}, NOW())
    `;

    if (countsAsNewView) {
      await prisma.$executeRaw`
        UPDATE "Short" SET views = views + 1 WHERE id = ${shortId}
      `.catch(() => {});
    }

    return NextResponse.json({ ok: true, counted: countsAsNewView });
  } catch (err: any) {
    // Foreign key violation → short doesn't exist
    if (err?.code === "23503" || err?.meta?.cause?.includes("not found")) {
      return NextResponse.json({ error: "Short not found" }, { status: 404 });
    }
    console.error("[shorts/watch]", err);
    return NextResponse.json({ error: "Failed to record event" }, { status: 500 });
  }
}