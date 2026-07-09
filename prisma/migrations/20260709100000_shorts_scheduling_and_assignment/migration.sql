-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityEventType" ADD VALUE 'SHORT_SCHEDULED';
ALTER TYPE "ActivityEventType" ADD VALUE 'SHORT_UNSCHEDULED';
ALTER TYPE "ActivityEventType" ADD VALUE 'SHORT_PUBLISHED';
ALTER TYPE "ActivityEventType" ADD VALUE 'SHORT_PUBLISH_FAILED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'ARTICLE_SCHEDULED';
ALTER TYPE "NotificationType" ADD VALUE 'ARTICLE_UNSCHEDULED';
ALTER TYPE "NotificationType" ADD VALUE 'SHORT_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'SHORT_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'SHORT_PUBLISHED';
ALTER TYPE "NotificationType" ADD VALUE 'SHORT_UNPUBLISHED';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "shortId" INTEGER;

-- AlterTable
ALTER TABLE "Short" ADD COLUMN     "assignedAdminId" INTEGER,
ADD COLUMN     "scheduleJobId" TEXT;

-- CreateTable
CREATE TABLE "ShortActivity" (
    "id" SERIAL NOT NULL,
    "editorId" INTEGER NOT NULL,
    "shortId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShortActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShortActivity_shortId_idx" ON "ShortActivity"("shortId");

-- CreateIndex
CREATE INDEX "ShortActivity_editorId_idx" ON "ShortActivity"("editorId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_type_userId_recipientId_shortId_key" ON "Notification"("type", "userId", "recipientId", "shortId");

-- CreateIndex
CREATE INDEX "Short_assignedAdminId_idx" ON "Short"("assignedAdminId");

-- AddForeignKey
ALTER TABLE "Short" ADD CONSTRAINT "Short_assignedAdminId_fkey" FOREIGN KEY ("assignedAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShortActivity" ADD CONSTRAINT "ShortActivity_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShortActivity" ADD CONSTRAINT "ShortActivity_shortId_fkey" FOREIGN KEY ("shortId") REFERENCES "Short"("id") ON DELETE CASCADE ON UPDATE CASCADE;

