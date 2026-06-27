import { enqueueEmail } from "@/lib/job-queue";
import { CircleUpgradeRequest } from "@/types/circle-upgrade";
import {
  circleUpgradeRequestTemplate,
  circleUpgradeApprovedTemplate,
  circleUpgradeRejectedTemplate,
  newPostEmailTemplate,
  newStoryEmailTemplate,
  newFollowEmailTemplate,
  newLikeEmailTemplate,
  newCommentEmailTemplate,
  newStoryLikeEmailTemplate,
  mentionEmailTemplate,
  circleUpdateEmailTemplate,
  editorialNotificationTemplate,
  editorAssignmentTemplate,
} from "@/lib/circle-email-templates";

// Internal helper — enqueues email via job queue instead of sending inline.
// Never throws so it never breaks the caller's request.
async function queueEmail(
  to: string,
  subject: string,
  html: string,
  templateKey: string
): Promise<void> {
  await enqueueEmail({ to, subject, html, templateKey });
}

export const sendCircleUpgradeRequestEmail = async (
  request: CircleUpgradeRequest & { user: { email: string } }
): Promise<void> => {
  try {
    const { subject, html } = circleUpgradeRequestTemplate(request);
    await queueEmail(request.user.email, subject, html, "circle-upgrade-request");
  } catch (error) {
    console.error("Failed to queue Circle upgrade request email:", error);
  }
};

export const sendCircleUpgradeApprovedEmail = async (
  request: CircleUpgradeRequest & { user: { email: string; name: string } }
): Promise<void> => {
  try {
    const { subject, html } = circleUpgradeApprovedTemplate(request);
    await queueEmail(request.user.email, subject, html, "circle-upgrade-approved");
  } catch (error) {
    console.error("Failed to queue Circle upgrade approval email:", error);
  }
};

export const sendCircleUpgradeRejectedEmail = async (
  request: CircleUpgradeRequest & { user: { email: string; name: string } },
  reason?: string
): Promise<void> => {
  try {
    const { subject, html } = circleUpgradeRejectedTemplate(request, reason);
    await queueEmail(request.user.email, subject, html, "circle-upgrade-rejected");
  } catch (error) {
    console.error("Failed to queue Circle upgrade rejection email:", error);
  }
};

export const sendNewPostEmail = async (params: {
  recipientEmail: string;
  recipientName: string;
  authorName: string;
  authorHandle: string;
  postPreview: string;
  postImage?: string;
  postId: number;
}): Promise<void> => {
  try {
    const { subject, html } = newPostEmailTemplate(params);
    await queueEmail(params.recipientEmail, subject, html, "new-post");
  } catch (error) {
    console.error("Failed to queue new post email:", error);
  }
};

export const sendNewStoryEmail = async (params: {
  recipientEmail: string;
  recipientName: string;
  authorName: string;
  authorHandle: string;
  storyImage?: string;
}): Promise<void> => {
  try {
    const { subject, html } = newStoryEmailTemplate(params);
    await queueEmail(params.recipientEmail, subject, html, "new-story");
  } catch (error) {
    console.error("Failed to queue new story email:", error);
  }
};

export const sendFollowEmail = async (params: {
  recipientEmail: string;
  recipientName: string;
  followerName: string;
  followerHandle: string;
}): Promise<void> => {
  try {
    const { subject, html } = newFollowEmailTemplate(params);
    await queueEmail(params.recipientEmail, subject, html, "new-follow");
  } catch (error) {
    console.error("Failed to queue follow email:", error);
  }
};

export const sendLikeEmail = async (params: {
  recipientEmail: string;
  recipientName: string;
  likerName: string;
  likerHandle: string;
  postPreview: string;
  postImage?: string;
  postId: number;
}): Promise<void> => {
  try {
    const { subject, html } = newLikeEmailTemplate(params);
    await queueEmail(params.recipientEmail, subject, html, "new-like");
  } catch (error) {
    console.error("Failed to queue like email:", error);
  }
};

export const sendCommentEmail = async (params: {
  recipientEmail: string;
  recipientName: string;
  commenterName: string;
  commenterHandle: string;
  commentText: string;
  postPreview: string;
  postId: number;
}): Promise<void> => {
  try {
    const { subject, html } = newCommentEmailTemplate(params);
    await queueEmail(params.recipientEmail, subject, html, "new-comment");
  } catch (error) {
    console.error("Failed to queue comment email:", error);
  }
};

export const sendStoryLikeEmail = async (params: {
  recipientEmail: string;
  recipientName: string;
  likerName: string;
  likerHandle: string;
  storyImage?: string;
}): Promise<void> => {
  try {
    const { subject, html } = newStoryLikeEmailTemplate(params);
    await queueEmail(params.recipientEmail, subject, html, "story-like");
  } catch (error) {
    console.error("Failed to queue story like email:", error);
  }
};

export const sendMentionEmail = async (params: {
  recipientEmail: string;
  recipientName: string;
  authorName: string;
  authorHandle: string;
  contentSnippet: string;
  postUrlPath: string;
}): Promise<void> => {
  try {
    const { subject, html } = mentionEmailTemplate(params);
    await queueEmail(params.recipientEmail, subject, html, "mention");
  } catch (error) {
    console.error("Failed to queue mention email:", error);
  }
};

export const sendCircleUpdateEmail = async (params: {
  recipientEmail: string;
  recipientName: string;
  authorName: string;
  authorHandle: string;
  authorTitle: string;
  contentSnippet: string;
  postImage?: string;
}): Promise<void> => {
  try {
    const { subject, html } = circleUpdateEmailTemplate(params);
    await queueEmail(params.recipientEmail, subject, html, "circle-update");
  } catch (error) {
    console.error("Failed to queue circle update email:", error);
  }
};

export const sendEditorialNotificationEmail = async (params: {
  recipientEmail: string;
  recipientName: string;
  type: "revision_requested" | "approved" | "published";
  articleTitle: string;
}): Promise<void> => {
  try {
    const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || "";
    const { subject, html } = editorialNotificationTemplate({ ...params, appUrl });
    await queueEmail(params.recipientEmail, subject, html, `editorial-${params.type}`);
  } catch (error) {
    console.error("Failed to queue editorial notification email:", error);
  }
};

export const sendEditorAssignmentEmail = async (params: {
  recipientEmail: string;
  recipientName: string;
  articleTitle: string;
  authorName: string;
}): Promise<void> => {
  try {
    const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || "";
    const { subject, html } = editorAssignmentTemplate({ ...params, appUrl });
    await queueEmail(params.recipientEmail, subject, html, "editor-assignment");
  } catch (error) {
    console.error("Failed to queue editor assignment email:", error);
  }
};