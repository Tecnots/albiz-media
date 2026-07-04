import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

const SETTING_KEY = "broadcast_templates";

interface BroadcastTemplate {
  id: string;
  name: string;
  category: string;
  subject: string;
  bodyHtml: string;
  previewText?: string;
  messageTitle?: string;
  notificationBody?: string;
  channels: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

async function loadTemplates(): Promise<BroadcastTemplate[]> {
  const row = await prisma.adminSetting.findUnique({ where: { key: SETTING_KEY } });
  return (row?.value as BroadcastTemplate[] | null) ?? [];
}

async function saveTemplates(templates: BroadcastTemplate[]): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO "AdminSetting" (key, value, "updatedAt")
    VALUES (${SETTING_KEY}, ${JSON.stringify(templates)}::jsonb, NOW())
    ON CONFLICT (key)
    DO UPDATE SET value = ${JSON.stringify(templates)}::jsonb, "updatedAt" = NOW()
  `;
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ templates: await loadTemplates() });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { name, category, subject, bodyHtml, previewText, messageTitle, notificationBody, channels, tags } = body;

  if (!name?.trim())     return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!category?.trim()) return NextResponse.json({ error: "category is required" }, { status: 400 });
  if (!subject?.trim())  return NextResponse.json({ error: "subject is required" }, { status: 400 });
  if (!bodyHtml?.trim()) return NextResponse.json({ error: "bodyHtml is required" }, { status: 400 });

  const now = new Date().toISOString();
  const template: BroadcastTemplate = {
    id: randomUUID(),
    name: name.trim(),
    category: category.trim(),
    subject: subject.trim(),
    bodyHtml: bodyHtml.trim(),
    previewText: previewText?.trim() ?? "",
    messageTitle: messageTitle?.trim() ?? "",
    notificationBody: notificationBody?.trim() ?? "",
    channels: Array.isArray(channels) ? channels : ["email"],
    tags: Array.isArray(tags) ? tags : [],
    createdAt: now,
    updatedAt: now,
  };

  const templates = await loadTemplates();
  templates.unshift(template);
  await saveTemplates(templates);

  return NextResponse.json({ template }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const templates = await loadTemplates();
  const idx = templates.findIndex(t => t.id === id);
  if (idx === -1) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  templates[idx] = { ...templates[idx], ...updates, id, updatedAt: new Date().toISOString() };
  await saveTemplates(templates);

  return NextResponse.json({ template: templates[idx] });
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const templates = await loadTemplates();
  const next = templates.filter(t => t.id !== id);
  if (next.length === templates.length) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  await saveTemplates(next);
  return NextResponse.json({ success: true });
}
