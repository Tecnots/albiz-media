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

  try {
    const assignments = await prisma.editorSectionAssignment.findMany({
      where: { sectionId },
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
