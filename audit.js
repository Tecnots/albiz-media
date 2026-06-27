require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const data = {};

  // 1. User Roles
  const users = await prisma.user.findMany();
  data.roles = {
    total: users.length,
    ADMIN: users.filter(u => u.role === 'ADMIN').length,
    EDITOR: users.filter(u => u.role === 'EDITOR').length,
    AUTHOR: users.filter(u => u.role === 'AUTHOR').length,
    CIRCLE: users.filter(u => u.role === 'CIRCLE').length,
    NORMAL: users.filter(u => u.role === 'NORMAL').length,
  };
  data.editors = users.filter(u => u.role === 'EDITOR').map(e => ({ id: e.id, name: e.name, email: e.email }));

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

  // 4. Workflow State Audit
  const posts = await prisma.post.findMany({
    select: { id: true, status: true, assignedEditorId: true, sectionId: true, title: true }
  });

  data.workflow = {
    total: posts.length,
    byStatus: {
      draft: posts.filter(p => p.status === 'draft').length,
      submitted: posts.filter(p => p.status === 'submitted').length,
      under_review: posts.filter(p => p.status === 'under_review').length,
      revision_requested: posts.filter(p => p.status === 'revision_requested').length,
      approved: posts.filter(p => p.status === 'approved').length,
      published: posts.filter(p => p.status === 'published').length,
    },
    examples: {
      draft: posts.find(p => p.status === 'draft'),
      submitted: posts.find(p => p.status === 'submitted'),
      under_review: posts.find(p => p.status === 'under_review'),
      revision_requested: posts.find(p => p.status === 'revision_requested'),
      approved: posts.find(p => p.status === 'approved'),
      published: posts.find(p => p.status === 'published'),
    }
  };

  // 5. Workflow Integrity Checks
  data.integrity = {
    assignedEditorNull: posts.filter(p => p.assignedEditorId === null),
    submittedNoEditor: posts.filter(p => p.status === 'submitted' && p.assignedEditorId === null),
    underReviewNoEditor: posts.filter(p => p.status === 'under_review' && p.assignedEditorId === null),
  };

  // Check approved articles assigned to editors without canPublish
  const approvedArticles = posts.filter(p => p.status === 'approved');
  data.integrity.approvedAssignedToNoPublish = approvedArticles.filter(p => {
    if (!p.assignedEditorId) return false;
    const edAssigns = data.assignments.byEditor[p.assignedEditorId];
    if (!edAssigns) return false;
    const sectionAssign = edAssigns.sections.find(s => s.sectionId === p.sectionId);
    return sectionAssign && !sectionAssign.canPublish;
  });

  data.integrity.approvedPublishable = approvedArticles.filter(p => {
    if (!p.assignedEditorId) return false;
    const edAssigns = data.assignments.byEditor[p.assignedEditorId];
    if (!edAssigns) return false;
    const sectionAssign = edAssigns.sections.find(s => s.sectionId === p.sectionId);
    return sectionAssign && sectionAssign.canPublish;
  });

  // 6. Queue Visibility Audit Logic approximation
  // Simulating the logic from app/api/editor/queue/route.ts
  data.queueAudit = {};
  for (const ed of data.editors) {
    const edAssigns = data.assignments.byEditor[ed.id];
    if (!edAssigns) continue;
    const sectionIds = edAssigns.sections.map(s => s.sectionId);

    // Filter queue logic: usually submitted, under_review, approved, revision_requested in their sections
    const visiblePosts = posts.filter(p => sectionIds.includes(p.sectionId) && p.status !== 'draft' && p.status !== 'published');
    const correctlyAssigned = visiblePosts.filter(p => p.assignedEditorId === ed.id);
    const unassigned = visiblePosts.filter(p => p.assignedEditorId === null);
    const assignedToOthers = visiblePosts.filter(p => p.assignedEditorId !== null && p.assignedEditorId !== ed.id);
    
    // Approved posts visible to this editor
    const approvedVisible = visiblePosts.filter(p => p.status === 'approved');
    
    data.queueAudit[ed.name] = {
      visiblePostsCount: visiblePosts.length,
      correctlyAssignedCount: correctlyAssigned.length,
      unassignedCount: unassigned.length,
      assignedToOthersCount: assignedToOthers.length,
      approvedVisibleCount: approvedVisible.length,
      canPublishSections: edAssigns.sections.filter(s => s.canPublish).map(s => s.sectionId)
    };
  }

  console.log(JSON.stringify(data, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
