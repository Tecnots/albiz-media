import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

const NOTE_TYPES = ["general", "factual", "style", "grammar", "structure"];

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "EDITOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const prefs = await prisma.editorPreferences.upsert({
      where: { editorId: user.id },
      update: {},
      create: { editorId: user.id },
    });
    return NextResponse.json({ preferences: prefs });
  } catch (err) {
    console.error("[editor/preferences GET]", err);
    return NextResponse.json({ error: "Failed to load preferences" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "EDITOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const data: {
    defaultNoteType?: string;
    defaultNotePriority?: string;
    notifyOnSubmit?: boolean;
    notifyOnResolve?: boolean;
  } = {};

  if (body.defaultNoteType !== undefined) {
    data.defaultNoteType = NOTE_TYPES.includes(body.defaultNoteType) ? body.defaultNoteType : "general";
  }
  if (body.defaultNotePriority !== undefined) {
    data.defaultNotePriority = body.defaultNotePriority === "major" ? "major" : "minor";
  }
  if (typeof body.notifyOnSubmit === "boolean") data.notifyOnSubmit = body.notifyOnSubmit;
  if (typeof body.notifyOnResolve === "boolean") data.notifyOnResolve = body.notifyOnResolve;

  try {
    const prefs = await prisma.editorPreferences.upsert({
      where: { editorId: user.id },
      update: data,
      create: { editorId: user.id, ...data },
    });
    return NextResponse.json({ preferences: prefs });
  } catch (err) {
    console.error("[editor/preferences PUT]", err);
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
  }
}
