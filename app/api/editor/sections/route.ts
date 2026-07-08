import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "EDITOR" && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [assignments, allSections] = await Promise.all([
    prisma.editorSectionAssignment.findMany({
      where: { editorId: user.id },
      select: { sectionId: true, canPublish: true },
    }),
    prisma.articleSection.findMany({
      select: { id: true, name: true, color: true },
    }),
  ]);

  const sectionMap = new Map(allSections.map(s => [s.id, s]));
  const sections = assignments.map(a => {
    const s = sectionMap.get(a.sectionId);
    return {
      sectionId: a.sectionId,
      name: s?.name ?? `Section ${a.sectionId}`,
      color: s?.color ?? "#525252",
      canPublish: a.canPublish,
    };
  });

  return NextResponse.json({ sections });
}
