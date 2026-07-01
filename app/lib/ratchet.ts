"use client";

// Double Ratchet protocol — Signal-style forward-secret E2EE messaging.
//
// Architecture:
//   • ECDH P-256  — identity keys (long-term) and DH ratchet keys (ephemeral)
//   • HKDF-SHA256 — root key derivation (KDF_RK)
//   • HMAC-SHA256 — chain key / message key derivation (KDF_CK)
//   • AES-GCM-256 — per-message authenticated encryption
//
// Security guarantees:
//   Forward secrecy       — message keys are deleted after use; compromise of
//                           current state cannot decrypt past messages.
//   Post-compromise security — DH ratchet steps introduce fresh randomness so
//                           future messages become secure after an old key
//                           compromise.
//
// Out-of-order delivery:
//   Up to MAX_SKIP message keys are cached per chain so late-arriving messages
//   within the same DH-ratchet epoch can still be decrypted.
//
// Storage:
//   Ratchet sessions are persisted in IndexedDB (store "ratchetSessions") keyed
//   by `otherUserId`.  An in-memory cache avoids redundant reads within a tab.
//
// Backward compatibility:
//   Messages without a `ratchetPublicKey` header were encrypted with the legacy
//   static ECDH shared key.  Those are decrypted via the legacy path in useChat.

import {
  openDB, RATCHET_STORE,
  generateKeyPair, exportPublicKey,
  arrayBufferToBase64, base64ToArrayBuffer,
  dhRawBytes,
} from "./crypto";

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_SKIP = 100; // max skipped message keys cached per session

const INFO_ROOT  = new TextEncoder().encode("albiz-ratchet-root");
const INFO_CHAIN = new TextEncoder().encode("albiz-ratchet-chain");

// ── Types ────────────────────────────────────────────────────────────────────

export interface RatchetSession {
  otherUserId: number;       // IndexedDB key

  rootKey: ArrayBuffer;             // 32 bytes — current root key
  sendChainKey: ArrayBuffer | null; // 32 bytes — current sending chain key
  recvChainKey: ArrayBuffer | null; // 32 bytes — current receiving chain key

  sendIdx: number;   // next message index to send (resets on DH ratchet)
  recvIdx: number;   // next expected received message index (resets on DH ratchet)

  ourPrivKey: CryptoKey | null;    // current DH ratchet private key (non-extractable)
  ourPubKeyB64: string | null;     // current DH ratchet public key (sent in message headers)
  theirPubKeyB64: string | null;   // most recent ratchet public key from the other party

  // Skipped message keys: `${ratchetPubB64}:${msgIndex}` → 32-byte AES key bytes
  // Allows decryption of out-of-order messages within a DH-ratchet epoch.
  skippedKeys: Map<string, ArrayBuffer>;

  ready: boolean;      // true once the session has been fully initialized
  isInitiator: boolean;
}

export interface RatchetMessageHeader {
  ratchetPublicKey: string; // sender's current DH ratchet public key (base64)
  msgIndex: number;         // per-chain message index (0-based, resets each DH ratchet step)
}

export interface RatchetEncryptResult extends RatchetMessageHeader {
  ciphertext: string; // base64 AES-GCM-256 ciphertext
  iv: string;         // base64 12-byte AES-GCM IV
  session: RatchetSession; // updated session state (caller must persist this)
}

// ── KDF helpers ──────────────────────────────────────────────────────────────

/**
 * KDF_RK(rootKey, dhOut) → [nextRootKey, chainKey]
 * HKDF-SHA256 with the DH output as IKM and rootKey as salt.
 * Returns two 32-byte values concatenated (64 bytes total).
 */
async function kdfRoot(
  rootKey: ArrayBuffer,
  dhOut: ArrayBuffer
): Promise<[ArrayBuffer, ArrayBuffer]> {
  const ikm = await crypto.subtle.importKey(
    "raw", dhOut, { name: "HKDF" }, false, ["deriveBits"]
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: rootKey, info: INFO_ROOT },
    ikm,
    512 // 64 bytes = 32 RK + 32 CK
  );
  const bytes = new Uint8Array(derived);
  return [bytes.slice(0, 32).buffer, bytes.slice(32, 64).buffer];
}

