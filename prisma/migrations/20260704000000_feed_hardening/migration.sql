-- Feed Hardening Migration
-- Adds integer engagement counters, moderation indexes, and GIN index for tag queries.

-- ── Integer engagement counter columns ───────────────────────────────────────
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "likesCount"    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "commentsCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "sharesCount"   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "viewsCount"    INTEGER NOT NULL DEFAULT 0;

-- Backfill: parse the human-readable string counters (e.g. "1.5k", "2M") into integers.
-- Keeps the display strings intact; ranking engine will use the integer columns going forward.
UPDATE "Post" SET
  "likesCount" = CASE
    WHEN LOWER(TRIM(likes))    LIKE '%m' THEN (CAST(REPLACE(REPLACE(LOWER(TRIM(likes)),    'm',''),',','') AS FLOAT) * 1000000)::INTEGER
    WHEN LOWER(TRIM(likes))    LIKE '%k' THEN (CAST(REPLACE(REPLACE(LOWER(TRIM(likes)),    'k',''),',','') AS FLOAT) * 1000)::INTEGER
    ELSE COALESCE(CAST(NULLIF(REPLACE(TRIM(likes),    ',',''),'') AS INTEGER), 0)
  END,
  "commentsCount" = CASE
    WHEN LOWER(TRIM(comments)) LIKE '%m' THEN (CAST(REPLACE(REPLACE(LOWER(TRIM(comments)),'m',''),',','') AS FLOAT) * 1000000)::INTEGER
    WHEN LOWER(TRIM(comments)) LIKE '%k' THEN (CAST(REPLACE(REPLACE(LOWER(TRIM(comments)),'k',''),',','') AS FLOAT) * 1000)::INTEGER
    ELSE COALESCE(CAST(NULLIF(REPLACE(TRIM(comments), ',',''),'') AS INTEGER), 0)
  END,
  "sharesCount" = CASE
    WHEN LOWER(TRIM(shares))   LIKE '%m' THEN (CAST(REPLACE(REPLACE(LOWER(TRIM(shares)),  'm',''),',','') AS FLOAT) * 1000000)::INTEGER
    WHEN LOWER(TRIM(shares))   LIKE '%k' THEN (CAST(REPLACE(REPLACE(LOWER(TRIM(shares)),  'k',''),',','') AS FLOAT) * 1000)::INTEGER
    ELSE COALESCE(CAST(NULLIF(REPLACE(TRIM(shares),   ',',''),'') AS INTEGER), 0)
  END,
  "viewsCount" = CASE
    WHEN LOWER(TRIM(views))    LIKE '%m' THEN (CAST(REPLACE(REPLACE(LOWER(TRIM(views)),   'm',''),',','') AS FLOAT) * 1000000)::INTEGER
    WHEN LOWER(TRIM(views))    LIKE '%k' THEN (CAST(REPLACE(REPLACE(LOWER(TRIM(views)),   'k',''),',','') AS FLOAT) * 1000)::INTEGER
    ELSE COALESCE(CAST(NULLIF(REPLACE(TRIM(views),    ',',''),'') AS INTEGER), 0)
  END;

-- ── Post moderation / feed-filter indexes ────────────────────────────────────
-- Covers: WHERE status = 'published' AND flagged = false  (compound, most common query shape)
CREATE INDEX IF NOT EXISTS "Post_status_flagged_idx"  ON "Post" ("status", "flagged");
-- Standalone status for queries that don't filter on flagged
CREATE INDEX IF NOT EXISTS "Post_status_idx"          ON "Post" ("status");
-- Geo-filtering: WHERE UPPER("countryCode") = UPPER(?)
CREATE INDEX IF NOT EXISTS "Post_countryCode_idx"     ON "Post" ("countryCode");

-- ── Blocking / muting look-up indexes ────────────────────────────────────────
-- Reverse blocking: SELECT blockerId FROM BlockedUser WHERE blockedId = ?
CREATE INDEX IF NOT EXISTS "BlockedUser_blockedId_idx" ON "BlockedUser" ("blockedId");
-- Muted-by look-up: SELECT userId FROM UserMute WHERE mutedId = ?
CREATE INDEX IF NOT EXISTS "UserMute_mutedId_idx"      ON "UserMute" ("mutedId");

-- ── GIN index for array overlap (&&) queries on Post.tags ───────────────────
-- Prisma doesn't generate GIN indexes natively; required for Phoenix pool tag queries.
CREATE INDEX IF NOT EXISTS "Post_tags_gin_idx" ON "Post" USING GIN ("tags");