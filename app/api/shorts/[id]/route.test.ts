import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { shortFindUnique, shortUpdate } = vi.hoisted(() => ({
  shortFindUnique: vi.fn(),
  shortUpdate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { short: { findUnique: shortFindUnique, update: shortUpdate } } }));
vi.mock("@/app/lib/auth", () => ({ getAuthUser: vi.fn().mockResolvedValue({ id: 1, role: "UPLOADER" }) }));
vi.mock("@/lib/blob-storage", () => ({ blobStorageService: { resolveMediaUrl: (v: string | null) => v } }));
vi.mock("@/lib/job-queue", () => ({ enqueue: vi.fn().mockResolvedValue("job-1") }));

import { PATCH } from "@/app/api/shorts/[id]/route";

function req(body: unknown) {
  return new NextRequest("https://albizmedia.com/api/shorts/1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
function params() {
  return { params: Promise.resolve({ id: "1" }) };
}

// Regression coverage: the M-12 media-URL validation fix crashed with an
// unhandled 500 (`Cannot read properties of null (reading 'trim')`) instead
// of a clean 400 when a client sent an explicit `videoUrl: null` — caught by
// this pass's own adversarial self-review, not by the original test suite.

describe("PATCH /api/shorts/[id] — null media URL handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shortFindUnique.mockResolvedValue({ id: 1, userId: 1, status: "draft" });
    shortUpdate.mockResolvedValue({ id: 1, videoUrl: "https://cdn.example.com/v.mp4", thumbnailUrl: null });
  });

  it("returns a clean 400 (not a 500) when videoUrl is explicitly null", async () => {
    const res = await PATCH(req({ videoUrl: null }), params());
    expect(res.status).toBe(400);
  });

  it("returns a clean 400 when videoUrl is an empty string", async () => {
    const res = await PATCH(req({ videoUrl: "" }), params());
    expect(res.status).toBe(400);
  });

  it("returns a clean 400 (not a 500) when videoUrl is an unsafe URL", async () => {
    const res = await PATCH(req({ videoUrl: "http://169.254.169.254/" }), params());
    expect(res.status).toBe(400);
  });

  it("accepts videoUrl: null being absent entirely (field not included in the update)", async () => {
    const res = await PATCH(req({ title: "New title" }), params());
    expect(res.status).toBe(200);
  });

  it("accepts thumbnailUrl explicitly set to null (clearing it is legitimate)", async () => {
    const res = await PATCH(req({ thumbnailUrl: null }), params());
    expect(res.status).toBe(200);
    expect(shortUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ thumbnailUrl: null }) }));
  });

  it("accepts a valid videoUrl update", async () => {
    const res = await PATCH(req({ videoUrl: "https://cdn.example.com/new.mp4" }), params());
    expect(res.status).toBe(200);
  });
});
