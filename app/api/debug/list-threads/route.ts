import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const threads = await prisma.socialThread.findMany({
      include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } }
    });
    return NextResponse.json({ success: true, threads });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
