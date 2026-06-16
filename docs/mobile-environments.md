# Mobile Environments and Run Commands

This guide explains how to run and build the mobile applications for different environments (Development and Production) on Android and iOS.

---

## Environment Configurations

### Android
* **Development**
  * App Name: `AlbizMedia Dev`
  * Application ID Suffix: `.dev`
  * Version Name Suffix: `-dev`
  * Build Flavor: `development`
* **Production**
  * App Name: `AlbizMedia`
  * Application ID: `com.albizmedia.app`
  * Build Flavor: `production`

### iOS
* **Development**
  * Scheme: `development`
* **Production**
  * Scheme: `production`

---

## Run Commands

Before running the native app commands below, ensure your web application is synced to the platforms:
```bash
pnpm build
pnpm cap:sync
```

### 1. Capacitor CLI

You can run the app directly on a simulator/device using the Capacitor CLI.

#### Android
```bash
# Run Development Flavor
npx cap run android --flavor=development

# Run Production Flavor
npx cap run android --flavor=production
```

#### iOS
```bash
# Run Development Scheme
npx cap run ios --scheme=development

# Run Production Scheme
npx cap run ios --scheme=production
```

#### Live Reload (Development Only)
Make sure the Next.js dev server is running (`pnpm dev` on port `3000`):
```bash
# Android
npx cap run android --flavor=development -l --port=3000

# iOS
npx cap run ios --scheme=development -l --port=3000
```

---

## Convenience Scripts

The following scripts are added to `package.json` for convenience:

| Command | Action |
|---|---|
| `pnpm cap:run:android:dev` | Runs the development flavor on Android |
| `pnpm cap:run:android:prod` | Runs the production flavor on Android |
| `pnpm cap:run:ios:dev` | Runs the development scheme on iOS |
| `pnpm cap:run:ios:prod` | Runs the production scheme on iOS |
| `pnpm cap:run:android:dev:live` | Runs development on Android with Live Reload |
| `pnpm cap:run:ios:dev:live` | Runs development on iOS with Live Reload |

---

## Running in VS Code

A `.vscode/launch.json` configuration file is included. You can run these commands directly from the **Run & Debug** panel (`Ctrl+Shift+D` or `Cmd+Shift+D`) in VS Code:

* **Capacitor: Android Dev (Run)**: Compiles and runs the development flavor on a connected Android device or emulator.
* **Capacitor: Android Prod (Run)**: Compiles and runs the production flavor on a connected Android device or emulator.
* **Capacitor: iOS Dev (Run)**: Compiles and runs the development scheme on a connected iOS device or simulator.
* **Capacitor: iOS Prod (Run)**: Compiles and runs the production scheme on a connected iOS device or simulator.
* **Capacitor: Android Dev (Live Reload)**: Runs development flavor on Android with live reloading (Next.js server must be running).
* **Capacitor: iOS Dev (Live Reload)**: Runs development scheme on iOS with live reloading (Next.js server must be running).
* **Next.js: Debug Server**: Starts the local Next.js development server with the VS Code Node debugger attached.

---

## Running in IDEs

### Android Studio
1. Open the project in Android Studio:
   ```bash
   pnpm cap:open:android
   ```
2. Open the **Build Variants** tool window (usually bottom left, or via `View -> Tool Windows -> Build Variants`).
3. Select `developmentDebug` or `productionDebug` for the `:app` module.
4. Click the **Run** button (green play arrow).

### Xcode
1. Open the project in Xcode:
   ```bash
   pnpm cap:open:ios
   ```
2. Select the scheme selector dropdown in the top toolbar.
3. Select `development` or `production`.
4. Choose the target device/simulator and press `Cmd + R` to run.

---

## Direct CLI Builds

If you prefer building without opening the IDEs:

### Android Gradle
```bash
# Run Gradle task from project root
# Development Debug build and install
./android/gradlew -p android installDevelopmentDebug

# Production Debug build and install
./android/gradlew -p android installProductionDebug
```

### Xcodebuild
```bash
# Build Development scheme for a simulator
xcodebuild -workspace ios/App/App.xcworkspace -scheme development -configuration Debug -sdk iphonesimulator

# Build Production scheme for a simulator
xcodebuild -workspace ios/App/App.xcworkspace -scheme production -configuration Debug -sdk iphonesimulator
```
