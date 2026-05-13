import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.socialMessage.deleteMany({});
    await prisma.socialThread.deleteMany({});
    return NextResponse.json({ success: true, message: "Cleared all social threads and messages" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
