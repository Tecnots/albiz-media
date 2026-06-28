import { prisma } from "@/lib/prisma";

export type PostStatus = 'draft' | 'submitted' | 'under_review' | 'revision_requested' | 'approved' | 'published' | 'scheduled';

export const WORKFLOW_TRANSITIONS: Record<PostStatus, PostStatus[]> = {
  draft: ['submitted', 'published'],
  submitted: ['draft', 'under_review', 'published'],
  under_review: ['revision_requested', 'approved'],
  revision_requested: ['submitted', 'draft'],
  approved: ['published', 'under_review', 'scheduled'],
  scheduled: ['approved', 'published'],
  published: ['draft', 'under_review']
};

export async function transitionPostState(
  postId: number,
  userId: number,
  userRole: string,
  currentStatus: string,
  newStatus: string,
  assignedEditorId: number | null,
  canPublish: boolean,
  canPost: boolean,
  actionType: string
) {
  if (currentStatus === newStatus) {
    return; // No-op
  }

  // Validate allowed state machine transition
  const allowedNext = WORKFLOW_TRANSITIONS[currentStatus as PostStatus] || [];
  if (!allowedNext.includes(newStatus as PostStatus)) {
    throw new Error(`Invalid state transition from ${currentStatus} to ${newStatus}`);
  }

  // Validate Ownership and Permissions
  if (newStatus === "under_review" || newStatus === "revision_requested" || newStatus === "approved") {
    if (userRole !== "EDITOR" && userRole !== "ADMIN") {
      throw new Error("Only editors or admins can perform this transition.");
    }
    if (assignedEditorId && assignedEditorId !== userId && userRole !== "ADMIN") {
      throw new Error("You are not assigned to review this article.");
    }
  }

  if (newStatus === "published") {
    if (userRole === "EDITOR" && !canPublish) {
      throw new Error("You do not have publish permission for this section.");
    }
    if ((userRole === "AUTHOR" || userRole === "NORMAL") && !canPost) {
      throw new Error("You do not have permission to publish directly.");
    }
  }

  // Perform database update
  await prisma.$executeRaw`UPDATE "Post" SET status = ${newStatus} WHERE id = ${postId}`;

  // Standardize Status Logging
  if (userRole === "EDITOR" || userRole === "ADMIN") {
    try {
      const meta = JSON.stringify({
        prev: currentStatus,
        next: newStatus,
        action: actionType
      });
      await prisma.editorActivity.create({
        data: {
          editorId: userId,
          postId,
          action: `STATUS_CHANGE|${meta}`,
        }
      });
    } catch (e) {
      console.error("[Workflow Logging Error]", e);
    }
  }
}
