import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

// POST — Save/bookmark a message
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();

  const { id } = await params;
  const messageId = Number(id);

  await prisma.message.update({
    where: { id: messageId },
    data: { savedByUser: authUser.id },
  });

  return NextResponse.json({ ok: true });
}

// DELETE — Unsave a message
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();

  const { id } = await params;
  const messageId = Number(id);

  await prisma.message.update({
    where: { id: messageId },
    data: { savedByUser: null },
  });

  return NextResponse.json({ ok: true });
}
