import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const members = await prisma.circleMember.findMany({ orderBy: { rank: "asc" } });
  return NextResponse.json(members);
}
