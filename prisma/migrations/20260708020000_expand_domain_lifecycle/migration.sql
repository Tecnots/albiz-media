-- Expands the Custom Domain lifecycle to a full production state machine and
-- adds the tracking fields needed for real DNS verification, SSL
-- provisioning, retry handling, and reconciliation.

-- AlterEnum
ALTER TYPE "DomainStatus" ADD VALUE IF NOT EXISTS 'DNS_VERIFYING';
ALTER TYPE "DomainStatus" ADD VALUE IF NOT EXISTS 'DNS_VERIFIED';
ALTER TYPE "DomainStatus" ADD VALUE IF NOT EXISTS 'SSL_PROVISIONING';
ALTER TYPE "DomainStatus" ADD VALUE IF NOT EXISTS 'DISABLED';

-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "domainVerificationAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "domainLastCheckedAt" TIMESTAMP(3),
  ADD COLUMN "domainVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "domainActivatedAt" TIMESTAMP(3),
  ADD COLUMN "domainFailureReason" TEXT,
  ADD COLUMN "domainProviderId" TEXT;

-- CreateIndex
CREATE INDEX "User_domainStatus_idx" ON "User"("domainStatus");
