-- Phase 4 (Inbox Experience & Multi-Account Management) for the Omnichannel
-- social inbox: lets the Connected Accounts UI show an honest "last synced"
-- time and a specific failure reason per connection, instead of only a
-- binary active/expired status. Both columns are nullable — existing rows
-- are unaffected.
ALTER TABLE "SocialConnection" ADD COLUMN "lastSyncedAt" TIMESTAMP(3);
ALTER TABLE "SocialConnection" ADD COLUMN "lastSyncError" TEXT;
