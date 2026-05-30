import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { generateToken, sendEmail } from "@/app/lib/email";
import { inviteTemplate } from "@/app/lib/email-templates";

const INVITE_TTL_DAYS = 7;

async function requireAdmin(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return { error: unauthorized() };
  if (user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

async function requireAdminOrAuthor(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return { error: unauthorized() };
  if (user.role !== "ADMIN" && user.role !== "AUTHOR") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

function expiryDate() {
  const d = new Date();
  d.setDate(d.getDate() + INVITE_TTL_DAYS);
  return d;
}

// GET — list invitations (admin or author)
export async function GET(req: NextRequest) {
  const guard = await requireAdminOrAuthor(req);
  if (guard.error) return guard.error;

  try {
    const invites = await prisma.userInvite.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        note: true,
        status: true,
        createdAt: true,
        expiresAt: true,
      },
    });
    return NextResponse.json({ invites });
  } catch (err) {
    console.error("[admin/invites GET]", err);
    return NextResponse.json({ error: "Failed to load invites" }, { status: 500 });
  }
}

// POST — create an invitation + send email
export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard.error) return guard.error;

  try {
    const { email, role, name, note } = await req.json();

    if (!email?.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const validRoles = ["NORMAL", "CIRCLE", "AUTHOR", "ADMIN"] as const;
    const finalRole = (validRoles as readonly string[]).includes(role) ? role : "AUTHOR";

    // If the user already exists with this role, no need to invite.
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing && existing.role === finalRole) {
      return NextResponse.json(
        { error: `This user is already a ${finalRole.toLowerCase()}` },
        { status: 400 }
      );
    }

    // Revoke any prior pending invites for this email so only one is live.
    await prisma.userInvite.updateMany({
      where: { email: normalizedEmail, status: "pending" },
      data: { status: "revoked" },
    });

    const token = generateToken();
    const invite = await prisma.userInvite.create({
      data: {
        email: normalizedEmail,
        role: finalRole,
        token,
        status: "pending",
        invitedById: guard.user!.id,
        name: name?.trim() || null,
        note: note?.trim() || null,
        expiresAt: expiryDate(),
      },
    });

    const inviterName = guard.user!.name ?? "An admin";
    const { subject, html } = inviteTemplate({
      inviterName,
      role: finalRole,
      token,
      note: note?.trim() || undefined,
    });

    // Don't block invite creation on email-send failures — log and continue.
    try {
      await sendEmail({ to: normalizedEmail, subject, html });
    } catch (mailErr) {
      console.error("[admin/invites POST] email send failed:", mailErr);
    }

    return NextResponse.json({
      success: true,
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        status: invite.status,
        createdAt: invite.createdAt,
        expiresAt: invite.expiresAt,
      },
    });
  } catch (err: any) {
    console.error("[admin/invites POST]", err);
    return NextResponse.json({ error: err.message ?? "Failed to send invite" }, { status: 500 });
  }
}

// PATCH — resend an invitation (new token + expiry, re-send email)
export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard.error) return guard.error;

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const existing = await prisma.userInvite.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

    const token = generateToken();
    const updated = await prisma.userInvite.update({
      where: { id },
      data: { token, status: "pending", expiresAt: expiryDate() },
    });

    const { subject, html } = inviteTemplate({
      inviterName: guard.user!.name ?? "An admin",
      role: updated.role,
      token,
      note: updated.note ?? undefined,
    });

    try {
      await sendEmail({ to: updated.email, subject, html });
    } catch (mailErr) {
      console.error("[admin/invites PATCH] email send failed:", mailErr);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[admin/invites PATCH]", err);
    return NextResponse.json({ error: err.message ?? "Failed to resend" }, { status: 500 });
  }
}

// DELETE — revoke an invitation
export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard.error) return guard.error;

  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    await prisma.userInvite.update({
      where: { id },
      data: { status: "revoked" },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[admin/invites DELETE]", err);
    return NextResponse.json({ error: err.message ?? "Failed to revoke" }, { status: 500 });
  }
}
