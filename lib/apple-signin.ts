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
  const { SignInWithApple } = await import(/* webpackIgnore: true */ "@capacitor-community/apple-sign-in");

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
  crypto.getRandomValues(random);
  return Array.from(random, (b) => charset[b % charset.length]).join("");
}

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}