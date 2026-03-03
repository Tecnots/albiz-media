import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: fetch current domain settings for a user
export async function GET(request: NextRequest) {
  try {
    const userId = Number(request.nextUrl.searchParams.get("userId"));
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    const rows = await prisma.$queryRaw<any[]>`
      SELECT "customDomain", "domainVerified", "showBranding" FROM "User" WHERE id = ${userId} LIMIT 1
    `;
    const user = rows[0];

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    return NextResponse.json({
      domain: user.customDomain || "",
      verified: user.domainVerified,
      showBranding: user.showBranding ?? true,
    });
  } catch (e: any) {
    console.error("Domain GET error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: set or update custom domain
export async function POST(request: NextRequest) {
  const { userId, domain } = await request.json();
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const cleanDomain = (domain || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");

  // If clearing the domain
  if (!cleanDomain) {
    await prisma.$executeRaw`UPDATE "User" SET "customDomain" = NULL, "domainVerified" = false WHERE id = ${userId}`;
    return NextResponse.json({ domain: "", verified: false });
  }

  // Check if domain is already taken by another user
  const existing = await prisma.$queryRaw<any[]>`
    SELECT id FROM "User" WHERE "customDomain" = ${cleanDomain} AND id != ${userId} LIMIT 1
  `;
  if (existing.length > 0) {
    return NextResponse.json({ error: "Domain already in use" }, { status: 409 });
  }

  await prisma.$executeRaw`UPDATE "User" SET "customDomain" = ${cleanDomain}, "domainVerified" = false WHERE id = ${userId}`;

  return NextResponse.json({ domain: cleanDomain, verified: false });
}

// PUT: verify domain (simulated DNS check)
export async function PUT(request: NextRequest) {
  const { userId } = await request.json();
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const rows = await prisma.$queryRaw<any[]>`
    SELECT "customDomain" FROM "User" WHERE id = ${userId} LIMIT 1
  `;
  const user = rows[0];

  if (!user?.customDomain) {
    return NextResponse.json({ error: "No domain configured" }, { status: 400 });
  }

  await prisma.$executeRaw`UPDATE "User" SET "domainVerified" = true WHERE id = ${userId}`;

  return NextResponse.json({ domain: user.customDomain, verified: true });
}

// PATCH: update domain settings (e.g. branding toggle)
export async function PATCH(request: NextRequest) {
  const { userId, showBranding } = await request.json();
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const val = !!showBranding;
  await prisma.$executeRaw`UPDATE "User" SET "showBranding" = ${val} WHERE id = ${userId}`;

  return NextResponse.json({ showBranding: val });
}

// DELETE: remove custom domain
export async function DELETE(request: NextRequest) {
  const { userId } = await request.json();
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  await prisma.$executeRaw`UPDATE "User" SET "customDomain" = NULL, "domainVerified" = false WHERE id = ${userId}`;

  return NextResponse.json({ domain: "", verified: false });
}
