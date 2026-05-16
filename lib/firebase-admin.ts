const IDENTITY_TOOLKIT_URL = "https://identitytoolkit.googleapis.com/v1/accounts:lookup";

type FirebaseUserInfo = {
  localId: string;
  email: string;
  displayName?: string;
  photoUrl?: string;
  emailVerified?: boolean;
  providerUserInfo?: Array<{
    providerId: string;
    displayName?: string;
    photoUrl?: string;
    email?: string;
  }>;
};

/**
 * Verify a Firebase ID token via the Firebase Auth REST API.
 * No service account required — uses the public API key.
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<{
  uid: string;
  email: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
}> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY is not set");
  }

  const res = await fetch(`${IDENTITY_TOOLKIT_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  const data = await res.json();

  if (!res.ok || data.error) {
    const msg = data.error?.message || "Invalid Firebase ID token";
    throw new Error(msg);
  }

  const users: FirebaseUserInfo[] = data.users || [];
  if (!users.length) {
    throw new Error("No user found for this token");
  }

  const user = users[0];
  return {
    uid: user.localId,
    email: user.email,
    name: user.displayName || user.providerUserInfo?.[0]?.displayName,
    picture: user.photoUrl || user.providerUserInfo?.[0]?.photoUrl,
    email_verified: user.emailVerified ?? false,
  };
}