/**
 * KDF_CK(chainKey) → [nextChainKey, messageKey]
 * HMAC-SHA256: MK = HMAC(CK, 0x01), next_CK = HMAC(CK, 0x02).
 */
async function kdfChain(
  chainKey: ArrayBuffer
): Promise<[ArrayBuffer, ArrayBuffer]> {
  const ck = await crypto.subtle.importKey(
    "raw", chainKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const mk   = await crypto.subtle.sign("HMAC", ck, new Uint8Array([0x01]));
  const next = await crypto.subtle.sign("HMAC", ck, new Uint8Array([0x02]));
  return [next, mk];
}

// ── Message encryption / decryption ─────────────────────────────────────────

/**
 * Encrypt plaintext with a 32-byte message key using AES-GCM-256.
 * A fresh 12-byte IV is generated for every call.
 */
async function encryptWithMK(
  mkBytes: ArrayBuffer,
  plaintext: string
): Promise<{ ciphertext: string; iv: string }> {
  const mk = await crypto.subtle.importKey(
    "raw", mkBytes, { name: "AES-GCM", length: 256 }, false, ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, mk, data);
  return {
    ciphertext: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
  };
}

/**
 * Decrypt ciphertext with a 32-byte message key using AES-GCM-256.
 * Throws on authentication failure (tampered ciphertext or wrong key).
 */
async function decryptWithMK(
  mkBytes: ArrayBuffer,
  ciphertext: string,
  iv: string
): Promise<string> {
  const mk = await crypto.subtle.importKey(
    "raw", mkBytes, { name: "AES-GCM", length: 256 }, false, ["decrypt"]
  );
  const encrypted = base64ToArrayBuffer(ciphertext);
  const ivBytes   = new Uint8Array(base64ToArrayBuffer(iv));
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBytes }, mk, encrypted);
  return new TextDecoder().decode(decrypted);
}

// ── Ratchet key pair ─────────────────────────────────────────────────────────

async function generateRatchetKeyPair(): Promise<{ privateKey: CryptoKey; publicKeyB64: string }> {
  const kp = await generateKeyPair(); // P-256, non-extractable private key
  const publicKeyB64 = await exportPublicKey(kp.publicKey);
  return { privateKey: kp.privateKey, publicKeyB64 };
}

// ── Initial root key from identity keys ─────────────────────────────────────
//
// Both parties derive the same value from their long-term identity keys.
// This is used only once to seed the ratchet on session init.

async function deriveInitialRootKey(
  ourIdentPrivKey: CryptoKey,
  theirIdentPubB64: string
): Promise<ArrayBuffer> {
  const dhOut = await dhRawBytes(ourIdentPrivKey, theirIdentPubB64);
  const ikm = await crypto.subtle.importKey(
    "raw", dhOut, { name: "HKDF" }, false, ["deriveBits"]
  );
  const salt = new Uint8Array(32); // all-zero salt
  const info = new TextEncoder().encode("albiz-init-root");
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    ikm,
    256 // 32 bytes
  );
  return bits;
}

// ── DH ratchet step ─────────────────────────────────────────────────────────
//
// Called when we receive a message carrying a new ratchet public key.
// 1. Derive new receiving chain from DH(ourCurrent, theirNew).
// 2. Generate a fresh ratchet key pair.
// 3. Derive new sending chain from DH(ourNew, theirNew).
// Resets per-chain message indices.

async function dhRatchetStep(
  session: RatchetSession,
  theirNewPubB64: string
): Promise<RatchetSession> {
  // Step 1: receiving chain
  const dh1 = await dhRawBytes(session.ourPrivKey!, theirNewPubB64);
  const [rootKey1, recvChainKey] = await kdfRoot(session.rootKey, dh1);

  // Step 2: new ratchet key pair
  const { privateKey: newPrivKey, publicKeyB64: newPubB64 } = await generateRatchetKeyPair();

  // Step 3: sending chain from fresh ratchet key
  const dh2 = await dhRawBytes(newPrivKey, theirNewPubB64);
  const [rootKey2, sendChainKey] = await kdfRoot(rootKey1, dh2);

  return {
    ...session,
    rootKey: rootKey2,
    sendChainKey,
    recvChainKey,
    sendIdx: 0,
    recvIdx: 0,
    ourPrivKey: newPrivKey,
    ourPubKeyB64: newPubB64,
    theirPubKeyB64: theirNewPubB64,
  };
}

