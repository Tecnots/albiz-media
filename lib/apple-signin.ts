"use client";

import { signIn as nextAuthSignIn } from "next-auth/react";
import { signInWithPopup, signInWithCredential } from "firebase/auth";
import { getFirebaseAuth, getAppleProvider } from "./firebase-client";
import { isNative } from "@/app/lib/capacitor";

export type AppleSignInResult = {
  ok: boolean;
  showOnboard?: boolean;
  error?: string;
};

export async function signInWithApple(callbackUrl: string = "/"): Promise<AppleSignInResult> {
  try {
    const auth = getFirebaseAuth();

    let idToken: string;
    if (isNative) {
      idToken = await nativeAppleSignIn();
    } else {
      const result = await signInWithPopup(auth, getAppleProvider());
      idToken = await result.user.getIdToken();
    }

    const res = await nextAuthSignIn("firebase", {
      idToken,
      redirect: false,
      callbackUrl,
    });

    if (!res?.ok) {
      return { ok: false, error: res?.error || "Sign in failed" };
    }

    let showOnboard = false;
    try {
      const sessionRes = await fetch("/api/auth/session");
      const session = await sessionRes.json();
      const userId = session?.user?.id;
      if (userId) {
        const interestsRes = await fetch(`/api/interests?userId=${userId}`);
        const interests = await interestsRes.json();
        const list = Array.isArray(interests) ? interests : interests?.interests;
        showOnboard = !list || list.length === 0;
      }
    } catch {
      // non-blocking
    }

    return { ok: true, showOnboard };
  } catch (err: any) {
    const code = err?.code as string | undefined;
    if (
      code === "auth/popup-closed-by-user" ||
      code === "auth/cancelled-popup-request" ||
      code === "1001"
    ) {
      return { ok: false, error: "Sign-in cancelled" };
    }
    if (code === "auth/popup-blocked") {
      return { ok: false, error: "Popup blocked — allow popups and try again" };
    }
    if (code === "auth/network-request-failed") {
      return { ok: false, error: "Network error — try again" };
    }
    if (code === "auth/unauthorized-domain") {
      return { ok: false, error: "Domain not authorized. Add your domain to Firebase Authorized Domains." };
    }
    if (code === "auth/operation-not-allowed") {
      return { ok: false, error: "Apple Sign-In is not enabled in Firebase Console under Authentication > Sign-in method." };
    }
    console.error("[apple-signin] error:", err);
    return { ok: false, error: err?.message || "Sign in failed" };
  }
}

/**
 * Native iOS Apple sign-in via ASAuthorizationAppleIDProvider (the native sheet).
 *
 * Key differences from the web flow:
 *  - clientId must be the iOS Bundle ID, NOT the web Service ID
 *  - redirectURI must NOT be passed — the native flow has no redirect
 *  - scopes and nonce are the only required parameters
 */
async function nativeAppleSignIn(): Promise<string> {
  // Dynamic import keeps the native plugin out of the web bundle entirely.
  const { SignInWithApple } = await import("@capacitor-community/apple-sign-in");

  const rawNonce = generateNonce();
  const hashedNonce = await sha256(rawNonce);

  // On iOS native, clientId is the App Bundle ID — never the web Service ID.
  // The native ASAuthorizationAppleIDProvider identifies the app by its bundle ID.
  const bundleId = process.env.NEXT_PUBLIC_APPLE_BUNDLE_ID || "com.albizmedia.app";

  const { response } = await SignInWithApple.authorize({
    clientId: bundleId,
    // The type requires redirectURI but the native iOS flow (ASAuthorizationAppleIDProvider)
    // ignores it entirely — only the web fallback path uses it. Empty string is safe here.
    redirectURI: "",
    scopes: "email name",
    nonce: hashedNonce,
  });

  if (!response?.identityToken) {
    throw new Error("Apple did not return an identity token");
  }

  // Exchange Apple's identity token for a Firebase credential, passing the raw
  // (un-hashed) nonce so Firebase can verify it against what we sent to Apple.
  const credential = getAppleProvider().credential({
    idToken: response.identityToken,
    rawNonce,
  });

  const userCred = await signInWithCredential(getFirebaseAuth(), credential);
  return userCred.user.getIdToken();
}

function generateNonce(length = 32): string {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._";
  const random = new Uint8Array(length);
  if (typeof window !== "undefined" && window.crypto) {
    window.crypto.getRandomValues(random);
  } else {
    for (let i = 0; i < length; i++) {
      random[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(random, (b) => charset[b % charset.length]).join("");
}

async function sha256(value: string): Promise<string> {
  if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
    const data = new TextEncoder().encode(value);
    const digest = await window.crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return sha256Pure(value);
}

function sha256Pure(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }
  
  const words: number[] = [];
  const asciiLength = ascii.length * 8;
  
  for (let i = 0; i < ascii.length; i++) {
    words[i >> 2] |= (ascii.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
  }
  
  words[asciiLength >> 5] |= 0x80 << (24 - (asciiLength % 32));
  words[((asciiLength + 64) >>> 9 << 4) + 15] = asciiLength;
  
  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];
  
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  
  const w = new Array(64);
  
  for (let i = 0; i < words.length; i += 16) {
    let a = hash[0];
    let b = hash[1];
    let c = hash[2];
    let d = hash[3];
    let e = hash[4];
    let f = hash[5];
    let g = hash[6];
    let h = hash[7];
    
    for (let j = 0; j < 64; j++) {
      if (j < 16) {
        w[j] = words[i + j] || 0;
      } else {
        const s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        const s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }
      
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + k[j] + w[j]) | 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) | 0;
      
      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }
    
    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }
  
  return hash.map(h => {
    const hex = (h >>> 0).toString(16);
    return "00000000".substring(hex.length) + hex;
  }).join("");
}