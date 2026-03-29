import { NextResponse } from "next/server";
import { EMAIL_TEMPLATES, LOGO_DATA_URI } from "@/app/lib/email-templates";
import { sendEmail } from "@/app/lib/email";

// Replace cid:albizlogo with the base64 data URI so the logo renders in iframe previews
function injectPreviewLogo(html: string): string {
  return html.replace(/src="cid:albizlogo"/g, `src="${LOGO_DATA_URI}"`);
}

// GET — list all templates with preview HTML
export async function GET() {
  const templates = EMAIL_TEMPLATES.map((t) => {
    const { subject, html } = t.preview();
    return { id: t.id, name: t.name, description: t.description, subject, html: injectPreviewLogo(html) };
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
    // Send with the raw CID src — nodemailer attaches the logo and clients render it
    await sendEmail({ to, subject: `[Test] ${subject}`, html });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
