-- Double Ratchet protocol fields for forward-secret E2EE messaging.
-- msgIndex: per-DH-chain message counter (resets on each DH ratchet step).
-- ratchetPublicKey: sender's current ECDH P-256 ratchet public key (public, safe to store).

ALTER TABLE "Message"
  ADD COLUMN IF NOT EXISTS "msgIndex"         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "ratchetPublicKey" TEXT;

-- Composite index for efficient chain-based message lookup
CREATE INDEX IF NOT EXISTS "Message_conversationId_msgIndex_idx"
  ON "Message"("conversationId", "msgIndex");
