import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  findUniqueMock,
  updateManyMock,
  shortActivityCreateMock,
  getAuthUserMock,
  notifyMock,
  jobUpdateMock,
} = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  updateManyMock: vi.fn(),
  shortActivityCreateMock: vi.fn(),
  getAuthUserMock: vi.fn(),
  notifyMock: vi.fn(),
  jobUpdateMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    short: { findUnique: findUniqueMock, updateMany: updateManyMock, update: vi.fn() },
    shortActivity: { create: shortActivityCreateMock },
    job: { create: vi.fn(), update: jobUpdateMock },
    $transaction: vi.fn(async (fn: any) => fn({ $queryRaw: vi.fn().mockResolvedValue([{ status: "approved" }]), job: { create: vi.fn() }, $executeRaw: vi.fn().mockResolvedValue(1) })),
  },
  Prisma: { sql: (strings: TemplateStringsArray, ...vals: any[]) => ({ strings, vals }) },
}));

vi.mock("@/app/lib/auth", () => ({ getAuthUser: getAuthUserMock }));
vi.mock("@/lib/workflow-notifications", () => ({ notifyUploaderOfShortDecision: notifyMock }));

import { PATCH } from "@/app/api/admin/shorts/[id]/route";

function req(body: unknown) {
  return new NextRequest("https://albizmedia.com/api/admin/shorts/1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
function params(id = "1") {
  return { params: Promise.resolve({ id }) };
}

const baseShort = {
  id: 1,
  status: "in_review",
  title: "A short",
  scheduleJobId: null,
  user: { id: 42, email: "uploader@example.com", name: "Uploader" },
};

// Regression coverage for audit findings: RBAC on Shorts moderation, the
// TRANSITION_MAP state-machine guard, the H-5 optimistic lock, and the new
// claim/release reviewer-assignment mechanism (M-13/L-8 follow-up feature).

describe("PATCH /api/admin/shorts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUniqueMock.mockResolvedValue({ ...baseShort });
    updateManyMock.mockResolvedValue({ count: 1 });
    notifyMock.mockResolvedValue(undefined);
    shortActivityCreateMock.mockResolvedValue({});
    jobUpdateMock.mockResolvedValue({});
  });

  it("rejects unauthenticated callers", async () => {
    getAuthUserMock.mockResolvedValue(null);
    const res = await PATCH(req({ action: "approve" }), params());
    expect(res.status).toBe(401);
  });

  it("rejects non-admin callers (e.g. an UPLOADER trying to self-approve)", async () => {
    getAuthUserMock.mockResolvedValue({ id: 42, role: "UPLOADER" });
    const res = await PATCH(req({ action: "approve" }), params());
    expect(res.status).toBe(403);
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it("allows ADMIN to approve an in_review short", async () => {
    getAuthUserMock.mockResolvedValue({ id: 1, role: "ADMIN" });
    const res = await PATCH(req({ action: "approve" }), params());
    expect(res.status).toBe(200);
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { id: 1, status: "in_review" },
      data: expect.objectContaining({ status: "approved" }),
    });
    expect(notifyMock).toHaveBeenCalled();
  });

  it("rejects an illegal transition (e.g. approving an already-published short)", async () => {
    findUniqueMock.mockResolvedValue({ ...baseShort, status: "published" });
    getAuthUserMock.mockResolvedValue({ id: 1, role: "ADMIN" });
    const res = await PATCH(req({ action: "approve" }), params());
    expect(res.status).toBe(422);
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it("requires a rejection note when rejecting", async () => {
    getAuthUserMock.mockResolvedValue({ id: 1, role: "ADMIN" });
    const res = await PATCH(req({ action: "reject" }), params());
    expect(res.status).toBe(400);
  });

  it("surfaces a 409 conflict when the optimistic lock affects zero rows", async () => {
    getAuthUserMock.mockResolvedValue({ id: 1, role: "ADMIN" });
    updateManyMock.mockResolvedValue({ count: 0 });
    const res = await PATCH(req({ action: "approve" }), params());
    expect(res.status).toBe(409);
  });

  it("claim sets assignedAdminId to the caller and logs activity", async () => {
    getAuthUserMock.mockResolvedValue({ id: 7, role: "ADMIN" });
    const updateSpy = vi.fn().mockResolvedValue({});
    findUniqueMock.mockResolvedValue({ ...baseShort });
    const { prisma } = await import("@/lib/prisma");
    (prisma.short as any).update = updateSpy;
    const res = await PATCH(req({ action: "claim" }), params());
    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledWith({ where: { id: 1 }, data: { assignedAdminId: 7 } });
    expect(shortActivityCreateMock).toHaveBeenCalled();
  });

  it("release clears assignedAdminId regardless of who claimed it", async () => {
    getAuthUserMock.mockResolvedValue({ id: 7, role: "ADMIN" });
    const updateSpy = vi.fn().mockResolvedValue({});
    const { prisma } = await import("@/lib/prisma");
    (prisma.short as any).update = updateSpy;
    const res = await PATCH(req({ action: "release" }), params());
    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledWith({ where: { id: 1 }, data: { assignedAdminId: null } });
  });

  it("rejecting a scheduled short clears scheduleJobId and cancels the pending job (regression: caught by self-review)", async () => {
    getAuthUserMock.mockResolvedValue({ id: 1, role: "ADMIN" });
    findUniqueMock.mockResolvedValue({ ...baseShort, status: "scheduled", scheduleJobId: "job-abc" });
    const res = await PATCH(req({ action: "reject", rejectionNote: "not good enough" }), params());
    expect(res.status).toBe(200);
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { id: 1, status: "scheduled" },
      data: expect.objectContaining({ status: "rejected", scheduleJobId: null }),
    });
    expect(jobUpdateMock).toHaveBeenCalledWith({
      where: { id: "job-abc" },
      data: expect.objectContaining({ status: "dead" }),
    });
  });

  it("rejecting a non-scheduled short does not touch the job queue", async () => {
    getAuthUserMock.mockResolvedValue({ id: 1, role: "ADMIN" });
    findUniqueMock.mockResolvedValue({ ...baseShort, status: "in_review", scheduleJobId: null });
    const res = await PATCH(req({ action: "reject", rejectionNote: "not good enough" }), params());
    expect(res.status).toBe(200);
    expect(jobUpdateMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid/unknown action", async () => {
    getAuthUserMock.mockResolvedValue({ id: 1, role: "ADMIN" });
    const res = await PATCH(req({ action: "self-destruct" }), params());
    expect(res.status).toBe(400);
  });
});
