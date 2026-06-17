import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "EDITOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const templates = await prisma.editorNoteTemplate.findMany({
      where: { editorId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, text: true, createdAt: true },
    });
    return NextResponse.json({ templates });
  } catch (err) {
    console.error("[editor/templates GET]", err);
    return NextResponse.json({ error: "Failed to load templates" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "EDITOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { text } = await req.json();
  const trimmed = (text ?? "").trim();
  if (!trimmed) {
    return NextResponse.json({ error: "Template text is required" }, { status: 400 });
  }
  if (trimmed.length > 280) {
    return NextResponse.json({ error: "Template too long (max 280 characters)" }, { status: 400 });
  }

  try {
    const template = await prisma.editorNoteTemplate.create({
      data: { editorId: user.id, text: trimmed },
      select: { id: true, text: true, createdAt: true },
    });
    return NextResponse.json({ template });
  } catch (err) {
    console.error("[editor/templates POST]", err);
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }
}
