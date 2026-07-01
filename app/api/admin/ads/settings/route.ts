import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { AD_SETTINGS_KEY, DEFAULT_AD_SETTINGS } from "@/app/lib/ads";

export async function GET() {
  try {
    const row = await prisma.adminSetting.findUnique({ where: { key: AD_SETTINGS_KEY } });
    return NextResponse.json({ ...DEFAULT_AD_SETTINGS, ...(row?.value as object | undefined) });
  } catch (error) {
    console.error("[ADMIN_ADS_SETTINGS_GET]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return unauthorized();
    if (authUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const existing = await prisma.adminSetting.findUnique({ where: { key: AD_SETTINGS_KEY } });
    const current = { ...DEFAULT_AD_SETTINGS, ...(existing?.value as object | undefined) };

    // Coerce known numeric fields
    const merged: Record<string, unknown> = { ...current };
    for (const [k, v] of Object.entries(body)) {
      if (!(k in DEFAULT_AD_SETTINGS)) continue;
      const def = (DEFAULT_AD_SETTINGS as any)[k];
      if (typeof def === "number") merged[k] = Number(v) || 0;
      else if (typeof def === "boolean") merged[k] = Boolean(v);
      else merged[k] = v;
    }

    const saved = await prisma.adminSetting.upsert({
      where: { key: AD_SETTINGS_KEY },
      create: { key: AD_SETTINGS_KEY, value: merged as any },
      update: { value: merged as any },
    });

    return NextResponse.json(saved.value);
  } catch (error) {
    console.error("[ADMIN_ADS_SETTINGS_PATCH]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
