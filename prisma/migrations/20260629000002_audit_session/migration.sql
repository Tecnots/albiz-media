-- Add sessionVersion for JWT invalidation on password change / ban
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 1;

-- Audit log table for all sensitive operations
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id"         SERIAL PRIMARY KEY,
  "action"     TEXT NOT NULL,
  "actorId"    INTEGER REFERENCES "User"(id) ON DELETE SET NULL,
  "targetId"   INTEGER REFERENCES "User"(id) ON DELETE SET NULL,
  "targetType" TEXT,
  "meta"       JSONB,
  "ip"         TEXT,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "audit_logs_action_idx"    ON "audit_logs"("action");
CREATE INDEX IF NOT EXISTS "audit_logs_actorId_idx"   ON "audit_logs"("actorId");
CREATE INDEX IF NOT EXISTS "audit_logs_targetId_idx"  ON "audit_logs"("targetId");
CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- Device/session tracking for revocation and visibility
CREATE TABLE IF NOT EXISTS "user_device_sessions" (
  "id"           SERIAL PRIMARY KEY,
  "userId"       INTEGER NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "deviceName"   TEXT,
  "userAgent"    TEXT,
  "ip"           TEXT,
  "lastActiveAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "isActive"     BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS "user_device_sessions_userId_idx"   ON "user_device_sessions"("userId");
CREATE INDEX IF NOT EXISTS "user_device_sessions_isActive_idx" ON "user_device_sessions"("isActive");
