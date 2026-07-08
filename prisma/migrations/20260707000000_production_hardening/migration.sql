-- Production hardening: cascade deletes, missing FK constraints, Story indexes,
-- Conversation autoincrement ID, and PostLike/PostComment/BlockedUser/SavedPost relations.

-- H-9: Post → User cascade on delete (prevents P2003 on user deletion)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Post_userId_fkey') THEN
    ALTER TABLE "Post" DROP CONSTRAINT "Post_userId_fkey";
  END IF;
END $$;
ALTER TABLE "Post" ADD CONSTRAINT "Post_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- H-9: Notification → User cascade on delete
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Notification_userId_fkey') THEN
    ALTER TABLE "Notification" DROP CONSTRAINT "Notification_userId_fkey";
  END IF;
END $$;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- H-11: Story table indexes for status/expiresAt queries (used by every home-page fetch)
CREATE INDEX IF NOT EXISTS "Story_status_expiresAt_idx" ON "Story" ("status", "expiresAt");
CREATE INDEX IF NOT EXISTS "Story_userId_status_expiresAt_idx" ON "Story" ("userId", "status", "expiresAt");

-- H-7: Conversation.id autoincrement — create sequence and wire it to the column
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'Conversation_id_seq' AND relkind = 'S') THEN
    CREATE SEQUENCE "Conversation_id_seq";
    PERFORM setval('"Conversation_id_seq"', COALESCE((SELECT MAX(id) FROM "Conversation"), 0) + 1, false);
    ALTER TABLE "Conversation" ALTER COLUMN "id" SET DEFAULT nextval('"Conversation_id_seq"');
    ALTER SEQUENCE "Conversation_id_seq" OWNED BY "Conversation"."id";
  END IF;
END $$;

-- H-13: PostLike.userId FK constraint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PostLike_userId_fkey') THEN
    ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "PostLike_userId_idx" ON "PostLike" ("userId");

-- H-13: PostComment.userId FK constraint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PostComment_userId_fkey') THEN
    ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
  END IF;
END $$;

-- H-13: BlockedUser FK constraints
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BlockedUser_blockerId_fkey') THEN
    ALTER TABLE "BlockedUser" ADD CONSTRAINT "BlockedUser_blockerId_fkey"
      FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BlockedUser_blockedId_fkey') THEN
    ALTER TABLE "BlockedUser" ADD CONSTRAINT "BlockedUser_blockedId_fkey"
      FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
  END IF;
END $$;

-- H-13: SavedPost.userId FK constraint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SavedPost_userId_fkey') THEN
    ALTER TABLE "SavedPost" ADD CONSTRAINT "SavedPost_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
  END IF;
END $$;

-- H-13: SavedPost.postId FK constraint (was missing onDelete)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SavedPost_postId_fkey') THEN
    ALTER TABLE "SavedPost" DROP CONSTRAINT "SavedPost_postId_fkey";
  END IF;
END $$;
ALTER TABLE "SavedPost" ADD CONSTRAINT "SavedPost_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
