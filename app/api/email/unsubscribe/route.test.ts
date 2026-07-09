import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { userFindUnique, userUpdate } = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: userFindUnique, update: userUpdate } },
}));

import { generateUnsubscribeToken } from "@/lib/unsubscribe-token";
import { GET, POST } from "@/app/api/email/unsubscribe/route";

function getReq(token: string) {
  return new NextRequest(`https://albizmedia.com/api/email/unsubscribe?u=${encodeURIComponent(token)}`);
}
function postReq(token: string, accept = "text/html") {
  return new NextRequest(`https://albizmedia.com/api/email/unsubscribe?u=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { accept },
  });
}

describe("/api/email/unsubscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXTAUTH_SECRET = "test-secret-for-hmac-signing";
    userFindUnique.mockResolvedValue({ notificationPrefs: { email: { marketing: true, follows: true } } });
  });

  it("GET shows a confirmation page without unsubscribing yet", async () => {
    const token = generateUnsubscribeToken(1);
    const res = await GET(getReq(token));
    expect(res.status).toBe(200);
    expect(userUpdate).not.toHaveBeenCalled();
    const body = await res.text();
    expect(body).toContain("Unsubscribe from marketing emails");
  });

  it("GET with an invalid token shows an error, not a confirmation form", async () => {
    const res = await GET(getReq("garbage.token"));
    const body = await res.text();
    expect(body).toContain("invalid or has expired");
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("POST (one-click) flips notificationPrefs.email.marketing to false and preserves other prefs", async () => {
    const token = generateUnsubscribeToken(1);
    const res = await POST(postReq(token, "application/json"));
    expect(res.status).toBe(200);
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { notificationPrefs: { email: { marketing: false, follows: true } } },
    });
  });

  it("POST returns an HTML confirmation for browser form submissions", async () => {
    const token = generateUnsubscribeToken(1);
    const res = await POST(postReq(token, "text/html"));
    const body = await res.text();
    expect(body).toContain("unsubscribed");
  });

  it("POST with an invalid token does not touch the database", async () => {
    const res = await POST(postReq("garbage.token"));
    expect(res.status).toBe(400);
    expect(userUpdate).not.toHaveBeenCalled();
  });
});
