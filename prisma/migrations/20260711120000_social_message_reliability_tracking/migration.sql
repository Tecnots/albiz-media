-- Phase 3 (Background Processing & Reliability) for the Omnichannel social
-- inbox: lets a background sweep retry a failed attachment download or a
-- failed outbound send independently, without redoing the rest of the
-- message/thread. Both columns are nullable/defaulted so existing rows are
-- unaffected.
ALTER TABLE "SocialMessage" ADD COLUMN "pendingMediaUrl" TEXT;
ALTER TABLE "SocialMessage" ADD COLUMN "deliveryFailed" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "SocialMessage_pendingMediaUrl_idx" ON "SocialMessage"("pendingMediaUrl");
CREATE INDEX IF NOT EXISTS "SocialMessage_deliveryFailed_idx" ON "SocialMessage"("deliveryFailed");