// ── Session initialization ───────────────────────────────────────────────────

/**
 * Called by the party who sends the first encrypted message (the "initiator").
 * Generates an ephemeral ratchet key pair and bootstraps the sending chain.
 * The resulting session has a valid sendChainKey but no recvChainKey yet.
 */
export async function initSenderSession(
  ourIdentPrivKey: CryptoKey,
  theirIdentPubB64: string,
  otherUserId: number
): Promise<RatchetSession> {
  const initRK = await deriveInitialRootKey(ourIdentPrivKey, theirIdentPubB64);

  // Generate ephemeral ratchet key pair
  const { privateKey: ratchetPrivKey, publicKeyB64: ratchetPubB64 } = await generateRatchetKeyPair();

  // Derive sending chain: DH(ourRatchetPriv, theirIdentPub)
  const dh = await dhRawBytes(ratchetPrivKey, theirIdentPubB64);
  const [rootKey, sendChainKey] = await kdfRoot(initRK, dh);

  return {
    otherUserId,
    rootKey,
    sendChainKey,
    recvChainKey: null,
    sendIdx: 0,
    recvIdx: 0,
    ourPrivKey: ratchetPrivKey,
    ourPubKeyB64: ratchetPubB64,
    theirPubKeyB64: theirIdentPubB64, // placeholder until first reply arrives
    skippedKeys: new Map(),
    ready: true,
    isInitiator: true,
  };
}

/**
 * Called by the responding party on receipt of the first encrypted message.
 * Uses the sender's ephemeral ratchet public key (from the message header) to
 * derive the receiving chain, then bootstraps a sending chain with a fresh key.
 */
export async function initReceiverSession(
  ourIdentPrivKey: CryptoKey,
  theirIdentPubB64: string,
  theirRatchetPubB64: string,
  otherUserId: number
): Promise<RatchetSession> {
  const initRK = await deriveInitialRootKey(ourIdentPrivKey, theirIdentPubB64);

  // Receiving chain: DH(ourIdentPriv, theirRatchetPub)
  const dh1 = await dhRawBytes(ourIdentPrivKey, theirRatchetPubB64);
  const [rootKey1, recvChainKey] = await kdfRoot(initRK, dh1);

  // Generate our own ratchet key pair
  const { privateKey: ourRatchetPriv, publicKeyB64: ourRatchetPub } = await generateRatchetKeyPair();

  // Sending chain: DH(ourRatchetPriv, theirRatchetPub)
  const dh2 = await dhRawBytes(ourRatchetPriv, theirRatchetPubB64);
  const [rootKey2, sendChainKey] = await kdfRoot(rootKey1, dh2);

  return {
    otherUserId,
    rootKey: rootKey2,
    sendChainKey,
    recvChainKey,
    sendIdx: 0,
    recvIdx: 0,
    ourPrivKey: ourRatchetPriv,
    ourPubKeyB64: ourRatchetPub,
    theirPubKeyB64: theirRatchetPubB64,
    skippedKeys: new Map(),
    ready: true,
    isInitiator: false,
  };
}

// ── Encrypt ──────────────────────────────────────────────────────────────────

/**
 * Encrypt a plaintext message advancing the sending chain.
 * Returns ciphertext + IV + header fields + the updated session.
 * The caller MUST persist the returned session before the message is sent.
 */
export async function ratchetEncrypt(
  session: RatchetSession,
  plaintext: string
): Promise<RatchetEncryptResult> {
  if (!session.sendChainKey) {
    throw new Error("Ratchet session not ready for sending");
  }

  const [nextChainKey, mk] = await kdfChain(session.sendChainKey);
  const { ciphertext, iv } = await encryptWithMK(mk, plaintext);

  const updatedSession: RatchetSession = {
    ...session,
    sendChainKey: nextChainKey,
    sendIdx: session.sendIdx + 1,
  };

  return {
    session: updatedSession,
    ciphertext,
    iv,
    ratchetPublicKey: session.ourPubKeyB64!,
    msgIndex: session.sendIdx, // index of this message (before increment)
  };
}

// ── Decrypt ──────────────────────────────────────────────────────────────────

