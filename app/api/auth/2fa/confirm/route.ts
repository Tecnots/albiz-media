import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  const limit = await rateLimit(`2fa-confirm:${authUser.id}`, 5, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(limit.error, {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil((limit.resetAt - Date.now()) / 1000)) },
    });
  }

  const { code } = await request.json();
  if (!code) return NextResponse.json({ error: "Code is required" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: authUser.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (
    !user.twoFactorEmailCode ||
    !user.twoFactorEmailCodeExpiry ||
    user.twoFactorEmailCodeExpiry < new Date() ||
    user.twoFactorEmailCode !== String(code)
  ) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorEnabled: true, twoFactorEmailCode: null, twoFactorEmailCodeExpiry: null },
  });

  return NextResponse.json({ success: true });
}
