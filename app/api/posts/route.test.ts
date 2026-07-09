import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  queryRawMock,
  executeRawMock,
  postCreateMock,
  postFindManyMock,
  postDeleteMock,
  postFindUniqueMock,
  postUpdateMock,
  getAuthUserMock,
  rateLimitMock,
  autoAssignEditorMock,
  transitionPostStateMock,
} = vi.hoisted(() => ({
  queryRawMock: vi.fn(),
  executeRawMock: vi.fn(),
  postCreateMock: vi.fn(),
  postFindManyMock: vi.fn(),
  postDeleteMock: vi.fn(),
  postFindUniqueMock: vi.fn(),
  postUpdateMock: vi.fn(),
  getAuthUserMock: vi.fn(),
  rateLimitMock: vi.fn(),
  autoAssignEditorMock: vi.fn(),
  transitionPostStateMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: queryRawMock,
    $executeRaw: executeRawMock,
    post: {
      create: postCreateMock,
      findMany: postFindManyMock,
      delete: postDeleteMock,
      findUnique: postFindUniqueMock,
      update: postUpdateMock,
    },
    // Only exercised by the "notify followers of a published Circle post"
    // side path, which these tests aren't asserting on — resolving null
    // keeps that path a clean no-op instead of throwing into the route's
    // own catch block and spamming test output.
    user: { findUnique: vi.fn().mockResolvedValue(null) },
    editorSectionAssignment: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}));
vi.mock("@/app/lib/auth", () => ({ getAuthUser: getAuthUserMock, unauthorized: () => Response.json({ error: "Unauthorized" }, { status: 401 }) }));
vi.mock("@/lib/blob-storage", () => ({ blobStorageService: { resolveMediaUrl: (v: string | null) => v } }));
vi.mock("@/lib/circle-email-service", () => ({ sendNewPostEmail: vi.fn() }));
vi.mock("@/lib/editor-workflow", () => ({ transitionPostState: transitionPostStateMock }));
vi.mock("@/lib/editor-assignment", () => ({ autoAssignEditor: autoAssignEditorMock }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: rateLimitMock }));
vi.mock("@/lib/html-sanitize", () => ({ sanitizeHtml: (s: string) => s }));

import { GET, POST, PUT } from "@/app/api/posts/route";

