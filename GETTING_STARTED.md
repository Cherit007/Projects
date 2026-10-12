# Getting Started

How to set up and run the Finance Tracker app on an iPhone and an Android
emulator at the same time. For the product specification, see
[README.md](README.md).

The app is built with [Expo](https://docs.expo.dev/) (SDK 57) on React
Native and TypeScript. One codebase runs on both platforms.

## Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 22.11 or newer | Pinned in `.nvmrc`; run `nvm use` |
| Android SDK | Platform 36, emulator | Installed at `~/Library/Android/sdk` |
| Android virtual device | `Pixel_8_API_36` | Android 36, ARM64 |
| Expo Go (iPhone) | Latest | Free on the App Store |

Xcode is **not** required to test on an iPhone; Expo Go loads the app from
your Mac over Wi‑Fi.

## First-time setup

```bash
cd ~/Desktop/Projects
nvm use
npm install
```

On your iPhone, install **Expo Go** from the App Store.

## Run on iPhone and Android together

1. Make sure the iPhone is on the same Wi‑Fi network as the Mac.
2. Start the Android emulator, if it is not already running:

   ```bash
   ~/Library/Android/sdk/emulator/emulator -avd Pixel_8_API_36 &
   ```

3. Start the dev server:

   ```bash
   cd ~/Desktop/Projects && nvm use && npm start
   ```

4. A QR code appears in the terminal. Scan it with the iPhone **Camera**
   app; it opens in Expo Go.
5. Press **`a`** in the same terminal to open the app on the Android
   emulator.

Both devices now run from the same code, and saving a file updates both
instantly.

## Troubleshooting

- **iPhone can't connect:** run `npx expo start --tunnel` instead. It routes
  through the internet rather than your local Wi‑Fi.
- **Emulator stuck on a loading spinner:** run
  `~/Library/Android/sdk/platform-tools/adb reverse tcp:8081 tcp:8081`,
  then press `a` again.
- **Dependency or config problems:** run `npx expo-doctor`, and
  `npx expo install --fix` to align package versions with the Expo SDK.

## Project structure

```text
src/
  app/            Screens (Expo Router: every file is a route)
    (tabs)/       Dashboard, Transactions, Accounts, Categories
    transaction/  Add/edit transaction form
    account/      Add/edit account form
    upi-review    Review list for detected payments
    upi-settings  Payment detection settings
  domain/         Pure finance logic: money, accounting rules, months,
                  UPI notification parser
  data/           SQLite migrations, repositories and queries
  services/upi/   Bridges the native listener to the database
  components/     Shared UI
  theme/          Colours and category icons
  hooks/          Shared React hooks
modules/upi-notifications/
                  Local Expo module: Android notification listener (Kotlin)
__tests__/        Unit tests for domain logic
docs/             Architecture decisions
```

Data is stored on the device in a SQLite database (`finance.db`). To add a
schema change, append a new entry to `MIGRATIONS` in
`src/data/local/migrations.ts`; never edit an existing one.

## Dependencies

Install packages with `npx expo install <package>` so versions match the
Expo SDK. The project's `.npmrc` sets `legacy-peer-deps=true` because Expo
Router lists optional peer dependencies that otherwise make npm fail;
required peer dependencies must therefore be installed explicitly.
`npx expo-doctor` reports any that are missing.

## Checks

Run these before committing:

```bash
npm run typecheck
npm run lint
npm test
```

## Android development build (UPI payment detection)

Expo Go cannot run custom native code, so UPI payment detection only works
in the Android development build. The iPhone keeps using Expo Go; the
feature is simply hidden there.

Build and install it once (and again whenever native code in `modules/`
changes):

```bash
nvm use
npm run android        # runs expo prebuild + Gradle, installs on the emulator
```

The first build downloads Gradle and Android libraries and can take a long
time on a slow connection. JavaScript changes after that load instantly
from `npm start`; open the **FinanceTracker** app on the emulator instead
of Expo Go.

To test detection without real payment apps (development builds only):

1. In the app, tap the lightning icon on the Dashboard, turn on
   **Detect UPI payments** and grant notification access.
2. Post a fake payment notification from the Mac:

   ```bash
   adb shell 'cmd notification post -S bigtext -t "₹250 paid to Swiggy" tag1 "Paid from HDFC Bank. UPI Ref No 412345678901"'
   ```

   Keep the single quotes around the whole command; without them, `adb`
   splits the title into separate words. Notifications with the same UPI
   reference are recognised as duplicates, so change the number (and the
   tag) to test again.

3. A "Payment detected" prompt appears; it opens the review list, where
   you confirm or dismiss the payment.

If detection stops working after reinstalling the app (an overloaded
emulator sometimes drops the listener during an update), turn the app's
notification access off and on again, or run:

```bash
C=com.anonymous.FinanceTracker/expo.modules.upinotifications.UpiNotificationListenerService
adb shell cmd notification disallow_listener $C && adb shell cmd notification allow_listener $C
```

## Notes for later milestones

- **iOS builds for TestFlight or the App Store:** use Expo's cloud service,
  EAS Build (`npx eas-cli@latest build`), which does not need Xcode. It
  requires an Apple Developer account ($99 per year).
- **Native folders:** `android/` and `ios/` are generated by Expo when
  needed and are git-ignored. Configure native behaviour in `app.json`
  instead of editing them by hand.
