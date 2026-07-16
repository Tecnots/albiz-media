import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN" && user.role !== "AUTHOR" && user.role !== "EDITOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sectionId = Number(req.nextUrl.searchParams.get("sectionId"));
  if (!sectionId) return NextResponse.json({ error: "sectionId required" }, { status: 400 });

  // AUTHOR needs this unscoped — they're choosing a destination section
  // before submitting and have no assignment of their own to check against.
  // EDITOR has no legitimate reason to browse another section's roster
  // through this endpoint, though — previously any EDITOR could pass an
  // arbitrary sectionId and enumerate every section's editor roster and
  // canPublish rights, not just their own (audit finding M-1).
  if (user.role === "EDITOR") {
    const ownAssignment = await prisma.editorSectionAssignment.findUnique({
      where: { editorId_sectionId: { editorId: user.id, sectionId } },
    });
    if (!ownAssignment) {
      return NextResponse.json({ error: "You are not assigned to this section" }, { status: 403 });
    }
  }

  try {
    const assignments = await prisma.editorSectionAssignment.findMany({
      where: { sectionId, editor: { banned: false } },
      select: {
        canPublish: true,
        editor: { select: { id: true, name: true, handle: true, avatar: true } },
      },
    });

    const editors = assignments.map(a => ({
      id: a.editor.id,
      name: a.editor.name,
      handle: a.editor.handle,
      avatar: a.editor.avatar,
      canPublish: a.canPublish,
    }));

    return NextResponse.json({ editors });
  } catch (err) {
    console.error("[editor/by-section GET]", err);
    return NextResponse.json({ error: "Failed to load editors" }, { status: 500 });
  }
}
