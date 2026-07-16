import { prisma } from "@/lib/prisma";

function formatTimeNow(): string {
  const now = new Date();
  const h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m} ${ampm}`;
}

/**
 * Notifies an editor (in-app + push + email) that an article was assigned
 * to them for review — used both by the automatic least-loaded assignment
 * on submit and by manual admin reassignment, which previously notified
 * nobody at all (audit finding H-2).
 */
export async function notifyEditorAssigned(params: {
  postId: number;
  editorId: number;
  authorId: number;
  articleTitle: string | null;
  authorName: string | null;
}): Promise<void> {
  const { postId, editorId, authorId, articleTitle, authorName } = params;

  const editorPrefs = await prisma.editorPreferences.findUnique({
    where: { editorId },
    select: { notifyOnSubmit: true },
  });
  if (editorPrefs && !editorPrefs.notifyOnSubmit) return;

  const timeStr = formatTimeNow();

  await prisma.notification.upsert({
    where: {
      type_userId_recipientId_postId: { type: "NEW_POST", userId: authorId, recipientId: editorId, postId },
    },
    update: { time: timeStr, unread: true },
    create: {
      type: "NEW_POST",
      userId: authorId,
      recipientId: editorId,
      postId,
      time: timeStr,
      group: "TODAY",
      unread: true,
      message: `New article for review: "${articleTitle ?? "Untitled"}"`,
    },
  }).catch((e) => console.error("[notifyEditorAssigned] notification upsert failed:", e));

  try {
    const { sendPushToUser } = await import("@/lib/fcm-send");
    await sendPushToUser(editorId, {
      title: "New article assigned",
      body: `"${articleTitle ?? "Untitled"}" is ready for review`,
      url: "/editor/queue",
    });
  } catch (e) {
    console.error("[notifyEditorAssigned] push failed:", e);
  }

  const editor = await prisma.user.findUnique({ where: { id: editorId }, select: { email: true, name: true } });
  if (editor?.email) {
    const { sendEditorAssignmentEmail } = await import("@/lib/circle-email-service");
    sendEditorAssignmentEmail({
      recipientEmail: editor.email,
      recipientName: editor.name ?? "Editor",
      articleTitle: articleTitle ?? "Untitled",
      authorName: authorName ?? "Author",
    }).catch((e) => console.error("[notifyEditorAssigned] email failed:", e));
  }
}

/**
 * Notifies an article's author (in-app + push + email) that it was
 * published — used by both the dedicated editor /publish route and the
 * admin quick-publish action, which previously sent nothing at all despite
 * writing the same status change (audit finding H-3).
 */
export async function notifyAuthorOfPublish(
  postId: number,
  actorId: number,
  post: { userId: number; title: string | null; user?: { email: string | null; name: string | null } | null }
): Promise<void> {
  const timeStr = formatTimeNow();
  const message = `Your article "${post.title ?? "Untitled"}" has been published`;

  await prisma.notification.upsert({
    where: {
      type_userId_recipientId_postId: { type: "NEW_POST", userId: actorId, recipientId: post.userId, postId },
    },
    update: { time: timeStr, unread: true, message },
    create: {
      type: "NEW_POST",
      userId: actorId,
      recipientId: post.userId,
      postId,
      time: timeStr,
      group: "TODAY",
      unread: true,
      message,
    },
  }).catch((e) => console.error("[notifyAuthorOfPublish] notification upsert failed:", e));

  try {
    const { sendPushToUser } = await import("@/lib/fcm-send");
    await sendPushToUser(post.userId, {
      title: "Article published",
      body: `Your article "${post.title ?? "Untitled"}" is now live`,
      url: "/",
    });
  } catch (e) {
    console.error("[notifyAuthorOfPublish] push failed:", e);
  }

  const email = post.user?.email;
  if (email) {
    const { sendEditorialNotificationEmail } = await import("@/lib/circle-email-service");
    sendEditorialNotificationEmail({
      recipientEmail: email,
      recipientName: post.user?.name ?? "Author",
      type: "published",
      articleTitle: post.title ?? "Untitled",
    }).catch((e: unknown) => console.error("[notifyAuthorOfPublish] email failed:", e));
  }
}

/**
 * Notifies an article's author (in-app + push) that it was scheduled or
 * unscheduled — used by the admin quick-action panel, which previously sent
 * nothing on either action while the dedicated editor routes did.
 */
export async function notifyAuthorOfSchedule(
  postId: number,
  actorId: number,
  post: { userId: number; title: string | null },
  publishDate: Date | null,
  kind: "scheduled" | "unscheduled"
): Promise<void> {
  const timeStr = formatTimeNow();
  const title = post.title ?? "Your article";
  const message =
    kind === "scheduled"
      ? `"${title}" has been scheduled for publication.`
      : `The scheduled publication of "${title}" has been cancelled. It is back in Approved.`;

  await prisma.notification.create({
    data: {
      type: kind === "scheduled" ? "ARTICLE_SCHEDULED" : "ARTICLE_UNSCHEDULED",
      userId: actorId,
      recipientId: post.userId,
      time: timeStr,
      group: "TODAY",
      unread: true,
      postId,
      message,
    },
  }).catch((e) => console.error("[notifyAuthorOfSchedule] notification create failed:", e));

  try {
    const { sendPushToUser } = await import("@/lib/fcm-send");
    await sendPushToUser(post.userId, {
      title: kind === "scheduled" ? "Article scheduled" : "Schedule cancelled",
      body:
        kind === "scheduled"
          ? `"${title}" will be published${publishDate ? ` on ${publishDate.toLocaleDateString()}` : ""}.`
          : `"${title}" has been unscheduled and is back in Approved.`,
      url: "/authors/my-articles",
    });
  } catch (e) {
    console.error("[notifyAuthorOfSchedule] push failed:", e);
  }
}

const SHORT_NOTIFICATION_TYPE = {
  approved: "SHORT_APPROVED",
  rejected: "SHORT_REJECTED",
  published: "SHORT_PUBLISHED",
  unpublished: "SHORT_UNPUBLISHED",
} as const;

const SHORT_NOTIFICATION_COPY: Record<keyof typeof SHORT_NOTIFICATION_TYPE, (title: string) => { title: string; body: string }> = {
  approved: (title) => ({ title: "Short approved", body: `"${title}" has been approved and is awaiting publication` }),
  rejected: (title) => ({ title: "Short needs changes", body: `"${title}" wasn't approved this time — check the note and resubmit` }),
  published: (title) => ({ title: "Short published", body: `"${title}" is now live` }),
  unpublished: (title) => ({ title: "Short unpublished", body: `"${title}" was taken down` }),
};

