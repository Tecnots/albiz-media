import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return unauthorized();

    const { userId } = await request.json();
    if (!userId || authUser.id !== userId) {
      return NextResponse.json({ error: "Missing or invalid userId" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { customDomain: true, domainToken: true }
    });

    if (!user?.customDomain) {
      return NextResponse.json({ error: "No domain configured" }, { status: 400 });
    }

    // In development, auto-verify without DNS check
    if (process.env.NODE_ENV === "development") {
      await prisma.user.update({
        where: { id: userId },
        data: { domainStatus: "ACTIVE" }
      });

      return NextResponse.json({
        domain: user.customDomain,
        domainStatus: "ACTIVE"
      });
    }

    // In production, verify by checking if the domainToken exists
    if (!user.domainToken) {
      return NextResponse.json({ error: "No verification token found" }, { status: 400 });
    }

    // Mark as active
    await prisma.user.update({
      where: { id: userId },
      data: { domainStatus: "ACTIVE" }
    });

    return NextResponse.json({
      domain: user.customDomain,
      domainStatus: "ACTIVE"
    });
  } catch (e: any) {
    console.error("Domain verify error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
