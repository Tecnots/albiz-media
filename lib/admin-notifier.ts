import { prisma } from "@/lib/prisma";

type AdminNotifType =
  | "NEW_USER"
  | "CIRCLE_UPGRADE"
  | "CONTENT_REPORT"
  | "AUTHOR_REQUEST"
  | "SYSTEM";

interface CreateAdminNotifOptions {
  type: AdminNotifType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget admin notification. Respects admin notification preferences.
 * Never throws — safe to call anywhere.
 */
export async function notifyAdmin(opts: CreateAdminNotifOptions): Promise<void> {
  try {
    // Check if this type is enabled in admin settings
    const setting = await prisma.adminSetting.findUnique({
      where: { key: "notification_prefs" },
    });

    if (setting) {
      const prefs = setting.value as Record<string, boolean>;
      if (prefs[opts.type] === false) return; // explicitly disabled
    }

    await prisma.adminNotification.create({
      data: {
        type:     opts.type,
        title:    opts.title,
        message:  opts.message,
        metadata: (opts.metadata ?? {}) as any,
        unread:   true,
      },
    });
  } catch (err) {
    console.error("[AdminNotifier] Failed:", err);
  }
}
