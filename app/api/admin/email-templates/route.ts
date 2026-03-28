import { NextResponse } from "next/server";
import { EMAIL_TEMPLATES } from "@/app/lib/email-templates";
import { sendEmail } from "@/app/lib/email";

// GET — list all templates with preview HTML
export async function GET() {
  const templates = EMAIL_TEMPLATES.map((t) => {
    const { subject, html } = t.preview();
    return { id: t.id, name: t.name, description: t.description, subject, html };
  });
  return NextResponse.json({ templates });
}

// POST — send a test email for a given template
export async function POST(request: Request) {
  const { templateId, to } = await request.json();

  if (!templateId || !to) {
    return NextResponse.json({ error: "templateId and to are required" }, { status: 400 });
  }

  const template = EMAIL_TEMPLATES.find((t) => t.id === templateId);
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const { subject, html } = template.preview();

  try {
    await sendEmail({ to, subject: `[Test] ${subject}`, html });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
