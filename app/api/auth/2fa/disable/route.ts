import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  await prisma.user.update({
    where: { id: authUser.id },
    data: { twoFactorEnabled: false, twoFactorEmailCode: null, twoFactorEmailCodeExpiry: null },
  });

  return NextResponse.json({ success: true });
}
