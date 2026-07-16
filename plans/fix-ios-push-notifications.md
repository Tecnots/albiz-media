## Goal

Fix iOS push notifications so the app can receive an APNS token from Apple, which Firebase Messaging needs to generate an FCM token. Currently every `getToken()` call fails with "No APNS token specified before fetching FCM Token" because iOS never issues one.

## Root Cause

Two things are missing:

1. **`App.entitlements` has no `aps-environment` key** — iOS refuses to register for push notifications without this entitlement, so `didRegisterForRemoteNotificationsWithDeviceToken` never fires.
2. **`AppDelegate.swift` never calls `UIApplication.shared.registerForRemoteNotifications()`** — even if the entitlement existed, the app doesn't actually ask iOS for a token.

## Approach

Add the missing entitlement and the missing registration call. These are the two minimal changes that unblock the entire push notification flow. No JS/TS changes needed — the Capacitor Firebase Messaging plugin handles the rest once the native side provides a token.

## Files to Modify

| File | Change | Reason |
|------|--------|--------|
| `ios/App/App/App.entitlements` | Add `aps-environment` key | iOS requires this to allow push notification registration |
| `ios/App/App/AppDelegate.swift` | Add `registerForRemoteNotifications()` call | Triggers iOS to request an APNS token from Apple |

## Steps

### 1. Add push notification entitlement (simple)

Edit `ios/App/App/App.entitlements` — add the `aps-environment` key with value `development`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.developer.applesignin</key>
    <array>
        <string>Default</string>
    </array>
    <key>aps-environment</key>
    <string>development</string>
</dict>
</plist>
```

> Note: Use `development` for debug builds. When you archive for App Store / TestFlight, Xcode automatically switches this to `production` if your provisioning profile has the production push entitlement.

### 2. Register for remote notifications in AppDelegate (simple)

Add one line in `didFinishLaunchingWithOptions`, after `FirebaseApp.configure()`:

```swift
func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    FirebaseApp.configure()
    application.registerForRemoteNotifications()
    return true
}
```

This tells iOS to request an APNS token. When it arrives, the existing `didRegisterForRemoteNotificationsWithDeviceToken` method passes it to Firebase Messaging, which can then generate an FCM token.

### 3. Verify in Apple Developer Portal (manual, outside code)

In [developer.apple.com](https://developer.apple.com/account) → Certificates, Identifiers & Profiles → Identifiers → your App ID (`com.albiz.media` or whatever your bundle ID is):
- Make sure **Push Notifications** capability is enabled
- Regenerate your provisioning profile if you just enabled it

### 4. Rebuild and test

```bash
cd ios/App && npx cap sync ios
```

Then build in Xcode on a **physical device** (push notifications don't work on simulator). You should see:
- `didRegisterForRemoteNotificationsWithDeviceToken` fires in the console
- `FCM registration token: <token>` prints successfully
- No more "No APNS token specified" errors

## Risks & Edge Cases

- **Simulator testing** — Push notifications only work on physical iOS devices. The entitlement error will still appear on simulator, but `registerForRemoteNotifications` will at least not crash.
- **Provisioning profile mismatch** — If the provisioning profile doesn't include push notifications, the entitlement won't be valid even with the plist change. Must verify in Apple Developer Portal.
- **Production vs development** — The `aps-environment` value in the entitlements file should be `development` for debug. Xcode handles switching to `production` for release/archive builds automatically when using automatic signing.
