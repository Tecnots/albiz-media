import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  try {
    const { token } = await request.json();
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    await prisma.pushToken.upsert({
      where: { token },
      create: { userId: authUser.id, token },
      update: { userId: authUser.id },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  const tokens = await prisma.pushToken.findMany({
    where: { userId: authUser.id },
    select: { id: true, token: true, createdAt: true },
  });
  return NextResponse.json({ count: tokens.length, tokens });
}

export async function DELETE(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  try {
    const body = await request.json().catch(() => ({}));
    if (body.token) {
      await prisma.pushToken.deleteMany({
        where: { userId: authUser.id, token: body.token },
      });
    } else {
      await prisma.pushToken.deleteMany({ where: { userId: authUser.id } });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
