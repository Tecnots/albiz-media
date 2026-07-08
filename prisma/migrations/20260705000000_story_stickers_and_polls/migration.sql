-- Migration: Story sticker content + poll voting
-- Adds rotation/opacity/background-box columns for the text overlay, structured
-- location fields (for a real place-search picker), and a StoryPollVote table
-- for concurrency-safe poll voting (one vote per user per poll, live tallies).

ALTER TABLE "Story"
  ADD COLUMN IF NOT EXISTS "textRotation"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "textOpacity"         DOUBLE PRECISION NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "textBackgroundColor" TEXT,
  ADD COLUMN IF NOT EXISTS "locationLat"         DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "locationLng"         DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "locationPlaceId"     TEXT;

-- ── StoryPollVote ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "StoryPollVote" (
    "id"        SERIAL PRIMARY KEY,
    "storyId"   INTEGER NOT NULL,
    "stickerId" TEXT NOT NULL,
    "userId"    INTEGER NOT NULL,
    "option"    INTEGER NOT NULL,
    "votedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StoryPollVote_storyId_fkey'
  ) THEN
    ALTER TABLE "StoryPollVote"
      ADD CONSTRAINT "StoryPollVote_storyId_fkey"
      FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StoryPollVote_userId_fkey'
  ) THEN
    ALTER TABLE "StoryPollVote"
      ADD CONSTRAINT "StoryPollVote_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "StoryPollVote_storyId_stickerId_userId_key"
  ON "StoryPollVote" ("storyId", "stickerId", "userId");

CREATE INDEX IF NOT EXISTS "StoryPollVote_storyId_stickerId_idx"
  ON "StoryPollVote" ("storyId", "stickerId");
