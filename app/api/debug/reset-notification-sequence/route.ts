import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    // Try to reset the sequence - if it doesn't exist, we'll handle it differently
    try {
      await prisma.$executeRaw`
        SELECT setval(pg_get_serial_sequence('"Notification"', 'id'), (SELECT COALESCE(MAX(id), 0) + 1 FROM "Notification"))
      `;
      return NextResponse.json({ success: true, message: "Notification sequence reset successfully" });
    } catch (seqErr: any) {
      // If sequence doesn't exist, try to create it
      if (seqErr.code === '42P01') {
        await prisma.$executeRaw`
          CREATE SEQUENCE IF NOT EXISTS "Notification_id_seq" OWNED BY "Notification".id
        `;
        await prisma.$executeRaw`
          SELECT setval(pg_get_serial_sequence('"Notification"', 'id'), (SELECT COALESCE(MAX(id), 0) + 1 FROM "Notification"))
        `;
        return NextResponse.json({ success: true, message: "Notification sequence created and reset successfully" });
      }
      throw seqErr;
    }
  } catch (err: any) {
    console.error("Error resetting notification sequence:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
