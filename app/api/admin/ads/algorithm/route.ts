import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { AD_ALGORITHM_KEY, DEFAULT_AD_ALGORITHM } from "@/app/lib/ads";

export async function GET(request: NextRequest) {
  // Previously unauthenticated — leaked the internal ad-ranking algorithm's
  // tunable parameters to anyone (audit finding C-5).
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  if (authUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const row = await prisma.adminSetting.findUnique({ where: { key: AD_ALGORITHM_KEY } });
    return NextResponse.json({ ...DEFAULT_AD_ALGORITHM, ...(row?.value as object | undefined) });
  } catch (error) {
    console.error("[ADMIN_ADS_ALGORITHM_GET]", error);
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
    const existing = await prisma.adminSetting.findUnique({ where: { key: AD_ALGORITHM_KEY } });
    const current = { ...DEFAULT_AD_ALGORITHM, ...(existing?.value as object | undefined) };

    const merged: Record<string, unknown> = { ...current };
    for (const [k, v] of Object.entries(body)) {
      if (!(k in DEFAULT_AD_ALGORITHM)) continue;
      const def = (DEFAULT_AD_ALGORITHM as any)[k];
      if (typeof def === "number") {
        const n = Number(v);
        merged[k] = Number.isFinite(n) ? n : def;
      } else if (typeof def === "boolean") {
        merged[k] = Boolean(v);
      } else {
        merged[k] = v;
      }
    }

    const saved = await prisma.adminSetting.upsert({
      where: { key: AD_ALGORITHM_KEY },
      create: { key: AD_ALGORITHM_KEY, value: merged as any },
      update: { value: merged as any },
    });

    return NextResponse.json(saved.value);
  } catch (error) {
    console.error("[ADMIN_ADS_ALGORITHM_PATCH]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
