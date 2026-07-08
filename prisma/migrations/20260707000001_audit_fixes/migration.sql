-- Audit fixes: referential integrity, missing FK constraints, integer mirrors,
-- VALIDATE CONSTRAINT for previously NOT VALID constraints, and job dedup index.

-- F01: User.id autoincrement sequence
-- Wire a proper sequence to User.id so inserts no longer need a manual MAX(id)+1
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'User_id_seq' AND relkind = 'S') THEN
    CREATE SEQUENCE "User_id_seq";
    PERFORM setval('"User_id_seq"', COALESCE((SELECT MAX(id) FROM "User"), 0) + 1, false);
    ALTER TABLE "User" ALTER COLUMN "id" SET DEFAULT nextval('"User_id_seq"');
    ALTER SEQUENCE "User_id_seq" OWNED BY "User"."id";
  END IF;
END $$;

-- F06: Integer mirror columns for User follower/following counts
-- These allow numeric sorting/filtering; the existing String columns are kept
-- for backward-compatible display values.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "followersCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "followingCountInt" INTEGER NOT NULL DEFAULT 0;

-- F02: Notification.recipientId FK constraint (NOT VALID to avoid ACCESS EXCLUSIVE lock)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Notification_recipientId_fkey') THEN
    ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey"
      FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
  END IF;
END $$;
DO $$ BEGIN
  ALTER TABLE "Notification" VALIDATE CONSTRAINT "Notification_recipientId_fkey";
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Notification_recipientId_fkey validation skipped (orphan rows exist): %', SQLERRM;
END $$;

-- F03: Message.senderId FK constraint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Message_senderId_fkey') THEN
    ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey"
      FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
  END IF;
END $$;
DO $$ BEGIN
  ALTER TABLE "Message" VALIDATE CONSTRAINT "Message_senderId_fkey";
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Message_senderId_fkey validation skipped (orphan rows exist): %', SQLERRM;
END $$;

-- F04: ArticleContent.postId cascade delete (previously Restrict → blocked post deletions)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ArticleContent_postId_fkey') THEN
    ALTER TABLE "ArticleContent" DROP CONSTRAINT "ArticleContent_postId_fkey";
  END IF;
END $$;
ALTER TABLE "ArticleContent" ADD CONSTRAINT "ArticleContent_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- F05: Conversation.userId cascade delete (previously Restrict → blocked user deletions)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Conversation_userId_fkey') THEN
    ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_userId_fkey";
  END IF;
END $$;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- F05: Conversation.participantId set null on user deletion
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Conversation_participantId_fkey') THEN
    ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_participantId_fkey";
  END IF;
END $$;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_participantId_fkey"
  FOREIGN KEY ("participantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- F08: SocialConnection.userId FK constraint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SocialConnection_userId_fkey') THEN
    ALTER TABLE "SocialConnection" ADD CONSTRAINT "SocialConnection_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
  END IF;
END $$;
DO $$ BEGIN
  ALTER TABLE "SocialConnection" VALIDATE CONSTRAINT "SocialConnection_userId_fkey";
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SocialConnection_userId_fkey validation skipped: %', SQLERRM;
END $$;

-- F08: UserCollection.userId FK constraint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserCollection_userId_fkey') THEN
    ALTER TABLE "UserCollection" ADD CONSTRAINT "UserCollection_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
  END IF;
END $$;
DO $$ BEGIN
  ALTER TABLE "UserCollection" VALIDATE CONSTRAINT "UserCollection_userId_fkey";
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'UserCollection_userId_fkey validation skipped: %', SQLERRM;
END $$;

-- F08: UserInvite.invitedById FK constraint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserInvite_invitedById_fkey') THEN
    ALTER TABLE "UserInvite" ADD CONSTRAINT "UserInvite_invitedById_fkey"
      FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
  END IF;
END $$;
DO $$ BEGIN
  ALTER TABLE "UserInvite" VALIDATE CONSTRAINT "UserInvite_invitedById_fkey";
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'UserInvite_invitedById_fkey validation skipped: %', SQLERRM;
END $$;

-- F08: BlobInfo.uploadedBy FK constraint (nullable → SET NULL on delete)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BlobInfo_uploadedBy_fkey') THEN
    ALTER TABLE "BlobInfo" ADD CONSTRAINT "BlobInfo_uploadedBy_fkey"
      FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
  END IF;
END $$;
DO $$ BEGIN
  ALTER TABLE "BlobInfo" VALIDATE CONSTRAINT "BlobInfo_uploadedBy_fkey";
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'BlobInfo_uploadedBy_fkey validation skipped: %', SQLERRM;
END $$;

-- F12: Validate the NOT VALID FK constraints from the production_hardening migration.
-- These use SHARE UPDATE EXCLUSIVE locks (non-blocking) and skip gracefully if orphans exist.
DO $$ BEGIN
  ALTER TABLE "PostLike" VALIDATE CONSTRAINT "PostLike_userId_fkey";
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'PostLike_userId_fkey validation skipped: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE "PostComment" VALIDATE CONSTRAINT "PostComment_userId_fkey";
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'PostComment_userId_fkey validation skipped: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE "BlockedUser" VALIDATE CONSTRAINT "BlockedUser_blockerId_fkey";
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'BlockedUser_blockerId_fkey validation skipped: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE "BlockedUser" VALIDATE CONSTRAINT "BlockedUser_blockedId_fkey";
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'BlockedUser_blockedId_fkey validation skipped: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE "SavedPost" VALIDATE CONSTRAINT "SavedPost_userId_fkey";
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SavedPost_userId_fkey validation skipped: %', SQLERRM;
END $$;

-- F13: UserUnfollowEvent FK constraints (analytics signal table)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserUnfollowEvent_followerId_fkey') THEN
    ALTER TABLE "UserUnfollowEvent" ADD CONSTRAINT "UserUnfollowEvent_followerId_fkey"
      FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
  END IF;
END $$;
DO $$ BEGIN
  ALTER TABLE "UserUnfollowEvent" VALIDATE CONSTRAINT "UserUnfollowEvent_followerId_fkey";
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'UserUnfollowEvent_followerId_fkey validation skipped: %', SQLERRM;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserUnfollowEvent_followingId_fkey') THEN
    ALTER TABLE "UserUnfollowEvent" ADD CONSTRAINT "UserUnfollowEvent_followingId_fkey"
      FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
  END IF;
END $$;
DO $$ BEGIN
  ALTER TABLE "UserUnfollowEvent" VALIDATE CONSTRAINT "UserUnfollowEvent_followingId_fkey";
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'UserUnfollowEvent_followingId_fkey validation skipped: %', SQLERRM;
END $$;

-- CRON-001: Partial unique index to prevent double-enqueue of pending jobs.
-- Removes any pre-existing duplicates before creating the index.
DELETE FROM "Job"
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY type ORDER BY "createdAt" ASC) AS rn
    FROM "Job"
    WHERE status = 'pending'
  ) ranked
  WHERE rn > 1
);
CREATE UNIQUE INDEX IF NOT EXISTS "Job_type_pending_unique"
  ON "Job"(type) WHERE status = 'pending';
