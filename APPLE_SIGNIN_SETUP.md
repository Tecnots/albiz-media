# Sign in with Apple — setup

The code is done (web + native). What remains is console/Xcode configuration that can't be done from the repo.

## What the code does

- `lib/firebase-client.ts` → `getAppleProvider()` (Firebase `OAuthProvider("apple.com")`).
- `lib/apple-signin.ts` → `signInWithApple()`. Web uses Firebase `signInWithPopup`; native iOS uses the native Apple sheet (`@capacitor-community/apple-sign-in`) then signs into Firebase. Both end up exchanging a **Firebase ID token** with the existing `"firebase"` NextAuth provider — so `auth.ts` and `lib/firebase-admin.ts` are unchanged.
- `app/(main)/layout.tsx` → a "Continue with Apple" button next to each "Continue with Google" button (sign-in and sign-up modals).

## Phase 1 — Apple Developer + Firebase console (required)

1. **Apple Developer Program** membership ($99/yr).
2. Apple Developer portal → Certificates, IDs & Profiles:
   - **App ID**: enable the **Sign In with Apple** capability.
   - **Services ID** (e.g. `media.albiz.web`) — this is the web OAuth client. Enable Sign In with Apple on it, then under **Configure**:
     - Domains and Subdomains: your production domain.
     - Return URLs: `https://<FIREBASE_PROJECT_ID>.firebaseapp.com/__/auth/handler`
   - **Key**: create a key with Sign In with Apple enabled. Download the `.p8` (one-time). Note the **Key ID** and your **Team ID**.
3. Firebase Console → Authentication → Sign-in method → **Apple** → Enable. Fill in:
   - Services ID, Apple Team ID, Key ID, and the `.p8` private key contents.
4. Firebase Console → Authentication → **Authorized domains**: add your production domain (and any local test domain).

After this, the **web** button works end-to-end. No code or env changes needed for web.

## Phase 4 — Native iOS (required for App Store)

App Store Guideline 4.8 requires native Sign in with Apple when you also offer Google sign-in in the iOS app.

1. Add env vars (used only by the native branch in `apple-signin.ts`):
   ```
   NEXT_PUBLIC_APPLE_SERVICE_ID=media.albiz.web        # your Services ID
   NEXT_PUBLIC_APPLE_REDIRECT_URI=https://<FIREBASE_PROJECT_ID>.firebaseapp.com/__/auth/handler
   ```
2. `pnpm cap:sync` then `pnpm cap:open:ios`.
3. In Xcode → target → **Signing & Capabilities** → **+ Capability** → **Sign In with Apple**.
4. Confirm the iOS bundle ID matches the App ID that has Sign In with Apple enabled.
5. Build to a device/simulator and test the button.

## Notes / Apple quirks (already handled)

- Apple returns the user's **name only on the first** authorization; `auth.ts` falls back to email-prefix/`"User"`, so nothing breaks.
- Email may be a **private relay** (`@privaterelay.appleid.com`) — stable per user, and we key by email, so it's fine.
- Apple provides **no avatar**; empty avatar is already handled.