function getReq(qs: string) {
  return new NextRequest(`https://albizmedia.com/api/posts${qs}`, { method: "GET" });
}
function postReq(body: unknown) {
  return new NextRequest("https://albizmedia.com/api/posts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
function putReq(body: unknown) {
  return new NextRequest("https://albizmedia.com/api/posts", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Regression coverage for audit findings C-2 (Circle-authored content with
// no status field bypassed the workflow entirely, including for Articles)
// and C-4 (GET /api/posts?status=all with no userId was a fully
// unauthenticated dump of every post regardless of status/flagged state).

describe("GET /api/posts?status=all (C-4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    postFindManyMock.mockResolvedValue([]);
  });

  it("rejects an unauthenticated request for the full unfiltered listing", async () => {
    getAuthUserMock.mockResolvedValue(null);
    const res = await GET(getReq("?status=all"));
    expect(res.status).toBe(401);
    expect(postFindManyMock).not.toHaveBeenCalled();
  });

  it("rejects a non-admin authenticated request", async () => {
    getAuthUserMock.mockResolvedValue({ id: 5, role: "AUTHOR" });
    const res = await GET(getReq("?status=all"));
    expect(res.status).toBe(401);
    expect(postFindManyMock).not.toHaveBeenCalled();
  });

  it("allows an ADMIN to fetch the full unfiltered listing", async () => {
    getAuthUserMock.mockResolvedValue({ id: 1, role: "ADMIN" });
    const res = await GET(getReq("?status=all"));
    expect(res.status).toBe(200);
    expect(postFindManyMock).toHaveBeenCalled();
  });
});

describe("POST /api/posts — status-less create (C-2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitMock.mockResolvedValue({ allowed: true });
    queryRawMock.mockResolvedValue([]);
    postCreateMock.mockResolvedValue({ id: 1, userId: 1, type: "POST", title: null, description: null, content: null, date: "x", time: "x", image: null, tags: [] });
    executeRawMock.mockResolvedValue(1);
  });

  it("a CIRCLE user creating type=post with no status still auto-publishes (intended, unmoderated feed)", async () => {
    getAuthUserMock.mockResolvedValue({ id: 1, role: "CIRCLE", canPost: false, name: "Circle User" });
    postCreateMock.mockResolvedValue({ id: 1, userId: 1, type: "POST", title: null, description: null, content: null, date: "x", time: "x", image: null, tags: [] });
    const res = await POST(postReq({ type: "post", title: "hi" }));
    expect(res.status).toBe(200);
    // The raw publish UPDATE runs for the unmoderated feed-post path.
    expect(executeRawMock).toHaveBeenCalled();
  });

  it("a CIRCLE user creating type=article with no status is left as draft, not silently published (the actual C-2 bug)", async () => {
    getAuthUserMock.mockResolvedValue({ id: 1, role: "CIRCLE", canPost: false, name: "Circle User" });
    postCreateMock.mockResolvedValue({ id: 1, userId: 1, type: "ARTICLE", title: null, description: null, content: null, date: "x", time: "x", image: null, tags: [] });
    const res = await POST(postReq({ type: "article", title: "hi" }));
    expect(res.status).toBe(200);
    // No raw publish UPDATE should fire for an Article with no status — it
    // must stay in the draft state it was created with.
    expect(executeRawMock).not.toHaveBeenCalled();
  });

  it("a NORMAL user cannot create type=post at all (unrelated existing gate, sanity check)", async () => {
    getAuthUserMock.mockResolvedValue({ id: 1, role: "NORMAL", canPost: false, name: "Normal User" });
    const res = await POST(postReq({ type: "post", title: "hi" }));
    expect(res.status).toBe(403);
    expect(postCreateMock).not.toHaveBeenCalled();
  });
});

describe("PUT /api/posts — content write ordering around the optimistic lock (H-5 follow-up)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthUserMock.mockResolvedValue({ id: 1, role: "AUTHOR", canPost: false, name: "Author" });
    postFindUniqueMock.mockResolvedValue({ status: "draft", userId: 1, assignedEditorId: null, sectionId: null, type: "ARTICLE" });
    postUpdateMock.mockResolvedValue({});
  });

  it("does NOT write content changes when the status transition conflicts — previously the content write ran first and persisted despite the reported failure", async () => {
    transitionPostStateMock.mockRejectedValue(new Error("CONFLICT: this article's status changed since you last loaded it. Refresh and try again."));
    const res = await PUT(putReq({ postId: 1, status: "submitted", title: "A sneaky edit" }));
    expect(res.status).toBe(409);
    expect(postUpdateMock).not.toHaveBeenCalled();
  });

  it("writes content changes after a successful status transition", async () => {
    transitionPostStateMock.mockResolvedValue(undefined);
    const res = await PUT(putReq({ postId: 1, status: "submitted", title: "A real edit" }));
    expect(res.status).toBe(200);
    expect(postUpdateMock).toHaveBeenCalledWith({ where: { id: 1 }, data: expect.objectContaining({ title: "A real edit" }) });
  });

  it("writes content changes immediately when no status change is requested (unaffected by the reorder)", async () => {
    const res = await PUT(putReq({ postId: 1, title: "Just a title edit" }));
    expect(res.status).toBe(200);
    expect(postUpdateMock).toHaveBeenCalledWith({ where: { id: 1 }, data: expect.objectContaining({ title: "Just a title edit" }) });
    expect(transitionPostStateMock).not.toHaveBeenCalled();
  });
});
