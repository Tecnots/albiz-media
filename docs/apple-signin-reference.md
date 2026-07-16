# Apple Sign-In — Working Reference (branch `1607_1_apple`)

This document captures the complete working Apple Sign-In implementation. Use it to restore Apple Sign-In on any other branch.

---

## Environment Variables (`.env`)

These are already set and working. Copy them exactly to any branch that needs Apple Sign-In.

### Firebase (client-side) — required for Apple auth

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBsrj4bXxdtg8vxP-B54gMwRL-0CmLg174
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=albizmedia-dev-a10dc.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=albizmedia-dev-a10dc
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=albizmedia-dev-a10dc.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=544132537166
NEXT_PUBLIC_FIREBASE_APP_ID=1:544132537166:web:e81f30bd022b526fcc9c1f
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-S7PJ467YGE
```

### Firebase Admin (server-side) — used for ID token verification

```
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-fbsvc@albizmedia-dev-a10dc.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCwfkmIpJ8G1X/P\nmCMY33arEPeEZ7wD0Ryta55qrYQOoIT9SoQKNnYzzkRMV3xeo1EU4bRvT632yC3I\n6JD9rptQHl0zozd/jUATvgLiwFFYbxvohUvLQSj+4+VznCjx2qGxgoxK7y48/kOD\nonhhZDILk9VpX8D8p7QA3NXKFeAi4ZZC8wEFowt/MHB6Mxkoywr4VMJOtaYSNmmL\nOIqTr4LqF4AE/pAtuoW31m5b1DC4F+q2mlYmP6Fz+v3iy6vyAOYrflUuzTrMLVGn\nnpluOGcYkJHUEELUtG2jmXCc9sBZl8US0pk2NaNcPMv/LjfJWY62NihFzIfeGk8G\nETNKV5KNAgMBAAECggEADgJYL+JxRQeZV48J6iWCs91q6DWbtOnaTuGl923Cd67C\nH6DUjkL4avBKd4zSMGjiPLgVrGg0tMv65mGfcKN1bIycdUbVVuiNV4PTktAVJOHc\n4z4BYCbR7DmGswCIN3pVL1Pfcus9TlYYYdB5obFkT4rye6TAGs3s+cyNo7bMzbfc\ngyihh8LbsPno2htbTyx8/36fznCOr83zFxp9yTkMdWRQURi5BFrUc61gb1GKa8YJ\nsXCkMWSXLcCQr7bgzp5cC7QFRa8dbQQmdsi3cpw7ybo1drUt6qT+Trk7sOeeFSHC\nUh7NIopEIcwer9yrUXK1Nsald+cTetfRzRi5VnxWOQKBgQDccAhM+8jHddmRfOiy\nYl6eLxEJDghDpB28sXQoId4rvIXYmaHuNeTg9ANmxh5L6hgjsFzYyaCjx0s+6qGF\nxaSiVV7CLpPfFrGYQrwawzd9AjPZy01hZwLFFPS3IwmrDcQsp1hTeso4hXlrnUKX\nWpbxReNuMQY2tfx9bxr1Zz1sRwKBgQDM92Av70JTmHeOYS4uvvQLWPtRdjOtaT4I\nPAO5wq5RQDtAmHy2lYROUvDYs2+InY1WQavwatqbh361mvqVtksCFhhwkS7e5rdL\nzXN2I2Q0TPzLrIGxgTxKYTG+yMwpPUSDqIsjtb2RavoTg7Yf4rO4bqgliGVNOUbU\nZh4uLZ/4iwKBgBGSPJcmWtLLahRWyJWvkas6RTlbjP0XT+eCnae1S2hhFqo1VNsQ\nILZtvPesQy358wKlREFjkRJ9CFpziXyITJ9D/tGrtM3LmUxxxVy8wueMDWYG9pwV\nAfuDuB4BBPxFlKWakUfWOdhXi14wouY9qlqBH6fg8IXb68xz1spI+HRxAoGAU+Hl\njpiHd3jNbQqegOkLLV20NMmAKrcIeQw+phZjisMTvMLrPzn/lKJjCPyeZ7W68xMb\nT+AbKU2RcLdFWGHrXqY2SFNScEzRtQcW+sFPMAxV5PDrfv6Z8wLF/gNlcncthAhF\nMU8ejtXOFJBxx6jazl8TF5EzjCAluaU1MsbfUjMCgYEA26e3AqMZRsgSgcZUCCXH\nYS+m0s8kBkZPrM8LROvi/gyhzmq5jwGboIxTfM33BbKExYXobZwiT4+UmPV4n4sL\nza2be/sLrGJTTBv+45q0PBSzoFN0AYAyY+TKES4o20G7IIltMRRZjstmo6cfRpWA\ncUNTALoq7p/8bSVei+3vCYM=\n-----END PRIVATE KEY-----\n"
```

### Auth secrets

```
NEXTAUTH_SECRET=super_secret_albiz_auth_key_12345
AUTH_SECRET=super_secret_albiz_auth_key_12345
NEXTAUTH_URL=http://192.168.1.35:3000
CAPACITOR_SERVER_URL=http://192.168.1.35:3000
```

---

## npm packages (package.json)

These must be in `dependencies`:

```json
"@capacitor-community/apple-sign-in": "^7.1.0",
"@capacitor-firebase/authentication": "8.3.0",
"@capacitor/core": "^8.3.1",
"firebase": "^12.13.0",
"firebase-admin": "^14.0.0"
```

---

## Patch file

The `@capacitor-community/apple-sign-in` plugin targets Capacitor Swift PM v7. Since we use Capacitor v8, there's a patch at `patches/@capacitor-community__apple-sign-in.patch` that bumps the dependency:

```diff
-        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "7.0.0")
+        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
```

This patch is auto-applied by pnpm. Make sure this file exists and `pnpm install` is run so the patch takes effect.

---

## Files that make Apple Sign-In work

### 1. `lib/apple-signin.ts` — main sign-in logic

Handles both web and native iOS flows:
- **Web**: calls `signInWithPopup(auth, getAppleProvider())` using Firebase's `OAuthProvider("apple.com")`
- **Native iOS**: uses `@capacitor-community/apple-sign-in` to trigger the native ASAuthorizationAppleIDProvider sheet, then exchanges the Apple identity token for a Firebase credential using nonce-based PKCE

Both flows end with a Firebase ID token that gets sent to NextAuth via the `"firebase"` credentials provider.

Key implementation details:
- `isNative` from `app/lib/capacitor.ts` determines which flow to use
- On native, `clientId` must be the iOS Bundle ID (`com.albizmedia.app`), NOT the web Service ID
- On native, `redirectURI` is set to `""` (the native flow doesn't use redirects)
- A raw nonce is generated, SHA-256 hashed, and sent to Apple; the raw nonce goes to Firebase for verification
- After successful auth, checks if user needs onboarding (no interests)

### 2. `lib/firebase-client.ts` — Firebase app + Apple provider

Exports `getAppleProvider()` which creates `new OAuthProvider("apple.com")` with email and name scopes.

Also exports `getFirebaseAuth()` for the auth instance.

### 3. `lib/firebase-admin.ts` — server-side token verification

`verifyFirebaseIdToken(idToken)` — verifies Firebase ID tokens via the REST API (`identitytoolkit.googleapis.com`). No service account JSON file needed; uses `NEXT_PUBLIC_FIREBASE_API_KEY`.

### 4. `auth.ts` — NextAuth configuration

Has a `Credentials` provider with `id: "firebase"` that:
1. Takes a Firebase ID token
2. Calls `verifyFirebaseIdToken()` to validate it
3. Finds or creates the user in the database (Prisma)
4. Returns the user for session creation

### 5. `auth.config.ts` — NextAuth base config

JWT strategy, sign-in page is `/`, callbacks enrich token and session with user ID and role.

### 6. `app/lib/capacitor.ts` — native platform detection

Exports `isNative` which is `true` when running inside Capacitor on a real device.

### 7. `app/(main)/layout.tsx` — UI buttons

Both the sign-in and sign-up modals have a "Continue with Apple" button (black, `#0a0a0a` background) that calls `signInWithApple("/")`. The import is:
```ts
import { signInWithApple } from "@/lib/apple-signin";
```

