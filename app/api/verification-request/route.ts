import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { notifyAdmin } from "@/lib/admin-notifier";

export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  if (authUser.verified) {
    return NextResponse.json({ error: "Your account is already verified" }, { status: 400 });
  }

  const { reason } = await request.json();

  // One pending request per user at a time
  const existing = await prisma.verificationRequest.findFirst({
    where: { userId: authUser.id, status: "PENDING" },
  });
  if (existing) {
    return NextResponse.json({ error: "You already have a pending verification request" }, { status: 409 });
  }

  const vr = await prisma.verificationRequest.create({
    data: {
      userId: authUser.id,
      reason: reason?.trim() || null,
      status: "PENDING",
    },
  });

  notifyAdmin({
    type: "SYSTEM",
    title: "Verification request",
    message: `${authUser.name} (@${authUser.handle}) submitted a verification request`,
    metadata: { requestId: vr.id, userId: authUser.id },
  });

  return NextResponse.json({ success: true, id: vr.id });
}

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  const latest = await prisma.verificationRequest.findFirst({
    where: { userId: authUser.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, reviewNote: true, createdAt: true },
  });

  return NextResponse.json({ request: latest });
}