import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest) {
  try {
    const { userId, action } = await request.json();
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    switch (action) {
      case "ban":
        await prisma.$executeRaw`UPDATE "User" SET banned = true WHERE id = ${userId}`;
        break;
      case "unban":
        await prisma.$executeRaw`UPDATE "User" SET banned = false WHERE id = ${userId}`;
        break;
      case "promote_circle":
        await prisma.$executeRaw`UPDATE "User" SET role = 'CIRCLE' WHERE id = ${userId}`;
        break;
      case "verify":
        await prisma.$executeRaw`UPDATE "User" SET verified = true WHERE id = ${userId}`;
        break;
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true, userId, action });
  } catch (err: any) {
    console.error("Admin user update error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
