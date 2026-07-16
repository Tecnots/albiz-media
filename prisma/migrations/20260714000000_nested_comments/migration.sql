-- Instagram-style nested comments: adds a one-level self-relation to
-- PostComment for replies, and introduces ShortComment (Shorts had no
-- comment system at all) mirroring the same shape.

-- AlterTable
ALTER TABLE "PostComment" ADD COLUMN "parentId" INTEGER;

-- CreateIndex
CREATE INDEX "PostComment_parentId_idx" ON "PostComment"("parentId");

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PostComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ShortComment" (
    "id"        SERIAL NOT NULL,
    "shortId"   INTEGER NOT NULL,
    "userId"    INTEGER NOT NULL,
    "text"      TEXT NOT NULL,
    "parentId"  INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShortComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShortComment_shortId_idx" ON "ShortComment"("shortId");

-- CreateIndex
CREATE INDEX "ShortComment_userId_idx" ON "ShortComment"("userId");

-- CreateIndex
CREATE INDEX "ShortComment_parentId_idx" ON "ShortComment"("parentId");

-- AddForeignKey
ALTER TABLE "ShortComment" ADD CONSTRAINT "ShortComment_shortId_fkey" FOREIGN KEY ("shortId") REFERENCES "Short"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShortComment" ADD CONSTRAINT "ShortComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShortComment" ADD CONSTRAINT "ShortComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ShortComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
