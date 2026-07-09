import { prisma } from "@/lib/prisma";

export type PostStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'revision_requested'
  | 'approved'
  | 'published'
  | 'scheduled'
  | 'rejected'
  | 'archived';

/**
 * The single source of truth for legal Post/Article status transitions.
 * Every code path that changes Post.status — including admin quick-actions —
 * must go through transitionPostState() below, which validates against this
 * table. Do not write Post.status via a raw prisma.post.update/$executeRaw
 * outside of this file (see audit findings C-7 / state-machine-consistency).
 *
 * "rejected" and "archived" were previously only reachable through an
 * unvalidated admin bypass and were absent from this table entirely — they
 * are now first-class, validated states. "archived" is reachable from every
 * active state (matches the live "Archive" action, available from anything
 * not already rejected/archived); both terminal states restore only to draft.
 */
export const WORKFLOW_TRANSITIONS: Record<PostStatus, PostStatus[]> = {
  draft: ['submitted', 'published', 'archived'],
  submitted: ['draft', 'under_review', 'published', 'rejected', 'archived'],
  under_review: ['revision_requested', 'approved', 'rejected', 'archived'],
  revision_requested: ['submitted', 'draft', 'rejected', 'archived'],
  approved: ['published', 'under_review', 'scheduled', 'rejected', 'archived'],
  scheduled: ['approved', 'published', 'archived'],
  published: ['draft', 'under_review', 'archived'],
  rejected: ['draft'],
  archived: ['draft'],
};

/** Statuses that represent an editorial moderation decision, not an author/system action. */
const MODERATION_STATUSES: PostStatus[] = ['under_review', 'revision_requested', 'approved', 'rejected', 'archived'];

export async function transitionPostState(
  postId: number,
  userId: number,
  userRole: string,
  currentStatus: string,
  newStatus: string,
  assignedEditorId: number | null,
  canPublish: boolean,
  canPost: boolean,
  actionType: string,
  postType: "POST" | "ARTICLE" = "ARTICLE"
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
  if (MODERATION_STATUSES.includes(newStatus as PostStatus)) {
    if (userRole !== "EDITOR" && userRole !== "ADMIN") {
      throw new Error("Only editors or admins can perform this transition.");
    }
    if (assignedEditorId && assignedEditorId !== userId && userRole !== "ADMIN") {
      throw new Error("You are not assigned to review this article.");
    }
  }

  if (newStatus === "published") {
    // ADMIN is always allowed. Feed-type Posts authored by CIRCLE are
    // intentionally unmoderated (immediate publish is the product design for
    // the feed) — everyone else, including CIRCLE/UPLOADER publishing an
    // ARTICLE, must satisfy the same gate AUTHOR does. Fixes audit finding
    // C-1: the previous check only named EDITOR and AUTHOR/NORMAL, so
    // CIRCLE and UPLOADER fell through unrestricted for every content type.
    if (userRole === "ADMIN") {
      // no-op — unrestricted
    } else if (postType === "POST" && userRole === "CIRCLE") {
      // no-op — unmoderated feed publish, by design
    } else if (userRole === "EDITOR") {
      if (!canPublish) throw new Error("You do not have publish permission for this section.");
    } else if (!canPost) {
      throw new Error("You do not have permission to publish directly.");
    }
  }

  // Perform database update. The WHERE clause is guarded on the status we
  // validated against above — if a concurrent request already moved this
  // post to a different status, zero rows match and we surface a conflict
  // instead of silently clobbering whatever the other request wrote
  // (audit finding H-5: no optimistic locking existed on this write).
  let affected: number;
  if (newStatus === "published") {
    const now = new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = now.getDate();
    const suffix = day === 1 || day === 21 || day === 31 ? "st" : day === 2 || day === 22 ? "nd" : day === 3 || day === 23 ? "rd" : "th";
    const dateStr = `${months[now.getMonth()]} ${day}${suffix} ${now.getFullYear()}`;
    const hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    const timeStr = `${hours % 12 || 12}:${minutes} ${ampm}`;
    affected = await prisma.$executeRaw`UPDATE "Post" SET status = ${newStatus}, date = ${dateStr}, time = ${timeStr}, "publishAt" = ${now} WHERE id = ${postId} AND status = ${currentStatus}`;
  } else {
    affected = await prisma.$executeRaw`UPDATE "Post" SET status = ${newStatus} WHERE id = ${postId} AND status = ${currentStatus}`;
  }
  if (affected === 0) {
    throw new Error("CONFLICT: this article's status changed since you last loaded it. Refresh and try again.");
  }

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