/**
 * Notifies a Short's uploader (in-app + push + email) of a moderation
 * decision. Shorts previously had zero notification coverage across the
 * entire moderation lifecycle — an uploader only learned of a rejection by
 * revisiting their own dashboard (audit finding H-4).
 */
export async function notifyUploaderOfShortDecision(params: {
  shortId: number;
  actorId: number;
  uploaderId: number;
  uploaderEmail: string | null;
  uploaderName: string | null;
  shortTitle: string;
  decision: keyof typeof SHORT_NOTIFICATION_TYPE;
  rejectionNote?: string | null;
}): Promise<void> {
  const { shortId, actorId, uploaderId, uploaderEmail, uploaderName, shortTitle, decision, rejectionNote } = params;
  const type = SHORT_NOTIFICATION_TYPE[decision];
  const copy = SHORT_NOTIFICATION_COPY[decision](shortTitle);
  const timeStr = formatTimeNow();

  await prisma.notification.upsert({
    where: {
      type_userId_recipientId_shortId: { type: type as any, userId: actorId, recipientId: uploaderId, shortId },
    },
    update: { time: timeStr, unread: true, message: copy.body },
    create: {
      type: type as any,
      userId: actorId,
      recipientId: uploaderId,
      shortId,
      time: timeStr,
      group: "TODAY",
      unread: true,
      message: copy.body,
    },
  }).catch((e) => console.error("[notifyUploaderOfShortDecision] notification upsert failed:", e));

  try {
    const { sendPushToUser } = await import("@/lib/fcm-send");
    await sendPushToUser(uploaderId, { title: copy.title, body: copy.body, url: "/uploader/my-shorts" });
  } catch (e) {
    console.error("[notifyUploaderOfShortDecision] push failed:", e);
  }

  if (uploaderEmail) {
    const { sendShortModerationEmail } = await import("@/lib/circle-email-service");
    sendShortModerationEmail({
      recipientEmail: uploaderEmail,
      recipientName: uploaderName ?? "there",
      type: decision,
      shortTitle,
      rejectionNote,
    }).catch((e: unknown) => console.error("[notifyUploaderOfShortDecision] email failed:", e));
  }
}
