-- Email-OTP two-factor authentication support on User.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorEmailCode" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorEmailCodeExpiry" TIMESTAMP(3);
