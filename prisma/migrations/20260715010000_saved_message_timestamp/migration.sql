-- Saved Messages: track when a chat message was bookmarked so the
-- Saved → Chats tab can order by most-recently-saved.

ALTER TABLE "Message" ADD COLUMN "savedAt" TIMESTAMP(3);

-- Backfill existing bookmarks so they sort deterministically (fall back to the
-- message's creation time rather than sorting NULLs to the top).
UPDATE "Message" SET "savedAt" = "createdAt" WHERE "savedByUser" IS NOT NULL AND "savedAt" IS NULL;

CREATE INDEX "Message_savedByUser_savedAt_idx" ON "Message"("savedByUser", "savedAt");
