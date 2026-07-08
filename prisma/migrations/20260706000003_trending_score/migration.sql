-- Durable trending-score cache, written by the periodic recompute-trending
-- job (see lib/job-queue.ts) instead of scoring live on every request.

CREATE TABLE IF NOT EXISTS "TrendingScore" (
    "id"            SERIAL PRIMARY KEY,
    "postId"        INTEGER NOT NULL,
    "score"         DOUBLE PRECISION NOT NULL,
    "velocity"      DOUBLE PRECISION NOT NULL,
    "geoCluster"    DOUBLE PRECISION NOT NULL,
    "socialProof"   DOUBLE PRECISION NOT NULL,
    "viewsSnapshot" INTEGER NOT NULL DEFAULT 0,
    "computedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TrendingScore_postId_fkey'
  ) THEN
    ALTER TABLE "TrendingScore"
      ADD CONSTRAINT "TrendingScore_postId_fkey"
      FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "TrendingScore_postId_key" ON "TrendingScore" ("postId");
CREATE INDEX IF NOT EXISTS "TrendingScore_score_idx" ON "TrendingScore" ("score");
CREATE INDEX IF NOT EXISTS "TrendingScore_computedAt_idx" ON "TrendingScore" ("computedAt");
