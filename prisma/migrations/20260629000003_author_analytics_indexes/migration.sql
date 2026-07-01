-- Analytics performance indexes for the Author role
-- Speeds up per-author queries in /api/analytics, /api/author/stats, and feed ranking

-- Post table: efficient per-author date-range queries
CREATE INDEX IF NOT EXISTS "Post_userId_createdAt_idx" ON "Post" ("userId", "createdAt" DESC);

-- PostLike: date-range filtering for engagement trends
CREATE INDEX IF NOT EXISTS "PostLike_createdAt_idx" ON "PostLike" ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "PostLike_postId_createdAt_idx" ON "PostLike" ("postId", "createdAt" DESC);

-- UserFollow: follower gain tracking per period
CREATE INDEX IF NOT EXISTS "UserFollow_followingId_createdAt_idx" ON "UserFollow" ("followingId", "createdAt" DESC);

-- PostImpression: per-post view time-series queries
CREATE INDEX IF NOT EXISTS "PostImpression_postId_seenAt_idx" ON "PostImpression" ("postId", "seenAt" DESC);
