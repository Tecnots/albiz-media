import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";

// Language, region, timezone, and currency are stored on the User record:
//   - language / timeZone / currency → merged into User.notificationPrefs JSON
//   - region (country display name)  → User.country

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { country: true, notificationPrefs: true },
  });

  const prefs = (user?.notificationPrefs as Record<string, unknown>) ?? {};
  return NextResponse.json({
    language: (prefs.language as string) ?? "en",
    region:   user?.country ?? "",
    timeZone: (prefs.timeZone as string) ?? "UTC",
    currency: (prefs.currency as string) ?? "USD",
  });
}

export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { language, region, timeZone, currency } = await request.json();

    const current = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { notificationPrefs: true },
    });
    const existingPrefs = (current?.notificationPrefs as Record<string, unknown>) ?? {};

    const updateData: Record<string, unknown> = {
      notificationPrefs: {
        ...existingPrefs,
        ...(language  && { language }),
        ...(timeZone  && { timeZone }),
        ...(currency  && { currency }),
      },
    };
    if (region) updateData.country = region;

    await prisma.user.update({ where: { id: authUser.id }, data: updateData });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
