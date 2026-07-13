-- Shorts likes/saves regression fix: Shorts had a bare `likes` counter with
-- no per-user like record (so the UI could never know if the current user
-- had already liked a Short, and "likes" could never be reliably toggled),
-- and the Saved Content system only ever referenced Post, so a Short could
-- not be saved at all. Mirrors the existing PostLike / SavedPost tables.

-- CreateTable
CREATE TABLE "ShortLike" (
    "id"        SERIAL NOT NULL,
    "shortId"   INTEGER NOT NULL,
    "userId"    INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShortLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShortLike_shortId_userId_key" ON "ShortLike"("shortId", "userId");

-- CreateIndex
CREATE INDEX "ShortLike_createdAt_idx" ON "ShortLike"("createdAt");

-- CreateIndex
CREATE INDEX "ShortLike_shortId_createdAt_idx" ON "ShortLike"("shortId", "createdAt");

-- CreateIndex
CREATE INDEX "ShortLike_userId_idx" ON "ShortLike"("userId");

-- AddForeignKey
ALTER TABLE "ShortLike" ADD CONSTRAINT "ShortLike_shortId_fkey" FOREIGN KEY ("shortId") REFERENCES "Short"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShortLike" ADD CONSTRAINT "ShortLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "SavedShort" (
    "id"           SERIAL NOT NULL,
    "userId"       INTEGER NOT NULL,
    "shortId"      INTEGER NOT NULL,
    "collectionId" INTEGER,

    CONSTRAINT "SavedShort_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SavedShort_userId_shortId_key" ON "SavedShort"("userId", "shortId");

-- AddForeignKey
ALTER TABLE "SavedShort" ADD CONSTRAINT "SavedShort_shortId_fkey" FOREIGN KEY ("shortId") REFERENCES "Short"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedShort" ADD CONSTRAINT "SavedShort_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
