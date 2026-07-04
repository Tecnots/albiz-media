import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";

const SETTING_KEY = "broadcast_settings";

interface BroadcastSettings {
  senderName: string;
  senderEmail: string;
  replyTo: string;
  defaultAudienceType: string;
  batchSize: number;
  trackOpens: boolean;
  trackClicks: boolean;
  unsubscribeFooter: boolean;
  footerText: string;
  updatedAt: string;
}

const DEFAULTS: BroadcastSettings = {
  senderName: "",
  senderEmail: "",
  replyTo: "",
  defaultAudienceType: "all",
  batchSize: 500,
  trackOpens: true,
  trackClicks: true,
  unsubscribeFooter: true,
  footerText: "",
  updatedAt: new Date().toISOString(),
};

async function loadSettings(): Promise<BroadcastSettings> {
  const row = await prisma.adminSetting.findUnique({ where: { key: SETTING_KEY } });
  return { ...DEFAULTS, ...(row?.value as Partial<BroadcastSettings> | null ?? {}) };
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ settings: await loadSettings() });
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));

  const current = await loadSettings();
  const updated: BroadcastSettings = {
    ...current,
    ...body,
    updatedAt: new Date().toISOString(),
  };

  // Never expose raw credentials — strip anything unexpected
  const safe: BroadcastSettings = {
    senderName:          String(updated.senderName ?? "").trim(),
    senderEmail:         String(updated.senderEmail ?? "").trim(),
    replyTo:             String(updated.replyTo ?? "").trim(),
    defaultAudienceType: String(updated.defaultAudienceType ?? "all"),
    batchSize:           Math.min(5000, Math.max(1, Number(updated.batchSize ?? 500))),
    trackOpens:          Boolean(updated.trackOpens),
    trackClicks:         Boolean(updated.trackClicks),
    unsubscribeFooter:   Boolean(updated.unsubscribeFooter),
    footerText:          String(updated.footerText ?? "").trim(),
    updatedAt:           updated.updatedAt,
  };

  await prisma.$executeRaw`
    INSERT INTO "AdminSetting" (key, value, "updatedAt")
    VALUES (${SETTING_KEY}, ${JSON.stringify(safe)}::jsonb, NOW())
    ON CONFLICT (key)
    DO UPDATE SET value = ${JSON.stringify(safe)}::jsonb, "updatedAt" = NOW()
  `;

  return NextResponse.json({ settings: safe });
}
