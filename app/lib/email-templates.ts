const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3000"; // process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ??

// Reference the logo via CID — the file is attached inline by sendEmail()
// so it renders reliably in Outlook and works in localhost dev.
const LOGO_SRC = "cid:albiz-logo";

// Exported so the preview API can inject it into iframe HTML
export const LOGO_DATA_URI =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIxIiBoZWlnaHQ9IjEwNCIgdmlld0JveD0iMCAwIDEyMSAxMDQiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTcxLjkxMjEgMjAuMzExTDU5Ljg4MzMgMEw5LjE1NTI3ZS0wNSAxMDMuODYxSDIzLjI4MzhMNzEuOTEyMSAyMC4zMTFaIiBmaWxsPSIjRkY0NDQ0Ii8+PHBhdGggZD0iTTk2LjA5OTggNjIuMDgyMUw4My45NDA4IDQxLjkwOTFMNDcuOTg0OCAxMDMuODYxSDcxLjkxMjFMOTYuMDk5OCA2Mi4wODIxWiIgZmlsbD0iI0ZGNDQ0NCIvPjxwYXRoIGQ9Ik0xMjAuMTUgMTAzLjg2MUwxMDguMzgxIDgzLjI5NzJMOTYuMDk5OCAxMDMuODYxSDEyMC4xNVoiIGZpbGw9IiNGRjQ0NDQiLz48cGF0aCBkPSJNMTA4LjA1OCA4My4zMTU3TDk2LjE0MzggNjIuNDUzMUw4NC4wNTM4IDgzLjMxNTdMOTYuMTQzOCAxMDMuNzk1TDEwOC4wNTggODMuMzE1N1oiIGZpbGw9IiNBRjEyMTIiLz48cGF0aCBkPSJNNDcuNjYxIDYyLjQ1MzFMNjAuMDQyMiA4My4zMTU3TDQ3LjY2MSAxMDMuNzk1TDM1Ljc1NDkgODIuNTQ5Nkw0Ny42NjEgNjIuNDUzMVoiIGZpbGw9IiNBRjEyMTIiLz48L3N2Zz4=";