The button handler:
```ts
onClick={async () => {
  setSocialLoading("apple");
  const r = await signInWithApple("/");
  if (!r.ok && r.error) setError(r.error);
  else if (r.ok) { await update(); onClose(); if (r.showOnboard) onShowOnboard?.(); }
  setSocialLoading(null);
}}
```

---

## Capacitor config (`capacitor.config.ts`)

```ts
plugins: {
  FirebaseAuthentication: {
    skipNativeAuth: false,
    providers: ['google.com', 'apple.com'],
  },
}
```

- `appId: 'com.albizmedia.app'`
- `skipNativeAuth: false` is critical — it lets the Firebase plugin handle the native auth flow

---

## iOS-specific files

### `ios/App/App/App.entitlements`

Must contain the Sign in with Apple entitlement:

```xml
<key>com.apple.developer.applesignin</key>
<array>
  <string>Default</string>
</array>
```

### `ios/App/CapApp-SPM/Package.swift`

Must include:
```swift
.package(name: "CapacitorCommunityAppleSignIn", path: ".../@capacitor-community/apple-sign-in"),
.package(name: "CapacitorFirebaseAuthentication", path: ".../@capacitor-firebase/authentication"),
```

And in the target dependencies:
```swift
.product(name: "CapacitorCommunityAppleSignIn", package: "CapacitorCommunityAppleSignIn"),
.product(name: "CapacitorFirebaseAuthentication", package: "CapacitorFirebaseAuthentication"),
```

The capacitor-swift-pm version is `8.3.1`.

### `ios/App/App/AppDelegate.swift`

Has `FirebaseApp.configure()` in `didFinishLaunchingWithOptions`. No Apple-specific code needed here — the Capacitor plugin handles everything.

