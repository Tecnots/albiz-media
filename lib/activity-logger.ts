import { prisma } from "@/lib/prisma";

export type ActivityEventType =
  | "SIGNUP"
  | "SIGNIN"
  | "DEACTIVATE"
  | "REACTIVATE"
  | "DELETE_ACCOUNT"
  | "CIRCLE_REQUEST"
  | "CIRCLE_APPROVED"
  | "CIRCLE_REJECTED"
  | "BAN"
  | "UNBAN"
  | "VERIFICATION_APPROVED"
  | "VERIFICATION_REJECTED"
  | "CONTENT_REPORTED"
  | "CONTENT_MODERATED"
  | "ARTICLE_SCHEDULED"
  | "ARTICLE_UNSCHEDULED"
  | "ARTICLE_PUBLISHED"
  | "ARTICLE_PUBLISH_FAILED"
  | "ALERT_SCHEDULED"
  | "ALERT_SENT"
  | "ALERT_CANCELLED"
  | "ALERT_FAILED"
  | "CAMPAIGN_CREATED"
  | "CAMPAIGN_SENT"
  | "CAMPAIGN_CANCELLED"
  | "CAMPAIGN_FAILED";

interface LogActivityOptions {
  eventType: ActivityEventType;
  userId?: number;
  userName?: string;
  handle?: string;
  avatar?: string;
  /** Optional extra context (e.g. rejection reason, IP) */
  meta?: string;
}

/**
 * Fire-and-forget activity logger. Call this from any API route.
 * Never throws — errors are swallowed so they don't break the main request.
 */
export async function logActivity(opts: LogActivityOptions): Promise<void> {
  try {
    // If we have a userId but missing name/handle, fetch them from DB
    if (opts.userId && (!opts.userName || !opts.handle)) {
      const user = await prisma.user.findUnique({
        where: { id: opts.userId },
        select: { name: true, handle: true, avatar: true },
      });
      if (user) {
        opts.userName = opts.userName || user.name;
        opts.handle = opts.handle || user.handle;
        opts.avatar = opts.avatar || user.avatar || undefined;
      }
    }

    await (prisma as any).activityLog.create({
      data: {
        eventType: opts.eventType,
        userId: opts.userId ?? null,
        userName: opts.userName ?? null,
        handle: opts.handle ?? null,
        avatar: opts.avatar ?? null,
        meta: opts.meta ?? null,
      },
    });
  } catch (err) {
    // Never crash the main request
    console.error("[logActivity] Failed to log activity:", err);
  }
}
