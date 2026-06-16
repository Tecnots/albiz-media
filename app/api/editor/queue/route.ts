import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "EDITOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const assignments = await prisma.editorSectionAssignment.findMany({
      where: { editorId: user.id },
      select: { sectionId: true, canPublish: true },
    });

    if (assignments.length === 0) {
      return NextResponse.json({ articles: [] });
    }

    const sectionIds = assignments.map(a => a.sectionId);
    const canPublishMap: Record<number, boolean> = {};
    assignments.forEach(a => { canPublishMap[a.sectionId] = a.canPublish; });

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");

    const validStatuses = ["submitted", "under_review", "revision_requested", "approved", "published"];
    const statusesToFetch = statusFilter && validStatuses.includes(statusFilter)
      ? [statusFilter]
      : validStatuses;

    const posts = await prisma.post.findMany({
      where: {
        sectionId: { in: sectionIds },
        status: { in: statusesToFetch },
        type: "ARTICLE",
      },
      select: {
        id: true,
        title: true,
        description: true,
        image: true,
        status: true,
        sectionId: true,
        createdAt: true,
        date: true,
        user: { select: { id: true, name: true, avatar: true, handle: true } },
        section: { select: { id: true, name: true, color: true } },
        editorNotes: {
          orderBy: { createdAt: "desc" },
          select: { id: true, note: true, createdAt: true, resolvedAt: true },
        },
        articleContent: { select: { paragraphs: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const articles = posts.map(p => ({
      ...p,
      canPublish: p.sectionId ? (canPublishMap[p.sectionId] ?? false) : false,
      unresolvedNotes: p.editorNotes.filter(n => !n.resolvedAt).length,
      wordCount: p.articleContent?.paragraphs
        ? p.articleContent.paragraphs.join(" ").replace(/<[^>]+>/g, "").split(/\s+/).filter(Boolean).length
        : 0,
    }));

    return NextResponse.json({ articles });
  } catch (err) {
    console.error("[editor/queue GET]", err);
    return NextResponse.json({ error: "Failed to load queue" }, { status: 500 });
  }
}
