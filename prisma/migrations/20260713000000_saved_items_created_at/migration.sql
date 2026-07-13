-- The Saved page's "All" tab needs to interleave saved Posts and saved Shorts
-- in one chronological list. SavedPost had no timestamp at all, and the
-- SavedShort table added alongside it also didn't carry one — neither table's
-- autoincrement id is comparable across the two (independent sequences), so a
-- real createdAt is required to sort them together correctly. Existing rows
-- backfill to the migration's apply time, which is an acceptable one-time
-- approximation for historical saves.

-- AlterTable
ALTER TABLE "SavedPost" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "SavedShort" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
