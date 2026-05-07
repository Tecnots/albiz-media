import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { userId, domain } = await request.json();
    if (!userId || !domain) {
      return NextResponse.json({ error: "Missing userId or domain" }, { status: 400 });
    }

    // Clean the domain
    let cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
    
    // Auto-prepend www. if not localhost
    if (!cleanDomain.startsWith("www.") && !cleanDomain.startsWith("localhost")) {
      cleanDomain = "www." + cleanDomain;
    }

    // Check if domain is already taken
    const existing = await prisma.user.findFirst({
      where: {
        customDomain: cleanDomain,
        NOT: { id: userId }
      }
    });

    if (existing) {
      return NextResponse.json({ error: "Domain already in use" }, { status: 409 });
    }

    // Generate a verification token
    const domainToken = `albiz-verify-${Date.now()}`;

    // Update user with domain and PENDING status
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        customDomain: cleanDomain,
        domainStatus: "PENDING",
        domainToken: domainToken
      }
    });

    return NextResponse.json({
      domain: cleanDomain,
      domainStatus: "PENDING",
      domainToken: domainToken
    });
  } catch (e: any) {
    console.error("Domain add error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
