import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const DEFAULT_NOTIF_PREFS: Record<string, boolean> = {
  NEW_USER:       true,
  CIRCLE_UPGRADE: true,
  CONTENT_REPORT: true,
  AUTHOR_REQUEST: true,
  SYSTEM:         true,
};

export async function GET() {
  try {
    const rows = await prisma.$queryRaw<{ value: Record<string, boolean> }[]>`
      SELECT value FROM "AdminSetting" WHERE key = 'notification_prefs' LIMIT 1
    `;
    const stored = rows[0]?.value ?? {};
    const prefs  = { ...DEFAULT_NOTIF_PREFS, ...stored };
    return NextResponse.json({ prefs });
  } catch (err: any) {
    console.error("[AdminSettings GET]", err);
    return NextResponse.json({ prefs: DEFAULT_NOTIF_PREFS });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const prefs = body?.prefs;
    if (!prefs || typeof prefs !== "object") {
      return NextResponse.json({ error: "Invalid prefs payload" }, { status: 400 });
    }
    // Merge with defaults before saving so the row always has all keys
    const merged = { ...DEFAULT_NOTIF_PREFS, ...prefs };

    // Use raw upsert via SQL to avoid any ORM adapter quirks
    await prisma.$executeRaw`
      INSERT INTO "AdminSetting" (key, value, "updatedAt")
      VALUES ('notification_prefs', ${JSON.stringify(merged)}::jsonb, NOW())
      ON CONFLICT (key)
      DO UPDATE SET value = ${JSON.stringify(merged)}::jsonb, "updatedAt" = NOW()
    `;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[AdminSettings PUT]", err);
    return NextResponse.json({ error: err.message ?? String(err) }, { status: 500 });
  }
}
