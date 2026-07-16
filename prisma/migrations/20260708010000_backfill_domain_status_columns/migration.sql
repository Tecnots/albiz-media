-- Backfill migration: these objects were previously applied to the database
-- via `prisma db push` without ever being committed as a migration (see the
-- 2026-07-08 Custom Domain production audit). This file documents that
-- history honestly. It is marked as already-applied via
-- `prisma migrate resolve --applied` for every environment that already has
-- these objects (including production) rather than executed, since running
-- it for real against a database that already has them would fail. It DOES
-- run for real on any environment built from scratch via `prisma migrate
-- deploy` (fresh CI database, disaster recovery, new local setup), which is
-- exactly the gap that made those environments unable to boot the Custom
-- Domain feature at all.

-- CreateEnum
CREATE TYPE "DomainStatus" AS ENUM ('PENDING', 'ACTIVE', 'FAILED');

-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "domainStatus" "DomainStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "domainToken" TEXT;
