-- Migration: circle_indexes
-- Adds missing indexes on Circle upgrade tables and fixes nullable column drift

-- CircleUpgradeRequest indexes
CREATE INDEX IF NOT EXISTS "circle_upgrade_requests_userId_idx" ON "circle_upgrade_requests"("userId");
CREATE INDEX IF NOT EXISTS "circle_upgrade_requests_status_idx" ON "circle_upgrade_requests"("status");
CREATE INDEX IF NOT EXISTS "circle_upgrade_requests_createdAt_idx" ON "circle_upgrade_requests"("createdAt");
CREATE INDEX IF NOT EXISTS "circle_upgrade_requests_userId_status_idx" ON "circle_upgrade_requests"("userId", "status");

-- CircleUpgradeRegistration indexes
CREATE INDEX IF NOT EXISTS "circle_upgrade_registrations_requestId_idx" ON "circle_upgrade_registrations"("requestId");

-- CircleUpgradeDocument indexes
CREATE INDEX IF NOT EXISTS "circle_upgrade_documents_requestId_idx" ON "circle_upgrade_documents"("requestId");
CREATE INDEX IF NOT EXISTS "circle_upgrade_documents_registrationId_idx" ON "circle_upgrade_documents"("registrationId");

-- Schema drift: legacy nullable fields that were originally NOT NULL
-- These columns exist but are always NULL for new-format submissions (registrations flow)
ALTER TABLE "circle_upgrade_requests" ALTER COLUMN "documentType" DROP NOT NULL;
ALTER TABLE "circle_upgrade_requests" ALTER COLUMN "documentNumber" DROP NOT NULL;
ALTER TABLE "circle_upgrade_requests" ALTER COLUMN "documentUrl" DROP NOT NULL;

-- Add autoincrement sequence to Post.id (was plain INTEGER NOT NULL with manual ID assignment)
CREATE SEQUENCE IF NOT EXISTS "Post_id_seq";
SELECT setval('"Post_id_seq"', COALESCE((SELECT MAX("id") FROM "Post"), 0) + 1, false);
ALTER TABLE "Post" ALTER COLUMN "id" SET DEFAULT nextval('"Post_id_seq"');
ALTER SEQUENCE "Post_id_seq" OWNED BY "Post"."id";

-- Drop orphaned legacy Circle tables (no active code reads or writes these)
-- CirclePostLike references CirclePost which references CircleMember; drop FK order matters
DROP TABLE IF EXISTS "CirclePostLike" CASCADE;
DROP TABLE IF EXISTS "CirclePost" CASCADE;
DROP TABLE IF EXISTS "CircleMember" CASCADE;
