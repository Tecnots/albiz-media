-- Migration: Translation cache
-- Persistent, cross-instance translation cache shared by Posts, Articles, and
-- News. Rows self-invalidate via sourceHash rather than needing explicit
-- invalidation hooks on content-edit paths.

CREATE TABLE IF NOT EXISTS "Translation" (
    "id"             SERIAL PRIMARY KEY,
    "contentType"    TEXT NOT NULL,
    "contentId"      INTEGER NOT NULL,
    "field"          TEXT NOT NULL,
    "targetLanguage" TEXT NOT NULL,
    "sourceHash"     TEXT NOT NULL,
    "sourceLanguage" TEXT,
    "translatedText" TEXT NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "Translation_contentType_contentId_field_targetLanguage_key"
  ON "Translation" ("contentType", "contentId", "field", "targetLanguage");

CREATE INDEX IF NOT EXISTS "Translation_contentType_contentId_idx"
  ON "Translation" ("contentType", "contentId");
