"use client";

import { signIn as nextAuthSignIn } from "next-auth/react";
import { signInWithPopup, signInWithCredential, GoogleAuthProvider } from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { getFirebaseAuth, getGoogleProvider } from "./firebase-client";

export type GoogleSignInResult = {
  ok: boolean;
  showOnboard?: boolean;
  error?: string;
};

/**
 * Sign in with Google.
 * - On Android/iOS: uses the native Google Sign-In SDK via @capacitor-firebase/authentication
 * - On web: uses the Firebase popup flow
 *
 * In both cases the Firebase ID token is exchanged for a NextAuth session.
 */
export async function signInWithGoogle(callbackUrl: string = "/"): Promise<GoogleSignInResult> {
  try {
    const auth = getFirebaseAuth();
    let idToken: string;

    if (Capacitor.isNativePlatform()) {
      // Native Android / iOS — uses the OS-level Google account picker, no browser redirect
      const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication");
      const result = await FirebaseAuthentication.signInWithGoogle();
      if (!result.credential?.idToken) {
        return { ok: false, error: "Google sign-in failed — no token returned" };
      }
      const credential = GoogleAuthProvider.credential(result.credential.idToken);
      const firebaseResult = await signInWithCredential(auth, credential);
      idToken = await firebaseResult.user.getIdToken();
    } else {
      // Web browser — original popup flow
      const result = await signInWithPopup(auth, getGoogleProvider());
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

    // Check if the user needs onboarding (no interests saved yet)
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
      // don't block sign-in if this check fails
    }

    return { ok: true, showOnboard };
  } catch (err: any) {
    const code = err?.code as string | undefined;
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
      return { ok: false, error: "Sign-in cancelled" };
    }
    if (code === "auth/popup-blocked") {
      return { ok: false, error: "Popup blocked — allow popups and try again" };
    }
    if (code === "auth/network-request-failed") {
      return { ok: false, error: "Network error — try again" };
    }
    console.error("[google-signin] error:", err);
    return { ok: false, error: err?.message || "Sign in failed" };
  }
}
