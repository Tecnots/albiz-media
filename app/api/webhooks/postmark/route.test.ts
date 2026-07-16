import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { emailSuppressionUpsert, notifyAdminMock } = vi.hoisted(() => ({
  emailSuppressionUpsert: vi.fn(),
  notifyAdminMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { emailSuppression: { upsert: emailSuppressionUpsert } },
}));

vi.mock("@/lib/admin-notifier", () => ({ notifyAdmin: notifyAdminMock }));

import { POST } from "@/app/api/webhooks/postmark/route";

function req(body: unknown, opts?: { auth?: string }) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts?.auth !== undefined) headers.authorization = opts.auth;
  return new NextRequest("https://albizmedia.com/api/webhooks/postmark", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const basicAuth = "Basic " + Buffer.from("hook-user:hook-pass").toString("base64");

describe("POST /api/webhooks/postmark", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.POSTMARK_WEBHOOK_USER = "hook-user";
    process.env.POSTMARK_WEBHOOK_PASS = "hook-pass";
  });

  it("rejects requests with no Authorization header", async () => {
    const res = await POST(req({ RecordType: "Bounce" }));
    expect(res.status).toBe(401);
    expect(emailSuppressionUpsert).not.toHaveBeenCalled();
  });

  it("rejects requests with the wrong credentials", async () => {
    const res = await POST(req({ RecordType: "Bounce" }, { auth: "Basic d3Jvbmc6d3Jvbmc=" }));
    expect(res.status).toBe(401);
  });

  it("rejects everything when webhook credentials aren't configured", async () => {
    delete process.env.POSTMARK_WEBHOOK_USER;
    delete process.env.POSTMARK_WEBHOOK_PASS;
    const res = await POST(req({ RecordType: "Bounce" }, { auth: basicAuth }));
    expect(res.status).toBe(401);
  });

  it("suppresses the address and alerts admin on a spam complaint", async () => {
    const res = await POST(req({ RecordType: "SpamComplaint", Email: "Angry@Example.com" }, { auth: basicAuth }));
    expect(res.status).toBe(200);
    expect(emailSuppressionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "angry@example.com" }, create: expect.objectContaining({ reason: "complaint" }) })
    );
    expect(notifyAdminMock).toHaveBeenCalledWith(expect.objectContaining({ type: "SYSTEM" }));
  });

  it("suppresses the address on a hard bounce without alerting admin", async () => {
    const res = await POST(
      req({ RecordType: "Bounce", Type: "HardBounce", Email: "gone@example.com" }, { auth: basicAuth })
    );
    expect(res.status).toBe(200);
    expect(emailSuppressionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ reason: "bounce:HardBounce" }) })
    );
    expect(notifyAdminMock).not.toHaveBeenCalled();
  });

  it("ignores soft/transient bounces — the address may still be reachable later", async () => {
    const res = await POST(
      req({ RecordType: "Bounce", Type: "SoftBounce", Email: "maybe@example.com" }, { auth: basicAuth })
    );
    expect(res.status).toBe(200);
    expect(emailSuppressionUpsert).not.toHaveBeenCalled();
  });

  it("rejects a payload with no Email field", async () => {
    const res = await POST(req({ RecordType: "Bounce", Type: "HardBounce" }, { auth: basicAuth }));
    expect(res.status).toBe(400);
  });
});