const BRAND_RED = "#F44444";
const BG = "#f5f5f5";
const CARD_BG = "#ffffff";
const TEXT_PRIMARY = "#0a0a0a";
const TEXT_MUTED = "#737373";
const TEXT_FAINT = "#a3a3a3";
const BORDER = "#e5e5e5";

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Albiz</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG};min-height:100vh;">
    <tr>
      <td align="center" style="padding:48px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <a href="${APP_URL}" style="display:inline-block;text-decoration:none;">
                <img src="${LOGO_SRC}" alt="Albiz" width="36" height="31" style="display:block;border:0;" />
              </a>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:${CARD_BG};border-radius:16px;border:1px solid ${BORDER};padding:40px 40px 36px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0 0 6px;color:${TEXT_FAINT};font-size:12px;line-height:1.6;">
                You received this because you have an account on
                <a href="${APP_URL}" style="color:${TEXT_FAINT};text-decoration:underline;">Albiz</a>.
              </p>
              <p style="margin:0;color:${TEXT_FAINT};font-size:11px;">
                © ${new Date().getFullYear()} Albiz Media. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(text: string, href: string): string {
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">
    <tr>
      <td style="border-radius:10px;background:${BRAND_RED};">
        <a href="${href}"
           style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;letter-spacing:0.01em;">
          ${text}
        </a>
      </td>
    </tr>
  </table>`;
}

function fallbackLink(label: string, href: string): string {
  return `<p style="margin:20px 0 0;color:${TEXT_FAINT};font-size:12px;line-height:1.6;">
    If the button above doesn&apos;t work, copy and paste this link:<br />
    <a href="${href}" style="color:${BRAND_RED};word-break:break-all;font-size:11px;text-decoration:none;">${href}</a>
  </p>`;
}

// ─── Verify Email ─────────────────────────────────────────────────────────────

export function verifyEmailTemplate({ name, token }: { name: string; token: string }) {
  const url = `${APP_URL}/auth/verify-email?token=${token}`;
  const subject = "Verify your email address";
  const html = baseTemplate(`
    <h1 style="margin:0 0 8px;color:${TEXT_PRIMARY};font-size:22px;font-weight:700;line-height:1.3;">
      Verify your email
    </h1>
    <p style="margin:0 0 4px;color:${TEXT_MUTED};font-size:14px;line-height:1.6;">
      Hi ${name},
    </p>
    <p style="margin:0;color:${TEXT_MUTED};font-size:14px;line-height:1.6;">
      Thanks for signing up for Albiz. Click the button below to confirm your email address and activate your account.
    </p>
    ${ctaButton("Verify email address", url)}
    ${fallbackLink("Verification link", url)}
    <p style="margin:24px 0 0;padding-top:24px;border-top:1px solid ${BORDER};color:#a3a3a3;font-size:12px;line-height:1.5;">
      This link expires in 24 hours. If you didn&apos;t create an Albiz account, you can safely ignore this email.
    </p>
  `);
  return { subject, html };
}

// ─── Password Reset ───────────────────────────────────────────────────────────

export function resetPasswordTemplate({ name, token }: { name: string; token: string }) {
  const url = `${APP_URL}/auth/reset-password?token=${token}`;
  const subject = "Reset your password";
  const html = baseTemplate(`
    <h1 style="margin:0 0 8px;color:${TEXT_PRIMARY};font-size:22px;font-weight:700;line-height:1.3;">
      Reset your password
    </h1>
    <p style="margin:0 0 4px;color:${TEXT_MUTED};font-size:14px;line-height:1.6;">
      Hi ${name},
    </p>
    <p style="margin:0;color:${TEXT_MUTED};font-size:14px;line-height:1.6;">
      We received a request to reset the password for your Albiz account. Click the button below to choose a new password.
    </p>
    ${ctaButton("Reset password", url)}
    ${fallbackLink("Reset link", url)}
    <p style="margin:24px 0 0;padding-top:24px;border-top:1px solid ${BORDER};color:#a3a3a3;font-size:12px;line-height:1.5;">
      This link expires in 1 hour. If you didn&apos;t request a password reset, you can safely ignore this email — your password will not be changed.
    </p>
  `);
  return { subject, html };
}

// ─── Welcome ──────────────────────────────────────────────────────────────────

export function welcomeTemplate({ name }: { name: string }) {
  const url = `${APP_URL}?verified=true`;
  const subject = "Welcome to Albiz";
  const html = baseTemplate(`
    <h1 style="margin:0 0 8px;color:${TEXT_PRIMARY};font-size:22px;font-weight:700;line-height:1.3;">
      Welcome to Albiz
    </h1>
    <p style="margin:0 0 4px;color:${TEXT_MUTED};font-size:14px;line-height:1.6;">
      Hi ${name},
    </p>
    <p style="margin:0;color:${TEXT_MUTED};font-size:14px;line-height:1.6;">
      Your account is verified and ready to go. Start following people, share your thoughts, and explore what&apos;s happening across the Albiz community.
    </p>
    ${ctaButton("Go to Albiz", url)}
    <p style="margin:24px 0 0;padding-top:24px;border-top:1px solid ${BORDER};color:#a3a3a3;font-size:12px;line-height:1.5;">
      Need help? Reply to this email and our team will get back to you.
    </p>
  `);
  return { subject, html };
}

// ─── Invite ───────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  CIRCLE: "Circle member",
  AUTHOR: "Author",
  ADMIN: "Admin",
  NORMAL: "Member",
};

export function inviteTemplate({
  inviterName,
  role,
  token,
  note,
}: {
  inviterName: string;
  role: string;
  token: string;
  note?: string;
}) {
  const url = `${APP_URL}/auth/accept-invite?token=${token}`;
  const roleLabel = ROLE_LABELS[role] ?? role;
  const subject = `You've been invited to Albiz`;
  const html = baseTemplate(`
    <h1 style="margin:0 0 8px;color:${TEXT_PRIMARY};font-size:22px;font-weight:700;line-height:1.3;">
      You&apos;re invited
    </h1>
    <p style="margin:0 0 16px;color:${TEXT_MUTED};font-size:14px;line-height:1.6;">
      <strong style="color:${TEXT_PRIMARY};font-weight:600;">${inviterName}</strong> has invited you to join Albiz as a <strong style="color:${TEXT_PRIMARY};font-weight:600;">${roleLabel}</strong>.
    </p>
    ${note ? `<p style="margin:0 0 4px;padding:14px 16px;background:#f9f9f9;border-left:3px solid ${BORDER};border-radius:0 8px 8px 0;color:${TEXT_MUTED};font-size:13px;line-height:1.6;font-style:italic;">&ldquo;${note}&rdquo;</p>` : ""}
    ${ctaButton("Accept invitation", url)}
    ${fallbackLink("Invite link", url)}
    <p style="margin:24px 0 0;padding-top:24px;border-top:1px solid ${BORDER};color:#a3a3a3;font-size:12px;line-height:1.5;">
      This invitation expires in 7 days. If you weren&apos;t expecting this, you can safely ignore it.
    </p>
  `);
  return { subject, html };
}

// ─── Export all for admin preview ─────────────────────────────────────────────

export const EMAIL_TEMPLATES = [
  {
    id: "verify-email",
    name: "Email Verification",
    description: "Sent when a new user signs up",
    preview: () => verifyEmailTemplate({ name: "Alex Johnson", token: "preview-token-abc123" }),
  },
  {
    id: "reset-password",
    name: "Password Reset",
    description: "Sent when a user requests a password reset",
    preview: () => resetPasswordTemplate({ name: "Alex Johnson", token: "preview-token-abc123" }),
  },
  {
    id: "welcome",
    name: "Welcome",
    description: "Sent after a user verifies their email",
    preview: () => welcomeTemplate({ name: "Alex Johnson" }),
  },
  {
    id: "invite",
    name: "Invitation",
    description: "Sent when an admin invites someone to a role",
    preview: () =>
      inviteTemplate({
        inviterName: "Jessin Sam",
        role: "AUTHOR",
        token: "preview-token-abc123",
        note: "Would love to have you write for the platform.",
      }),
  },
];