/**
 * Decrypt a received message, advancing the receiving chain (or performing a
 * DH ratchet step if the header contains a new ratchet public key).
 * Returns the plaintext + updated session.
 * The caller MUST persist the returned session after decryption.
 *
 * Throws on authentication failure — caller should show "[Encrypted message]".
 */
export async function ratchetDecrypt(
  session: RatchetSession,
  header: RatchetMessageHeader,
  ciphertext: string,
  iv: string
): Promise<{ session: RatchetSession; plaintext: string }> {
  // 1. Check skipped-key cache (out-of-order message within current epoch)
  const skipKey = `${header.ratchetPublicKey}:${header.msgIndex}`;
  const cachedMK = session.skippedKeys.get(skipKey);
  if (cachedMK) {
    const plaintext = await decryptWithMK(cachedMK, ciphertext, iv);
    const newSkipped = new Map(session.skippedKeys);
    newSkipped.delete(skipKey);
    return { session: { ...session, skippedKeys: newSkipped }, plaintext };
  }

  let s = session;

  // 2. DH ratchet step when a new ratchet public key is seen
  if (header.ratchetPublicKey !== s.theirPubKeyB64) {
    if (!s.ourPrivKey) throw new Error("No ratchet key available for DH step");
    s = await dhRatchetStep(s, header.ratchetPublicKey);
  }

  if (!s.recvChainKey) {
    throw new Error("No receiving chain key");
  }

  // 3. Cache message keys for any messages that were skipped in this epoch
  if (header.msgIndex > s.recvIdx) {
    const newSkipped = new Map(s.skippedKeys);
    if (newSkipped.size + (header.msgIndex - s.recvIdx) > MAX_SKIP) {
      throw new Error("Too many skipped messages — potential replay or desync");
    }
    while (s.recvIdx < header.msgIndex) {
      const [nextCK, mk] = await kdfChain(s.recvChainKey!);
      newSkipped.set(`${header.ratchetPublicKey}:${s.recvIdx}`, mk);
      s = { ...s, recvChainKey: nextCK, recvIdx: s.recvIdx + 1 };
    }
    s = { ...s, skippedKeys: newSkipped };
  }

  // 4. Derive the expected message key and decrypt
  const [nextCK, mk] = await kdfChain(s.recvChainKey!);
  const plaintext = await decryptWithMK(mk, ciphertext, iv);

  s = { ...s, recvChainKey: nextCK, recvIdx: s.recvIdx + 1 };

  return { session: s, plaintext };
}

// ── IndexedDB persistence ────────────────────────────────────────────────────
//
// RatchetSession contains CryptoKey objects (structured-cloneable) and
// Map<string, ArrayBuffer> (structured-cloneable), so it can be stored in
// IndexedDB directly without any serialization step.

const sessionCache = new Map<number, RatchetSession>(); // in-memory, keyed by otherUserId

export async function saveRatchetSession(session: RatchetSession): Promise<void> {
  sessionCache.set(session.otherUserId, session);
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(RATCHET_STORE, "readwrite");
      tx.objectStore(RATCHET_STORE).put(session);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch {
    // Non-fatal: session lives in memory for this tab
  }
}

export async function loadRatchetSession(
  otherUserId: number
): Promise<RatchetSession | null> {
  // Memory first
  const cached = sessionCache.get(otherUserId);
  if (cached) return cached;

  try {
    const db = await openDB();
    const session = await new Promise<RatchetSession | null>((resolve, reject) => {
      const tx = db.transaction(RATCHET_STORE, "readonly");
      const req = tx.objectStore(RATCHET_STORE).get(otherUserId);
      req.onsuccess = () => {
        db.close();
        const s = req.result as RatchetSession | undefined;
        // Rehydrate Map if it was stored as a plain object (older IDB engines)
        if (s && !(s.skippedKeys instanceof Map)) {
          s.skippedKeys = new Map(Object.entries(s.skippedKeys as any));
        }
        resolve(s ?? null);
      };
      req.onerror = () => { db.close(); reject(req.error); };
    });
    if (session) sessionCache.set(otherUserId, session);
    return session;
  } catch {
    return null;
  }
}

export function clearSessionCache(otherUserId: number) {
  sessionCache.delete(otherUserId);
}
