/**
 * Centralized audit logging.
 *
 * Writes structured records to the AuditLog DB table.
 * Never throws — failures are logged to stderr and silently swallowed
 * so a logging failure never breaks a user request.
 */

import { prisma } from "@/lib/prisma";

export type AuditAction =
  // Auth events
  | "AUTH_LOGIN"
  | "AUTH_LOGOUT"
  | "AUTH_PASSWORD_CHANGE"
  | "AUTH_SESSION_INVALIDATED"
  // User management
  | "USER_BAN"
  | "USER_UNBAN"
  | "USER_DEACTIVATE"
  | "USER_ROLE_CHANGE"
  | "USER_DELETE"
  | "USER_EMAIL_CHANGE"
  // Content
  | "POST_DELETE"
  | "POST_PUBLISH"
  | "POST_UNPUBLISH"
  | "POST_FLAG"
  | "POST_REASSIGN"
  | "COMMENT_DELETE"
  // Circle
  | "CIRCLE_REQUEST_SUBMIT"
  | "CIRCLE_REQUEST_APPROVE"
  | "CIRCLE_REQUEST_REJECT"
  | "CIRCLE_MEMBER_ADD"
  | "CIRCLE_MEMBER_REMOVE"
  // Invites
  | "INVITE_SEND"
  | "INVITE_REVOKE"
  | "INVITE_ACCEPT"
  // Admin
  | "ADMIN_SETTINGS_CHANGE"
  | "ADMIN_AD_CREATE"
  | "ADMIN_AD_DELETE"
  | "ADMIN_NOTIFICATION_SEND"
  // Security
  | "RATE_LIMIT_HIT"
  | "ABUSE_BLOCK"
  | "SUSPICIOUS_REQUEST";

export interface AuditLogEntry {
  action: AuditAction;
  actorId?: number | null;
  targetId?: number | null;
  targetType?: string | null;
  meta?: Record<string, unknown> | null;
  ip?: string | null;
}

export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        actorId: entry.actorId ?? null,
        targetId: entry.targetId ?? null,
        targetType: entry.targetType ?? null,
        meta: (entry.meta ?? undefined) as any,
        ip: entry.ip ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] failed to write log:", err);
  }
}

export function extractIp(request: Request): string | null {
  const headers = (request as any).headers as Headers;
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    null
  );
}
