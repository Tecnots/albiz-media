-- Migration: Shorts recommendation engine schema additions
-- Adds recommendation and moderation columns to Short, and creates ShortWatchEvent.

-- ── Short table additions ─────────────────────────────────────────────────────

ALTER TABLE "Short"
  ADD COLUMN IF NOT EXISTS "comments"     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tags"         TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "countryCode"  TEXT,
  ADD COLUMN IF NOT EXISTS "contentScope" TEXT    NOT NULL DEFAULT 'GLOBAL',
  ADD COLUMN IF NOT EXISTS "flagged"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "flagReason"   TEXT;

-- ── Indexes on Short ─────────────────────────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Short_status_flagged_idx"
  ON "Short" ("status", "flagged");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Short_countryCode_idx"
  ON "Short" ("countryCode");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Short_publishedAt_idx"
  ON "Short" ("publishedAt" DESC NULLS LAST);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Short_userId_publishedAt_idx"
  ON "Short" ("userId", "publishedAt" DESC NULLS LAST);

-- GIN index for tag-overlap queries (&&) on Short.tags
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Short_tags_gin_idx"
  ON "Short" USING GIN ("tags");

-- ── ShortWatchEvent table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ShortWatchEvent" (
  "id"         SERIAL PRIMARY KEY,
  "shortId"    INTEGER NOT NULL REFERENCES "Short"("id") ON DELETE CASCADE,
  "userId"     INTEGER,
  "sessionId"  TEXT,
  "watchedMs"  INTEGER NOT NULL DEFAULT 0,
  "durationMs" INTEGER NOT NULL DEFAULT 0,
  "watchPct"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "completed"  BOOLEAN NOT NULL DEFAULT false,
  "loopCount"  INTEGER NOT NULL DEFAULT 0,
  "fastSkip"   BOOLEAN NOT NULL DEFAULT false,
  "action"     TEXT NOT NULL DEFAULT 'view',
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ShortWatchEvent_shortId_idx"
  ON "ShortWatchEvent" ("shortId");

CREATE INDEX IF NOT EXISTS "ShortWatchEvent_userId_createdAt_idx"
  ON "ShortWatchEvent" ("userId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "ShortWatchEvent_shortId_createdAt_idx"
  ON "ShortWatchEvent" ("shortId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "ShortWatchEvent_userId_shortId_idx"
  ON "ShortWatchEvent" ("userId", "shortId");