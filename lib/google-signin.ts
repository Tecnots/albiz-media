"use client";

import { signIn as nextAuthSignIn } from "next-auth/react";
import { signInWithPopup } from "firebase/auth";
import { getFirebaseAuth, getGoogleProvider } from "./firebase-client";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";

export type GoogleSignInResult = {
  ok: boolean;
  showOnboard?: boolean;
  error?: string;
};

/**
 * Handle Google Sign-In natively on iOS/Android if running under Capacitor,
 * falling back to the standard web Firebase popup flow otherwise.
 */
export async function signInWithGoogle(callbackUrl: string = "/"): Promise<GoogleSignInResult> {
  try {
    let idToken: string;

    if (Capacitor.isNativePlatform()) {
      // Native (iOS/Android) Google Sign-In using the Capacitor Firebase plugin.
      // signInWithGoogle() signs the user into the native Firebase SDK (skipNativeAuth: false),
      // but result.credential.idToken is the *Google* OAuth token. Our backend verifies a
      // *Firebase* ID token, so read it back from the now-signed-in Firebase user.
      await FirebaseAuthentication.signInWithGoogle();
      const { token } = await FirebaseAuthentication.getIdToken();
      if (!token) {
        throw new Error("No Firebase ID token returned from native Google Sign-In");
      }
      idToken = token;
    } else {
      // Web Google Sign-In using standard Firebase Auth
      const auth = getFirebaseAuth();
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
      console.warn("[google-signin] popup cancelled, code:", code, err);
      return { ok: false, error: "Sign-in cancelled" };
    }
    if (code === "auth/popup-blocked") {
      return { ok: false, error: "Popup blocked — allow popups and try again" };
    }
    if (code === "auth/network-request-failed") {
      return { ok: false, error: "Network error — try again" };
    }
    if (code === "auth/unauthorized-domain") {
      return { ok: false, error: "Domain not authorized. If testing on mobile, add your local IP to Firebase Authorized Domains." };
    }
    console.error("[google-signin] error:", err);
    return { ok: false, error: err?.message || "Sign in failed" };
  }
}
