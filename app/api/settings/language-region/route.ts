import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, language, region, timeZone, currency } = body;

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Check if user has existing language/region settings
    const existingSettings = await prisma.languageRegionSetting.findUnique({
      where: { userId },
    });

    if (existingSettings) {
      // Update existing settings
      const updateData: any = {};
      if (language) updateData.language = language;
      if (region) updateData.region = region;
      if (timeZone) updateData.timeZone = timeZone;
      if (currency) updateData.currency = currency;

      await prisma.languageRegionSetting.update({
        where: { userId },
        data: updateData,
      });
    } else {
      // Create new settings
      await prisma.languageRegionSetting.create({
        data: {
          userId,
          language: language || "en",
          region: region || "us",
          timeZone: timeZone || "UTC",
          currency: currency || "USD",
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving language/region settings:", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
