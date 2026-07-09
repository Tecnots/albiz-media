-- Retroactive migration: this schema (Post.assignedEditorId/publishAt/
-- scheduleJobId, and the five Editor* tables) was already live on this
-- database, applied out-of-band (prisma db push) before any migration file
-- existed for it — discovered during a production audit. This migration
-- exists purely for history/bookkeeping so a fresh database (CI, a new
-- preview deployment, production) ends up with the same schema. It is
-- marked as already-applied via `prisma migrate resolve --applied` rather
-- than executed, since the current database already has all of this.
--
-- Every statement below was extracted verbatim from `prisma migrate diff
-- --from-empty --to-config-datasource` against the live database, i.e. it
-- reflects the database's real, current, ground-truth structure — not a
-- reconstruction from memory.

-- AlterTable
-- createdAt is included here too: also discovered with no covering
-- migration, same root cause (applied via `prisma db push`, never captured
-- in a migration file).
ALTER TABLE "public"."Post" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "assignedEditorId" INTEGER,
ADD COLUMN     "publishAt" TIMESTAMP(3),
ADD COLUMN     "scheduleJobId" TEXT;

-- CreateTable
CREATE TABLE "public"."EditorActivity" (
    "id" SERIAL NOT NULL,
    "editorId" INTEGER NOT NULL,
    "postId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EditorActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EditorNote" (
    "id" SERIAL NOT NULL,
    "postId" INTEGER NOT NULL,
    "editorId" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "priority" TEXT NOT NULL DEFAULT 'minor',
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" INTEGER,
    "type" TEXT NOT NULL DEFAULT 'general',

    CONSTRAINT "EditorNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EditorNoteTemplate" (
    "id" SERIAL NOT NULL,
    "editorId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EditorNoteTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EditorPreferences" (
    "editorId" INTEGER NOT NULL,
    "defaultNoteType" TEXT NOT NULL DEFAULT 'general',
    "defaultNotePriority" TEXT NOT NULL DEFAULT 'minor',
    "notifyOnSubmit" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnResolve" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "EditorPreferences_pkey" PRIMARY KEY ("editorId")
);

-- CreateTable
CREATE TABLE "public"."EditorSectionAssignment" (
    "id" SERIAL NOT NULL,
    "editorId" INTEGER NOT NULL,
    "sectionId" INTEGER NOT NULL,
    "canPublish" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EditorSectionAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EditorActivity_editorId_createdAt_idx" ON "public"."EditorActivity"("editorId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "EditorNote_postId_idx" ON "public"."EditorNote"("postId" ASC);

-- CreateIndex
CREATE INDEX "EditorNoteTemplate_editorId_idx" ON "public"."EditorNoteTemplate"("editorId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "EditorSectionAssignment_editorId_sectionId_key" ON "public"."EditorSectionAssignment"("editorId" ASC, "sectionId" ASC);

-- CreateIndex
CREATE INDEX "EditorSectionAssignment_sectionId_idx" ON "public"."EditorSectionAssignment"("sectionId" ASC);

-- AddForeignKey
ALTER TABLE "public"."EditorActivity" ADD CONSTRAINT "EditorActivity_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EditorActivity" ADD CONSTRAINT "EditorActivity_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EditorNote" ADD CONSTRAINT "EditorNote_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EditorNote" ADD CONSTRAINT "EditorNote_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EditorNoteTemplate" ADD CONSTRAINT "EditorNoteTemplate_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EditorPreferences" ADD CONSTRAINT "EditorPreferences_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EditorSectionAssignment" ADD CONSTRAINT "EditorSectionAssignment_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EditorSectionAssignment" ADD CONSTRAINT "EditorSectionAssignment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "public"."ArticleSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Post" ADD CONSTRAINT "Post_assignedEditorId_fkey" FOREIGN KEY ("assignedEditorId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
