import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

const DEFAULT_TAKE = 50;
const MAX_TAKE = 200;

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rawTake = parseInt(req.nextUrl.searchParams.get("take") ?? String(DEFAULT_TAKE), 10);
  const take = Math.min(Math.max(1, Number.isFinite(rawTake) ? rawTake : DEFAULT_TAKE), MAX_TAKE);
  const rawSkip = parseInt(req.nextUrl.searchParams.get("skip") ?? "0", 10);
  const skip = Math.max(0, Number.isFinite(rawSkip) ? rawSkip : 0);

  const data: any = {};

  // 1. User Roles — use DB-side groupBy instead of loading all rows into memory
  const roleCounts = await prisma.user.groupBy({ by: ['role'], _count: { id: true } });
  const total = roleCounts.reduce((sum, r) => sum + r._count.id, 0);
  const roleMap: Record<string, number> = {};
  for (const r of roleCounts) roleMap[r.role] = r._count.id;
  data.roles = {
    total,
    ADMIN: roleMap['ADMIN'] ?? 0,
    EDITOR: roleMap['EDITOR'] ?? 0,
    AUTHOR: roleMap['AUTHOR'] ?? 0,
    CIRCLE: roleMap['CIRCLE'] ?? 0,
    NORMAL: roleMap['NORMAL'] ?? 0,
  };
  // Only load editor list — not all users
  const users = await prisma.user.findMany({ where: { role: 'EDITOR' }, select: { id: true, name: true, email: true } });
  data.editors = users;

  // 2. Article Sections & Assignments
  const sections = await prisma.articleSection.findMany();
  const assignments = await prisma.editorSectionAssignment.findMany();

  data.sections = sections.map(s => {
    const sAssigns = assignments.filter(a => a.sectionId === s.id);
    const editors = sAssigns.map(a => ({ editorId: a.editorId, canPublish: a.canPublish }));
    return {
      id: s.id,
      name: s.name,
      editorCount: editors.length,
      editors,
      canPublishCount: editors.filter(e => e.canPublish).length
    };
  });

  data.assignments = {
    total: assignments.length,
    byEditor: {}
  };

  for (const ed of data.editors) {
    const eAssigns = assignments.filter(a => a.editorId === ed.id);
    data.assignments.byEditor[ed.id] = {
      name: ed.name,
      sectionCount: eAssigns.length,
      sections: eAssigns.map(a => ({ sectionId: a.sectionId, canPublish: a.canPublish })),
      canPublishOverall: eAssigns.some(a => a.canPublish),
      canPublishFalseOverall: eAssigns.length > 0 && eAssigns.every(a => !a.canPublish)
    };
  }

  // 4. Workflow State Audit — use groupBy for counts, only load a sample for examples
  const postStatusCounts = await prisma.post.groupBy({ by: ['status'], _count: { id: true } });
  const statusMap: Record<string, number> = {};
  for (const r of postStatusCounts) statusMap[r.status] = r._count.id;

  // Load only non-published, non-draft posts for queue audit (paginated)
  const posts = await prisma.post.findMany({
    where: { status: { notIn: ['published', 'draft'] } },
    select: { id: true, status: true, assignedEditorId: true, sectionId: true, title: true },
    orderBy: { createdAt: 'desc' },
    take,
    skip,
  });

  const total_posts = Object.values(statusMap).reduce((s, n) => s + n, 0);
  data.workflow = {
    total: total_posts,
    byStatus: {
      draft: statusMap['draft'] ?? 0,
      submitted: statusMap['submitted'] ?? 0,
      under_review: statusMap['under_review'] ?? 0,
      revision_requested: statusMap['revision_requested'] ?? 0,
      approved: statusMap['approved'] ?? 0,
      published: statusMap['published'] ?? 0,
    },
    examples: {
      submitted: posts.find(p => p.status === 'submitted'),
      under_review: posts.find(p => p.status === 'under_review'),
      revision_requested: posts.find(p => p.status === 'revision_requested'),
      approved: posts.find(p => p.status === 'approved'),
    }
  };

  // 5. Workflow Integrity Checks
  data.integrity = {
    assignedEditorNull: posts.filter(p => p.assignedEditorId === null),
    submittedNoEditor: posts.filter(p => p.status === 'submitted' && p.assignedEditorId === null),
    underReviewNoEditor: posts.filter(p => p.status === 'under_review' && p.assignedEditorId === null),
  };

  const approvedArticles = posts.filter(p => p.status === 'approved');
  data.integrity.approvedAssignedToNoPublish = approvedArticles.filter(p => {
    if (!p.assignedEditorId) return false;
    const edAssigns = data.assignments.byEditor[p.assignedEditorId];
    if (!edAssigns) return false;
    const sectionAssign = edAssigns.sections.find((s: any) => s.sectionId === p.sectionId);
    return sectionAssign && !sectionAssign.canPublish;
  });

  data.integrity.approvedPublishable = approvedArticles.filter(p => {
    if (!p.assignedEditorId) return false;
    const edAssigns = data.assignments.byEditor[p.assignedEditorId];
    if (!edAssigns) return false;
    const sectionAssign = edAssigns.sections.find((s: any) => s.sectionId === p.sectionId);
    return sectionAssign && sectionAssign.canPublish;
  });

  // 6. Queue Visibility Audit Logic approximation
  data.queueAudit = {};
  for (const ed of data.editors) {
    const edAssigns = data.assignments.byEditor[ed.id];
    if (!edAssigns) continue;
    const sectionIds = edAssigns.sections.map((s: any) => s.sectionId);

    const visiblePosts = posts.filter(p => p.sectionId && sectionIds.includes(p.sectionId) && p.status !== 'draft' && p.status !== 'published');
    const correctlyAssigned = visiblePosts.filter(p => p.assignedEditorId === ed.id);
    const unassigned = visiblePosts.filter(p => p.assignedEditorId === null);
    const assignedToOthers = visiblePosts.filter(p => p.assignedEditorId !== null && p.assignedEditorId !== ed.id);
    
    const approvedVisible = visiblePosts.filter(p => p.status === 'approved');
    
    data.queueAudit[ed.name] = {
      visiblePostsCount: visiblePosts.length,
      correctlyAssignedCount: correctlyAssigned.length,
      unassignedCount: unassigned.length,
      assignedToOthersCount: assignedToOthers.length,
      approvedVisibleCount: approvedVisible.length,
      canPublishSections: edAssigns.sections.filter((s: any) => s.canPublish).map((s: any) => s.sectionId)
    };
  }

  data.pagination = { take, skip };

  return NextResponse.json(data);
}
