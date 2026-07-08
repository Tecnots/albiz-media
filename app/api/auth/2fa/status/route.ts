import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { twoFactorEnabled: true },
  });

  return NextResponse.json({ enabled: user?.twoFactorEnabled ?? false });
}
