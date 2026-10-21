# Mobile app progress

Where the Android (then iPhone) app stands. How to run and release it is in [`mobile/README.md`](../../mobile/README.md); the server side is the root README's **Mobile app API** section.

**Status (2026-10-21):** phases 0–3 are built on branch `mobile-app` and tested in an Android emulator. Not merged into `master`, not pushed. Phases 4–5 (store releases) are scaffolded but need accounts only the owner can create.

| Phase | Scope | State |
|---|---|---|
| 0 · Server groundwork | `/api/v1`, email-code sign-in, bearer tokens, push, WebView handoff, `@bbc/shared` | Done (`7064b85`) |
| 1 · Attendee app | Events, booking, receipt upload, offline ticket wallet, profile, push | Done (`142b90f`, `748dc0b`) |
| 2 · Door crew | Native scanner: camera, type code, guest list, offline queue, undo | Done (`748dc0b`) |
| 3 · Organiser tools | Web admin in a WebView, signed in by one-time token | Done (`748dc0b`) |
| 4 · Android release | `eas.json`, icons, splash, privacy page | Scaffolded; needs Expo, Firebase and Play accounts |
| 5 · iPhone release | Bundle id, review account (`REVIEW_ACCOUNT_EMAIL`/`REVIEW_OTP`) | Scaffolded; needs an Apple Developer account |

## Decisions

Made with the owner when planning:

- **Who it's for:** everyone. Attendees and door crew get native screens; organisers get the existing web admin inside the app (rebuilding it natively would have more than doubled the work).
- **Expo / React Native**, in the same repo as a pnpm workspace (`mobile/`, `packages/shared`).
- **Sign-in by 6-digit email code** in the app (mail apps open magic links in the browser, not the app). The web keeps magic links; the accounts are the same.
- **v1 features:** push notifications, offline tickets, native camera scanning.

## How it was checked

- Web: `pnpm typecheck`, `pnpm lint`, `pnpm build` clean; `pnpm smoke:api` (48 checks over HTTP) passes repeatedly; `smoke:tokens`, `smoke:scan`, `smoke:tickets` pass; `e2e:scanner` 22/22 against `next start`, signed in by email code.
- App: `tsc`, `expo lint`, `expo-doctor` (20/20) clean; an Android Hermes bundle builds with `expo export`.
- Offline signature check: `nobleVerifier` accepted all 46 local tickets, agreed with Web Crypto on every one, and refused every tampered token. The scanner's decision logic passed 30 Node checks against real tickets (forged, wrong event, not in list, duplicates).
- On an Android 10 emulator, driven by hand:
  - email-code sign-in;
  - the wallet and ticket QR (decoded from screenshots), online and with the API blocked;
  - sign-out removing saved tickets;
  - door check-in by code reaching the server, the duplicate warning, and two-tap undo;
  - the camera permission prompt on a fresh install;
  - the organiser handoff into `/admin`, and its scanner link opening the native door screen;
  - booking, receipt upload and cancelling;
  - a cold-start link to a booking getting a working Back.

## Bugs fixed along the way

- **Half of all tickets would have failed the offline check.** noble's `p256.verify` accepts only low-S signatures by default; Web Crypto signs with either. 27 of 46 local tickets were high-S. The verifier passes `lowS: false`.
- **The scanner could never use the camera.** `cameraPermission: false` on `expo-image-picker` removed `CAMERA` from the whole app. Removed.
- **Receipt uploads failed as "No connection".** Since SDK 52 Expo replaces the global `fetch`, and it rejects React Native's `{ uri, name, type }` FormData parts. Receipts are attached as an `expo-file-system` `File`. In development, `api()` now logs the real error.
- **Email-code sign-in refused requests with no Origin** when the HTTP stack adds `Sec-Fetch-*` headers. The app sends `Origin: bbcems://`, which the server trusts.
- **`/app/handoff` redirected to `localhost`**, which inside an emulator or a phone on the LAN is the device itself. Redirects are relative.
- **Screens opened from a notification or link had no Back.** The tabs are the stack anchor (`unstable_settings.anchor`).
- **The keyboard covered the scanner's Undo button.** The code box blurs itself on submit.
- **The dev server blocked `/_next` assets for the emulator.** `allowedDevOrigins: ["10.0.2.2"]`.
- "Tonight" labelled morning events; the book screen now shows the hold length and whether payment details exist (new `holdHours` and `hasPaymentDetails` on the event response).
- Duplicate copies of `expo` under pnpm's isolated layout: the workspace installs hoisted now. `mobile/` is kept out of Vercel function traces.

## Known gaps

- **Not tested without a phone or accounts:** push delivery (needs an EAS project and a physical phone), scanning a real QR through the camera, and the organiser tools' styling (the emulator's WebView 74 is too old for Tailwind v4; phones update their WebView through Google Play).
- **Role changes take up to 5 minutes** to reach a signed-in app, the same as the website (better-auth's session cookie cache; React Native keeps cookies).
- **Queued scans sync only while door mode is open**, as on the web. The Door tab shows how many are waiting.
- **No add-to-calendar or Google/Apple Wallet passes** in the app yet; tickets are shared as images.
- **Release builds** may warn about Expo enums and R8 (seen in the debug log for `expo-haptics` and `expo-sqlite`). A release build should be tried on a phone before the first store upload.
- **Vercel installs the whole workspace**, including Expo, because hoisted installs ignore `--filter`. Deploys are slower but unaffected.

## Before the first store release

1. Confirm the package/bundle id `ph.baguiobasecamp.app` (it can't change after publishing).
2. Put the production URL in `mobile/eas.json` (now a placeholder).
3. Review the draft privacy page at `/privacy` and add a contact address.
4. Apply migrations `0001_staff_role` and `0002_push` to production, then deploy the site.
5. Expo account and `eas init` (turns push on), Firebase `google-services.json` and FCM key, Google Play Console ($25; new personal accounts need 12 testers opted in for 14 days before production).
6. Later, for iPhone: Apple Developer Program ($99/year), TestFlight, and the review account.

## Test data in the local database

Added during this work, local only:

- User `api.smoke@example.com` (created by `pnpm smoke:api`; each run books and cancels a ticket on ZZ Test: Tonight at Base Camp).
- A cancelled booking `8mvVDkmMIBtr` for `door.p4@example.com` and its receipt at `public/uploads/payments/UEMVNcnve7M5.jpg` (gitignored).
- Ticket `BBC-5EVP-P74E` was checked in and undone several times while testing; it ends as unused.

`pnpm smoke:flow` currently fails on local data only: Early Bird on Base Camp Sessions Vol. 3 is down to one seat from earlier runs.
