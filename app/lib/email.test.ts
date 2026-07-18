import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  sendMailMock,
  emailSuppressionFindUnique,
  emailLogCreate,
  emailLogUpdate,
  enqueueMock,
} = vi.hoisted(() => ({
  sendMailMock: vi.fn(),
  emailSuppressionFindUnique: vi.fn(),
  emailLogCreate: vi.fn(),
  emailLogUpdate: vi.fn(),
  enqueueMock: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  createTransport: vi.fn().mockReturnValue({ sendMail: sendMailMock }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailSuppression: { findUnique: emailSuppressionFindUnique },
    emailLog: { create: emailLogCreate, update: emailLogUpdate },
  },
}));

vi.mock("@/lib/job-queue", () => ({ enqueue: enqueueMock }));

import { sendEmail, sendViaSMTP, isSuppressed } from "@/app/lib/email";

describe("email pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_SECURE = "true";
    process.env.SMTP_USER = "test@gmail.com";
    process.env.SMTP_PASS = "test-pass";
    process.env.SMTP_FROM = "notifications@mail.albizmedia.com";
    process.env.SMTP_FROM_NAME = "Albiz";
    emailSuppressionFindUnique.mockResolvedValue(null);
    sendMailMock.mockResolvedValue({ messageId: "msg-1" });
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

  describe("sendViaSMTP", () => {
    it("skips the send entirely for a suppressed recipient", async () => {
      emailSuppressionFindUnique.mockResolvedValue({ email: "bounced@example.com" });
      await sendViaSMTP({ to: "bounced@example.com", subject: "Hi", html: "<p>Hi</p>" });
      expect(sendMailMock).not.toHaveBeenCalled();
    });

    it("sends both HTML and an auto-generated plain-text part", async () => {
      await sendViaSMTP({ to: "user@example.com", subject: "Verify", html: "<p>Click <a href='https://x.test'>here</a></p>" });
      expect(sendMailMock).toHaveBeenCalledTimes(1);
      const call = sendMailMock.mock.calls[0][0];
      expect(call.html).toContain("<a href=");
      expect(call.text).toContain("here");
      expect(call.text).not.toContain("<p>");
    });

    it("passes through custom headers (e.g. List-Unsubscribe)", async () => {
      await sendViaSMTP({
        to: "a@example.com",
        subject: "s",
        html: "<p>h</p>",
        headers: { "List-Unsubscribe": "<https://x.test/unsub>" },
      });
      expect(sendMailMock.mock.calls[0][0].headers).toEqual({
        "List-Unsubscribe": "<https://x.test/unsub>",
      });
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
      expect(sendMailMock).toHaveBeenCalledTimes(1);
      expect(emailLogUpdate).toHaveBeenCalledWith({
        where: { id: "log-1" },
        data: expect.objectContaining({ status: "sent" }),
      });
      expect(enqueueMock).not.toHaveBeenCalled();
    });

    it("falls back to the retry queue (not a thrown error) when the immediate send fails", async () => {
      emailLogCreate.mockResolvedValue({ id: "log-2" });
      sendMailMock.mockRejectedValue(new Error("SMTP connection refused"));

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
      sendMailMock.mockRejectedValue(new Error("SMTP connection refused"));

      await expect(
        sendEmail({ to: "user@example.com", subject: "Verify", html: "<p>hi</p>", templateKey: "verify-email" })
      ).rejects.toThrow("SMTP connection refused");
      expect(enqueueMock).not.toHaveBeenCalled();
    });
  });
});
