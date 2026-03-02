import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [account, language] = await Promise.all([
    prisma.accountSetting.findMany({ orderBy: { id: "asc" } }),
    prisma.languageRegionSetting.findMany({ orderBy: { id: "asc" } }),
  ]);

  return NextResponse.json({ account, language });
}
