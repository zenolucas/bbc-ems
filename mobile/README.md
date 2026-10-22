# Baguio Base Camp app

The Android (and later iPhone) app for Baguio Base Camp: browse and book events, pay by GCash/Maya receipt, keep tickets on the phone for offline use, get booking notifications, scan tickets at the door, and open the organiser tools.

Expo SDK 58 (React Native 0.88, React 19.3), expo-router, React Query. It talks to the Next app in the repo root; see the root README's **Mobile app API** section for the server side.

## Local development

1. Start the database and the site with email printed to the console instead of sent:
   ```sh
   docker start bbc-ems-db
   RESEND_API_KEY= pnpm dev          # repo root, port 3100
   ```
2. Build and launch the development client on an emulator or a USB phone (needs the Android SDK and JDK 17):
   ```sh
   pnpm --filter mobile android
   ```
   The emulator reaches your computer's `localhost` as `10.0.2.2`, which is the default `EXPO_PUBLIC_API_URL`. For a real phone on the same Wi-Fi, set `EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:3100`.
3. Sign in with any email; the 6-digit code appears in the dev server's output (`[email:dev] subject: 123456 is your Baguio Base Camp code`).

Against a local demo server (root README, "Demo deployment") the app shows a yellow demo strip and one-tap personas on sign-in and Profile, so no codes are needed. `APP_VARIANT=demo` (the `demo` EAS profile) builds "BBC Demo" with its own package id, alongside the real app.

Push notifications need a physical phone and an EAS project (see Release); emulators and Expo Go don't get push tokens. The scanner camera works best on a real phone.

Checks: `pnpm --filter mobile typecheck`, `pnpm --filter mobile lint`, `pnpm --filter mobile doctor`, and `CI=1 npx expo export --platform android` (from `mobile/`) to confirm the bundle builds.

### Things that cost time once

- **Metro misses edits in this monorepo** without [Watchman](https://facebook.github.io/watchman/): the phone keeps running old code, even after a reload. Install Watchman, or restart `expo start` after editing. A debug build also caches its last bundle in `files/BridgelessReactNativeDevBundle.js`; force-stopping the app makes it fetch again.
- **Expo's `fetch` replaces React Native's** (SDK 52+). It rejects React Native's `{ uri, name, type }` FormData parts, and `api()` reports that as "No connection". Attach files as an `expo-file-system` `File` (see `src/app/bookings/[id]/pay.tsx`).
- **The emulator's WebView can be too old for the site.** Android 10 images ship WebView 74; Tailwind v4 needs Chrome 111+, so the organiser tools render unstyled there. Phones update their WebView through Google Play. Use an Android 14+ system image to see it styled.
- **The dev server must allow the emulator's host** for the organiser WebView: `allowedDevOrigins: ["10.0.2.2"]` in the root `next.config.ts` (already set). A phone on the LAN needs its host added the same way.
- **Role changes take up to 5 minutes** to reach a signed-in app, like the website: React Native keeps cookies, so better-auth's 5-minute session cache applies.
- `adb shell input text` types as a hardware keyboard, which leaves Android's touch mode; on-screen keyboard behaviour (like the scanner dropping the keyboard after a check-in) is only reliable when tested by hand.

## Layout

- `src/app/` routes (expo-router): `(tabs)/` Events, Tickets, Door (door crew), Profile; `sign-in`, `organiser` (web admin in a WebView), event, booking and ticket screens, `door/[eventId]`.
- `src/lib/` API client, session, push, offline caches, ticket signature check (`verify.ts`).
- `src/components/`, `src/theme/` UI kit and the Alpine Day / Starlit Night palette (from `@bbc/shared/theme`).
- `../packages/shared` code shared with the website: ticket tokens, short codes, request schemas, API types, formatting.
- `scripts/generate-assets.mjs` rebuilds the icons and splash image from `public/brand/bbc-logo.png`.

How it signs in: a 6-digit email code returns a session token that the app sends as `Authorization: Bearer`, with `Origin: bbcems://`. Organiser tools trade a one-time token for a web session cookie at `/app/handoff`.

## Release

Before the first public build, the production database needs migrations `0001_staff_role` and `0002_push` (`DATABASE_URL=… pnpm db:migrate` from the repo root), and the production site must be deployed with the mobile API.

Set the production URL in `eas.json` (`EXPO_PUBLIC_API_URL` in the `preview` and `production` profiles; currently a placeholder).

### Android

1. Create an Expo account, then from `mobile/`: `npx eas-cli@latest login` and `npx eas-cli@latest init`. This writes the EAS `projectId` into `app.json`; push notifications stay off until it exists.
2. Confirm the package name in `app.json` (`ph.baguiobasecamp.app`). It can never change once the app is on Google Play.
3. Push: create a Firebase project, add an Android app with the same package name, download `google-services.json` into `mobile/`, and set `"googleServicesFile": "./google-services.json"` under `android` in `app.json`. Upload an FCM V1 service-account key with `npx eas-cli@latest credentials`.
4. Google Play Console: one-time $25. New personal accounts must run a **closed test with at least 12 testers opted in for 14 days in a row** before they can publish to production, so recruit testers early. (Organisation accounts, which need a D-U-N-S number, skip this.)
5. Test build: `npx eas-cli@latest build -p android --profile preview` gives an installable APK for testers.
6. Store build and upload: `npx eas-cli@latest build -p android --profile production`, then `npx eas-cli@latest submit -p android` (goes to the internal testing track; promote to closed, then production, in the Play Console).
7. The listing needs the privacy policy URL (`https://<site>/privacy`), the data-safety form (email, name, photos you upload, device ID and push token, no ads or tracking), screenshots and a feature graphic.

### iPhone

1. Apple Developer Program: $99 a year. EAS builds in the cloud, so no Mac is needed.
2. `npx eas-cli@latest build -p ios --profile production` (EAS creates the certificates and an APNs key for push), then `npx eas-cli@latest submit -p ios` to TestFlight.
3. App Review can't read our email: set `REVIEW_ACCOUNT_EMAIL` and `REVIEW_OTP` on the production site while the app is in review, give the reviewers that email and code, and explain in the review notes that organiser tools are web pages for staff.
