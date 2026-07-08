"use client";

// E2E encryption primitives using Web Crypto API (zero dependencies).
// Uses ECDH P-256 for key exchange and AES-GCM-256 for message encryption.
//
// IndexedDB layout (DB_VERSION 3):
//   "privateKeys"    — identity key pairs  { userId, key: CryptoKey, publicKey: string }
//   "ratchetSessions" — DR session state   { otherUserId, ...RatchetSession }

export const DB_NAME = "albiz-e2e-keys";
export const DB_VERSION = 3;
const IDENTITY_STORE = "privateKeys";
export const RATCHET_STORE = "ratchetSessions";

// --- Utility: Web Crypto availability ---

function isWebCryptoAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.crypto !== "undefined" &&
    typeof window.crypto.subtle !== "undefined"
  );
}

// --- Utility: ArrayBuffer ↔ Base64 ---

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// --- IndexedDB: open (handles all version upgrades) ---

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      // v1 → identity key store
      if (!db.objectStoreNames.contains(IDENTITY_STORE)) {
        db.createObjectStore(IDENTITY_STORE, { keyPath: "userId" });
      }
      // v3 → ratchet session store (keyed by otherUserId)
      if (!db.objectStoreNames.contains(RATCHET_STORE)) {
        db.createObjectStore(RATCHET_STORE, { keyPath: "otherUserId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// --- Identity key pair storage ---

interface StoredIdentityEntry {
  userId: number;
  key: CryptoKey;       // private CryptoKey, non-extractable
  publicKey: string;    // base64-encoded ECDH public key
}

export async function storeKeyPair(
  userId: number,
  privateKey: CryptoKey,
  publicKeyBase64: string
): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDENTITY_STORE, "readwrite");
      const store = tx.objectStore(IDENTITY_STORE);
      store.put({ userId, key: privateKey, publicKey: publicKeyBase64 } satisfies StoredIdentityEntry);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch {
    // IndexedDB unavailable — identity key lives in memory only
  }
}

export async function getStoredKeyPair(
  userId: number
): Promise<{ privateKey: CryptoKey; publicKeyBase64: string } | null> {
  try {
    const db = await openDB();
    return await new Promise<{ privateKey: CryptoKey; publicKeyBase64: string } | null>(
      (resolve, reject) => {
        const tx = db.transaction(IDENTITY_STORE, "readonly");
        const store = tx.objectStore(IDENTITY_STORE);
        const request = store.get(userId);
        request.onsuccess = () => {
          db.close();
          const entry = request.result as StoredIdentityEntry | undefined;
          // Both key AND publicKey must be present (v1 entries only had `key`)
          if (entry?.key && entry?.publicKey) {
            resolve({ privateKey: entry.key, publicKeyBase64: entry.publicKey });
          } else {
            resolve(null);
          }
        };
        request.onerror = () => { db.close(); reject(request.error); };
      }
    );
  } catch {
    return null;
  }
}

// --- Key generation & exchange ---

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  if (!isWebCryptoAvailable()) {
    throw new Error("Web Crypto API is not available in this browser");
  }
  return crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    false, // private key is NOT extractable
    ["deriveKey", "deriveBits"]
  );
}

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return arrayBufferToBase64(raw);
}

export async function importPublicKey(base64: string): Promise<CryptoKey> {
  const raw = base64ToArrayBuffer(base64);
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );
}

// Raw ECDH DH output (32 bytes for P-256) — used by the Double Ratchet
export async function dhRawBytes(
  privateKey: CryptoKey,
  theirPublicKeyBase64: string
): Promise<ArrayBuffer> {
  const theirPublicKey = await importPublicKey(theirPublicKeyBase64);
  return crypto.subtle.deriveBits(
    { name: "ECDH", public: theirPublicKey },
    privateKey,
    256 // P-256 = 32 bytes
  );
}

// Legacy: derive an AES-GCM shared key (kept for backward-compat decryption of pre-ratchet messages)
export async function deriveSharedKey(
  privateKey: CryptoKey,
  otherPublicKeyBase64: string
): Promise<CryptoKey> {
  const otherPublicKey = await importPublicKey(otherPublicKeyBase64);
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: otherPublicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// --- AES-GCM encrypt / decrypt (legacy — used for backward-compat path) ---

export async function encryptMessage(
  sharedKey: CryptoKey,
  plaintext: string
): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    sharedKey,
    data
  );
  return {
    ciphertext: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
  };
}

export async function decryptMessage(
  sharedKey: CryptoKey,
  ciphertext: string,
  iv: string
): Promise<string> {
  const data = base64ToArrayBuffer(ciphertext);
  const ivBuffer = new Uint8Array(base64ToArrayBuffer(iv));
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBuffer },
    sharedKey,
    data
  );
  return new TextDecoder().decode(decrypted);
}

// --- Identity key pair: get or create (stable across sessions) ---

const memoryKeys = new Map<number, { privateKey: CryptoKey; publicKeyBase64: string }>();

export async function getOrCreateKeyPair(
  userId: number
): Promise<{ publicKey: string; privateKey: CryptoKey }> {
  // 1. In-memory cache (fastest)
  const cached = memoryKeys.get(userId);
  if (cached) {
    return { publicKey: cached.publicKeyBase64, privateKey: cached.privateKey };
  }

  // 2. IndexedDB (survives browser restart)
  const stored = await getStoredKeyPair(userId);
  if (stored) {
    memoryKeys.set(userId, {
      privateKey: stored.privateKey,
      publicKeyBase64: stored.publicKeyBase64,
    });
    return { publicKey: stored.publicKeyBase64, privateKey: stored.privateKey };
  }

  // 3. Generate fresh key pair (first use or storage cleared)
  const keyPair = await generateKeyPair();
  const publicKeyBase64 = await exportPublicKey(keyPair.publicKey);

  memoryKeys.set(userId, { privateKey: keyPair.privateKey, publicKeyBase64 });
  await storeKeyPair(userId, keyPair.privateKey, publicKeyBase64);

  return { publicKey: publicKeyBase64, privateKey: keyPair.privateKey };
}
