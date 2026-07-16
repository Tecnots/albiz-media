import { describe, it, expect, vi, beforeEach } from "vitest";

const { userFindUnique, userUpdate, sendEmailMock, rateLimitMock } = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  sendEmailMock: vi.fn(),
  rateLimitMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: userFindUnique, update: userUpdate } },
}));

vi.mock("@/app/lib/email", () => ({ sendEmail: sendEmailMock }));
vi.mock("@/app/lib/email-templates", () => ({
  verifyEmailTemplate: () => ({ subject: "Verify your email address", html: "<p>verify</p>" }),
}));
vi.mock("@/app/lib/auth-crypto", () => ({ generateToken: () => "tok" }));
vi.mock("@/lib/audit", () => ({ extractIp: () => "1.2.3.4" }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: rateLimitMock }));

import { POST } from "@/app/api/auth/resend-verification/route";

function req(body: unknown) {
  return new Request("https://albizmedia.com/api/auth/resend-verification", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const ALLOWED = { allowed: true, remaining: 4, resetAt: Date.now() + 900_000 };
const BLOCKED = { allowed: false, remaining: 0, resetAt: Date.now() + 900_000 };

describe("POST /api/auth/resend-verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitMock.mockResolvedValue(ALLOWED);
    userFindUnique.mockResolvedValue({ id: 1, name: "Alex", email: "alex@example.com", emailVerified: null });
  });

  it("sends a fresh verification email when under the rate limit", async () => {
    const res = await POST(req({ email: "alex@example.com" }));
    expect(res.status).toBe(200);
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "alex@example.com", templateKey: "verify-email" })
    );
    expect(userUpdate).toHaveBeenCalled();
  });

  it("blocks with 429 once the per-email limit is exceeded, without leaking whether the account exists", async () => {
    rateLimitMock.mockImplementation(async (key: string) =>
      key.startsWith("resend-verification:email:") ? BLOCKED : ALLOWED
    );
    const res = await POST(req({ email: "alex@example.com" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it("blocks with 429 once the per-IP limit is exceeded", async () => {
    rateLimitMock.mockImplementation(async (key: string) =>
      key.startsWith("resend-verification:ip:") ? BLOCKED : ALLOWED
    );
    const res = await POST(req({ email: "alex@example.com" }));
    expect(res.status).toBe(429);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("does not reveal account existence for an unknown email", async () => {
    userFindUnique.mockResolvedValue(null);
    const res = await POST(req({ email: "nobody@example.com" }));
    expect(res.status).toBe(200);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("refuses to resend for an already-verified account", async () => {
    userFindUnique.mockResolvedValue({ id: 1, name: "Alex", email: "alex@example.com", emailVerified: new Date() });
    const res = await POST(req({ email: "alex@example.com" }));
    expect(res.status).toBe(400);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
