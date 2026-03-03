import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const userId = Number(request.nextUrl.searchParams.get("userId"));

  const [language, user] = await Promise.all([
    prisma.languageRegionSetting.findMany({ orderBy: { id: "asc" } }),
    userId
      ? prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, handle: true, name: true, title: true, avatar: true },
        })
      : null,
  ]);

  const account = user
    ? [
        { label: "Email", value: user.email },
        { label: "Username", value: user.handle },
        { label: "Name", value: user.name },
      ]
    : [];

  return NextResponse.json({
    account,
    language,
    user: user
      ? { name: user.name, handle: user.handle, title: user.title, avatar: user.avatar }
      : null,
  });
}
