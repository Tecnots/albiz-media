-- Shorts module: new role + Short entity

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SHORTS_CREATOR';

CREATE TABLE IF NOT EXISTS "Short" (
  "id"            SERIAL PRIMARY KEY,
  "title"         TEXT NOT NULL,
  "description"   TEXT,
  "videoUrl"      TEXT NOT NULL,
  "thumbnailUrl"  TEXT,
  "format"        TEXT NOT NULL DEFAULT 'vertical',
  "status"        TEXT NOT NULL DEFAULT 'draft',
  "userId"        INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "rejectionNote" TEXT,
  "views"         INTEGER NOT NULL DEFAULT 0,
  "likes"         INTEGER NOT NULL DEFAULT 0,
  "shares"        INTEGER NOT NULL DEFAULT 0,
  "publishedAt"   TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Short_userId_idx"    ON "Short"("userId");
CREATE INDEX IF NOT EXISTS "Short_status_idx"    ON "Short"("status");
CREATE INDEX IF NOT EXISTS "Short_createdAt_idx" ON "Short"("createdAt" DESC);
