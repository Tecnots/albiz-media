-- Messaging engine: real-time sync + structural duplicate prevention.

-- 1. Per-message change tracking. The conversation poll filters on this so
--    edits / deletes / status changes propagate without touching Conversation.
ALTER TABLE "Message" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 2. Deduplicate existing conversations before enforcing uniqueness.
--    Keep the lowest id per (participantId, userId), repoint every orphaned
--    message onto it, then delete the now-empty duplicate rows. Rows with a
--    NULL participantId are legacy/system views and are left untouched (NULLs
--    are always distinct under the unique index).
UPDATE "Message" m
SET "conversationId" = keep.keep_id
FROM (
  SELECT id AS dup_id,
         MIN(id) OVER (PARTITION BY "participantId", "userId") AS keep_id
  FROM "Conversation"
  WHERE "participantId" IS NOT NULL
) keep
WHERE m."conversationId" = keep.dup_id
  AND keep.dup_id <> keep.keep_id;

DELETE FROM "Conversation" c
USING (
  SELECT id AS dup_id,
         MIN(id) OVER (PARTITION BY "participantId", "userId") AS keep_id
  FROM "Conversation"
  WHERE "participantId" IS NOT NULL
) keep
WHERE c.id = keep.dup_id
  AND keep.dup_id <> keep.keep_id;

-- 3. Structural guarantee: one conversation view per (owner, other user).
CREATE UNIQUE INDEX "Conversation_participantId_userId_key" ON "Conversation"("participantId", "userId");

-- 4. Indexes supporting newest-first paging and the message-aware poll filter.
CREATE INDEX "Message_conversationId_id_idx" ON "Message"("conversationId", "id");
CREATE INDEX "Message_conversationId_updatedAt_idx" ON "Message"("conversationId", "updatedAt");
