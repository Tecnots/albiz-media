import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  sendEmailMock,
  emailSuppressionFindUnique,
  emailLogCreate,
  emailLogUpdate,
  enqueueMock,
} = vi.hoisted(() => ({
  sendEmailMock: vi.fn(),
  emailSuppressionFindUnique: vi.fn(),
  emailLogCreate: vi.fn(),
  emailLogUpdate: vi.fn(),
  enqueueMock: vi.fn(),
}));

vi.mock("postmark", () => ({
  ServerClient: vi.fn().mockImplementation(() => ({ sendEmail: sendEmailMock })),
  Models: { LinkTrackingOptions: { None: "None" } },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailSuppression: { findUnique: emailSuppressionFindUnique },
    emailLog: { create: emailLogCreate, update: emailLogUpdate },
  },
}));

vi.mock("@/lib/job-queue", () => ({ enqueue: enqueueMock }));

import { sendEmail, sendViaPostmark, isSuppressed } from "@/app/lib/email";

describe("email pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.POSTMARK_SERVER_TOKEN = "test-token";
    process.env.EMAIL_FROM = "notifications@mail.albizmedia.com";
    process.env.EMAIL_FROM_NAME = "Albiz";
    emailSuppressionFindUnique.mockResolvedValue(null);
    sendEmailMock.mockResolvedValue({ MessageID: "msg-1" });
    enqueueMock.mockResolvedValue("job-id");
    emailLogUpdate.mockResolvedValue({});
  });

  describe("isSuppressed", () => {
    it("returns false when the address has no suppression row", async () => {
      emailSuppressionFindUnique.mockResolvedValue(null);
      await expect(isSuppressed("user@example.com")).resolves.toBe(false);
    });

    it("returns true and lowercases/trims before lookup", async () => {
      emailSuppressionFindUnique.mockResolvedValue({ email: "user@example.com" });
      await expect(isSuppressed(" User@Example.com ")).resolves.toBe(true);
      expect(emailSuppressionFindUnique).toHaveBeenCalledWith({
        where: { email: "user@example.com" },
        select: { email: true },
      });
    });
  });

  describe("sendViaPostmark", () => {
    it("skips the send entirely for a suppressed recipient", async () => {
      emailSuppressionFindUnique.mockResolvedValue({ email: "bounced@example.com" });
      await sendViaPostmark({ to: "bounced@example.com", subject: "Hi", html: "<p>Hi</p>" });
      expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it("sends both HTML and an auto-generated plain-text part", async () => {
      await sendViaPostmark({ to: "user@example.com", subject: "Verify", html: "<p>Click <a href='https://x.test'>here</a></p>" });
      expect(sendEmailMock).toHaveBeenCalledTimes(1);
      const call = sendEmailMock.mock.calls[0][0];
      expect(call.HtmlBody).toContain("<a href=");
      expect(call.TextBody).toContain("here");
      expect(call.TextBody).not.toContain("<p>");
    });

    it("disables link click-tracking so auth links are never rewritten through a redirect domain", async () => {
      await sendViaPostmark({ to: "user@example.com", subject: "Verify", html: "<p>hi</p>" });
      expect(sendEmailMock.mock.calls[0][0].TrackLinks).toBe("None");
    });

    it("routes transactional mail to the outbound stream and marketing mail to the broadcast stream", async () => {
      await sendViaPostmark({ to: "a@example.com", subject: "s", html: "<p>h</p>", stream: "outbound" });
      expect(sendEmailMock.mock.calls[0][0].MessageStream).toBe("outbound");

      process.env.POSTMARK_BROADCAST_STREAM = "broadcast";
      await sendViaPostmark({ to: "a@example.com", subject: "s", html: "<p>h</p>", stream: "broadcast" });
      expect(sendEmailMock.mock.calls[1][0].MessageStream).toBe("broadcast");
    });

    it("passes through custom headers (e.g. List-Unsubscribe) as Postmark Header pairs", async () => {
      await sendViaPostmark({
        to: "a@example.com",
        subject: "s",
        html: "<p>h</p>",
        headers: { "List-Unsubscribe": "<https://x.test/unsub>" },
      });
      expect(sendEmailMock.mock.calls[0][0].Headers).toEqual([
        { Name: "List-Unsubscribe", Value: "<https://x.test/unsub>" },
      ]);
    });
  });

  describe("sendEmail (transactional wrapper)", () => {
    it("logs, sends immediately, and marks the EmailLog row sent on success", async () => {
      emailLogCreate.mockResolvedValue({ id: "log-1" });

      await sendEmail({ to: "user@example.com", subject: "Verify", html: "<p>hi</p>", templateKey: "verify-email" });

      expect(emailLogCreate).toHaveBeenCalledWith({
        data: { to: "user@example.com", subject: "Verify", templateKey: "verify-email", status: "queued" },
        select: { id: true },
      });
      expect(sendEmailMock).toHaveBeenCalledTimes(1);
      expect(emailLogUpdate).toHaveBeenCalledWith({
        where: { id: "log-1" },
        data: expect.objectContaining({ status: "sent" }),
      });
      expect(enqueueMock).not.toHaveBeenCalled();
    });

    it("falls back to the retry queue (not a thrown error) when the immediate send fails", async () => {
      emailLogCreate.mockResolvedValue({ id: "log-2" });
      sendEmailMock.mockRejectedValue(new Error("Postmark API down"));

      await expect(
        sendEmail({ to: "user@example.com", subject: "Verify", html: "<p>hi</p>", templateKey: "verify-email" })
      ).resolves.toBeUndefined();

      expect(enqueueMock).toHaveBeenCalledWith(
        "send-email",
        expect.objectContaining({ to: "user@example.com", templateKey: "verify-email", logId: "log-2" })
      );
      expect(emailLogUpdate).not.toHaveBeenCalled();
    });

    it("re-throws when even the EmailLog write failed (nothing to retry against)", async () => {
      emailLogCreate.mockRejectedValue(new Error("db down"));
      sendEmailMock.mockRejectedValue(new Error("Postmark API down"));

      await expect(
        sendEmail({ to: "user@example.com", subject: "Verify", html: "<p>hi</p>", templateKey: "verify-email" })
      ).rejects.toThrow("Postmark API down");
      expect(enqueueMock).not.toHaveBeenCalled();
    });
  });
});
