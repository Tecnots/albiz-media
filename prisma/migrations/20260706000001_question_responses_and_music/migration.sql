-- Migration: private Question sticker responses + curated music library
-- StoryQuestionResponse mirrors StoryPollVote exactly (one row per
-- story/sticker/user, upsert-on-conflict for "resubmit = update"). MusicTrack
-- backs the Story music sticker's default self-hosted provider.

-- ── StoryQuestionResponse ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "StoryQuestionResponse" (
    "id"          SERIAL PRIMARY KEY,
    "storyId"     INTEGER NOT NULL,
    "stickerId"   TEXT NOT NULL,
    "userId"      INTEGER NOT NULL,
    "answer"      TEXT NOT NULL,
    "respondedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StoryQuestionResponse_storyId_fkey'
  ) THEN
    ALTER TABLE "StoryQuestionResponse"
      ADD CONSTRAINT "StoryQuestionResponse_storyId_fkey"
      FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StoryQuestionResponse_userId_fkey'
  ) THEN
    ALTER TABLE "StoryQuestionResponse"
      ADD CONSTRAINT "StoryQuestionResponse_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "StoryQuestionResponse_storyId_stickerId_userId_key"
  ON "StoryQuestionResponse" ("storyId", "stickerId", "userId");

CREATE INDEX IF NOT EXISTS "StoryQuestionResponse_storyId_stickerId_idx"
  ON "StoryQuestionResponse" ("storyId", "stickerId");

-- ── MusicTrack ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "MusicTrack" (
    "id"         SERIAL PRIMARY KEY,
    "title"      TEXT NOT NULL,
    "artist"     TEXT NOT NULL,
    "category"   TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "audioUrl"   TEXT NOT NULL,
    "artworkUrl" TEXT,
    "active"     BOOLEAN NOT NULL DEFAULT true,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "MusicTrack_category_idx" ON "MusicTrack" ("category");
