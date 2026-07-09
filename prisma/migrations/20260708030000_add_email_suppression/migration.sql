-- Suppression list for hard-bounced/complained email addresses, populated by
-- the Postmark bounce/complaint webhook. Checked before every outbound send.
CREATE TABLE IF NOT EXISTS "EmailSuppression" (
  "email"     TEXT NOT NULL,
  "reason"    TEXT NOT NULL,
  "source"    TEXT NOT NULL DEFAULT 'postmark',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmailSuppression_pkey" PRIMARY KEY ("email")
);

CREATE INDEX IF NOT EXISTS "EmailSuppression_createdAt_idx" ON "EmailSuppression"("createdAt");
