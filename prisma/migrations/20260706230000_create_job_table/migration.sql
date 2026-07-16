-- The Job model was added to schema.prisma without ever generating a migration,
-- so the table doesn't exist in any environment that only ran `prisma migrate deploy`.
-- Uses IF NOT EXISTS since some environments already created it via `prisma db push`.

CREATE TABLE IF NOT EXISTS "Job" (
    "id"          TEXT NOT NULL,
    "type"        TEXT NOT NULL,
    "payload"     JSONB NOT NULL,
    "status"      TEXT NOT NULL DEFAULT 'pending',
    "priority"    INTEGER NOT NULL DEFAULT 0,
    "attempts"    INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastError"   TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt"   TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Job_status_scheduledAt_idx" ON "Job"("status", "scheduledAt");
CREATE INDEX IF NOT EXISTS "Job_status_createdAt_idx" ON "Job"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Job_type_status_idx" ON "Job"("type", "status");
CREATE INDEX IF NOT EXISTS "Job_createdAt_idx" ON "Job"("createdAt");
