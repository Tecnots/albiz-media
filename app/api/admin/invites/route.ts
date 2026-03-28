import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateToken, sendEmail } from "@/app/lib/email";
import { inviteTemplate } from "@/app/lib/email-templates";

// GET — list all invites
export async function GET() {
  try {
    const invites = await prisma.userInvite.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ invites });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, invites: [] }, { status: 500 });
  }
}

// POST — create invite and send email
export async function POST(request: Request) {
  try {
    const { email, role, name, note, invitedById } = await request.json();

    if (!email || !role) {
      return NextResponse.json({ error: "email and role are required" }, { status: 400 });
    }

    const validRoles = ["CIRCLE", "AUTHOR", "ADMIN", "NORMAL"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const existing = await prisma.userInvite.findFirst({
      where: { email, status: "pending" },
    });
    if (existing) {
      return NextResponse.json({ error: "A pending invite already exists for this email" }, { status: 409 });
    }

    const inviter = await prisma.user.findUnique({ where: { id: invitedById ?? 1 } });
    const inviterName = inviter?.name ?? "Albiz Team";

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invite = await prisma.userInvite.create({
      data: {
        email,
        role,
        token,
        name: name?.trim() || null,
        note: note?.trim() || null,
        invitedById: invitedById ?? 1,
        expiresAt,
      },
    });

    const { subject, html } = inviteTemplate({ inviterName, role, token, note });
    await sendEmail({ to: email, subject, html });

    return NextResponse.json({ invite });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE — revoke invite
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await prisma.userInvite.update({
      where: { id },
      data: { status: "revoked" },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
