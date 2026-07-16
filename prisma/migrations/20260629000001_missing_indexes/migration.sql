-- Add missing indexes for high-traffic query columns

-- PostComment: querying comments by post (very common) and by user
CREATE INDEX IF NOT EXISTS "PostComment_postId_idx" ON "PostComment"("postId");
CREATE INDEX IF NOT EXISTS "PostComment_userId_idx" ON "PostComment"("userId");

-- Message: querying messages by conversation (every chat load)
CREATE INDEX IF NOT EXISTS "Message_conversationId_idx" ON "Message"("conversationId");
CREATE INDEX IF NOT EXISTS "Message_senderId_idx" ON "Message"("senderId");

-- Notification: querying by userId (actor/sender side)
CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");
