const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

const BRAND_RED = "#F44444";
const BRAND_DARK = "#0a0a0a";
const CARD_BG = "#141414";
const TEXT_PRIMARY = "#e5e5e5";
const TEXT_MUTED = "#737373";
const BORDER = "#262626";

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Albiz</title>
</head>
<body style="margin:0;padding:0;background:${BRAND_DARK};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND_DARK};min-height:100vh;">
    <tr>
      <td align="center" style="padding:48px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <a href="${APP_URL}" style="display:inline-block;text-decoration:none;">
                <img src="cid:albizlogo" alt="Albiz" width="40" height="35" style="display:block;border:0;" />
              </a>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:${CARD_BG};border-radius:16px;border:1px solid ${BORDER};padding:40px 40px 36px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:28px;">
              <p style="margin:0 0 8px;color:${TEXT_MUTED};font-size:12px;line-height:1.6;">
                You received this email because you have an account on
                <a href="${APP_URL}" style="color:${TEXT_MUTED};text-decoration:underline;">Albiz</a>.
              </p>
              <p style="margin:0;color:#3a3a3a;font-size:11px;">
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
  return `<p style="margin:20px 0 0;color:${TEXT_MUTED};font-size:12px;">
    If the button above doesn&apos;t work, copy and paste this link into your browser:<br />
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
    <p style="margin:24px 0 0;padding-top:24px;border-top:1px solid ${BORDER};color:#3a3a3a;font-size:12px;line-height:1.5;">
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
    <p style="margin:24px 0 0;padding-top:24px;border-top:1px solid ${BORDER};color:#3a3a3a;font-size:12px;line-height:1.5;">
      This link expires in 1 hour. If you didn&apos;t request a password reset, you can safely ignore this email — your password will not be changed.
    </p>
  `);
  return { subject, html };
}

// ─── Welcome ──────────────────────────────────────────────────────────────────

export function welcomeTemplate({ name }: { name: string }) {
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
    ${ctaButton("Go to Albiz", APP_URL)}
    <p style="margin:24px 0 0;padding-top:24px;border-top:1px solid ${BORDER};color:#3a3a3a;font-size:12px;line-height:1.5;">
      Need help? Reply to this email and our team will get back to you.
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
];