### `ios/App/config/development/GoogleService-Info.plist`

Dev Firebase project config:
- PROJECT_ID: `albizmedia-dev-a10dc`
- BUNDLE_ID: `com.albizmedia.app.dev`
- CLIENT_ID: `544132537166-l86acois5sgn1c12bc44r7jv27ae6n49.apps.googleusercontent.com`

### `ios/App/config/production/GoogleService-Info.plist`

Prod Firebase project config:
- PROJECT_ID: `albiz-media-b0386`
- BUNDLE_ID: `com.albizmedia.app`
- CLIENT_ID: `389515414975-hf7is7sn16fsbasac4gk2r6roqs0femc.apps.googleusercontent.com`

### `ios/App/App/Info.plist`

Has `CFBundleURLSchemes` for both dev and prod Google OAuth reversed client IDs.

---

## Firebase Console setup (already done)

1. Firebase project: `albizmedia-dev-a10dc`
2. Authentication > Sign-in method > **Apple** is enabled
3. The Apple Services ID, Team ID, Key ID, and `.p8` private key are configured in Firebase Console
4. Authorized domains include the local dev IP and production domain

---

## Apple Developer Console setup (already done)

1. **App ID** `com.albizmedia.app` — has "Sign In with Apple" capability enabled
2. **Services ID** (for web) — configured with return URL pointing to Firebase auth handler: `https://albizmedia-dev-a10dc.firebaseapp.com/__/auth/handler`
3. **Key** — a key with Sign In with Apple enabled, `.p8` file downloaded, Key ID noted

---

## Xcode setup (already done, but must verify on new branches)

1. Target > Signing & Capabilities > "Sign In with Apple" capability is added
2. Bundle ID matches the App ID that has Sign In with Apple enabled
3. The correct GoogleService-Info.plist is being copied for the active scheme (dev vs prod)

---

## Auth flow summary

```
User taps "Continue with Apple"
  |
  ├── Web: Firebase signInWithPopup(OAuthProvider("apple.com"))
  |     → Apple OAuth popup → Firebase ID token
  |
  └── Native iOS: @capacitor-community/apple-sign-in
        → Native Apple sheet (ASAuthorizationAppleIDProvider)
        → Apple identity token + nonce
        → Firebase signInWithCredential(OAuthProvider.credential({idToken, rawNonce}))
        → Firebase ID token
  |
  v
NextAuth signIn("firebase", { idToken })
  → auth.ts authorize() → verifyFirebaseIdToken(idToken)
  → Find or create user in Prisma DB
  → Return session with user data
  → Check onboarding status
```

---

## Troubleshooting checklist

When Apple Sign-In breaks on another branch, check these in order:

1. **`lib/apple-signin.ts` exists** and exports `signInWithApple`
2. **`lib/firebase-client.ts`** has `getAppleProvider()` function
3. **`lib/firebase-admin.ts`** has `verifyFirebaseIdToken()` function
4. **`auth.ts`** has the `firebase` credentials provider
5. **`app/(main)/layout.tsx`** imports `signInWithApple` and has the Apple button in both modals
6. **`capacitor.config.ts`** has `'apple.com'` in the providers array and `skipNativeAuth: false`
7. **`package.json`** has `@capacitor-community/apple-sign-in` and `@capacitor-firebase/authentication`
8. **Patch file** exists at `patches/@capacitor-community__apple-sign-in.patch`
9. **`ios/App/App/App.entitlements`** has the `com.apple.developer.applesignin` key
10. **`ios/App/CapApp-SPM/Package.swift`** includes `CapacitorCommunityAppleSignIn` and `CapacitorFirebaseAuthentication`
11. **`.env`** has all Firebase env vars listed above
12. Run `pnpm install` (applies the patch) then `pnpm cap:sync` then rebuild in Xcode

---

## How to restore on a broken branch

```bash
# 1. Copy these files from the working branch
git checkout 1607_1_apple -- lib/apple-signin.ts
git checkout 1607_1_apple -- lib/firebase-client.ts
git checkout 1607_1_apple -- lib/firebase-admin.ts
git checkout 1607_1_apple -- auth.ts
git checkout 1607_1_apple -- auth.config.ts
git checkout 1607_1_apple -- capacitor.config.ts
git checkout 1607_1_apple -- patches/@capacitor-community__apple-sign-in.patch
git checkout 1607_1_apple -- ios/App/App/App.entitlements
git checkout 1607_1_apple -- ios/App/CapApp-SPM/Package.swift
git checkout 1607_1_apple -- ios/App/App/AppDelegate.swift

# 2. Make sure package.json has the right deps (check manually, don't blindly checkout)
# Required: @capacitor-community/apple-sign-in, @capacitor-firebase/authentication

# 3. Make sure layout.tsx has the Apple button and import
# Check: app/(main)/layout.tsx should import signInWithApple and have the button

# 4. Install and sync
pnpm install
pnpm cap:sync

# 5. Open Xcode and verify Sign In with Apple capability is present
pnpm cap:open:ios
```
