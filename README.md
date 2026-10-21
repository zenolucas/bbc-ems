# Baguio Base Camp · Event Management System

Events, gigs and paperless QR tickets for the Baguio Base Camp community.

- Admins create events with ticket tiers (free or paid) and publish them.
- Members sign in with an email magic link, book tickets, and pay via GCash/Maya proof-of-payment.
- Tickets are ECDSA-signed QR codes in one of five brand styles, delivered in-app and by email.
- Door staff scan with their phone. The scanner works offline and syncs when signal returns.
- Organisers give volunteers **door crew** access from `/admin/team`: scanner and check-in only, no emails, payments or event editing.
- The organiser area has a dashboard, a review queue (`/admin/review`, keys J/K/A/R/Z), an attendees index and ⌘K search across events, bookings and people.
- An Android app (iPhone later) in [`mobile/`](mobile/README.md) covers booking, offline tickets, push notifications, a native door scanner and the organiser tools. Status: [`docs/mobile/PROGRESS.md`](docs/mobile/PROGRESS.md).

## Design

The UI follows the "Alpine Day / Starlit Night" system: light mode is a pine morning, dark mode a starlit ridge. Tokens, components and the page-by-page spec live in [`docs/revamp/README.md`](docs/revamp/README.md); the mockups are in `docs/revamp/mockups/`. What has been built, and what is still open, is in [`docs/revamp/PROGRESS.md`](docs/revamp/PROGRESS.md).

Email header art is PNG (Gmail and Outlook drop inline SVG), built from `src/emails/art.ts`. After changing it, run `pnpm exec tsx src/emails/build-assets.ts` and commit `public/brand/email/`.

## Stack

Next.js 16 (App Router) · Tailwind v4 + shadcn/ui · Drizzle ORM + Postgres (Neon in prod) · Better Auth (magic link on the web, email code + bearer token in the app) · Resend · Vercel Blob · resvg + bwip-js for ticket PNGs · @zxing/browser for camera scanning · Expo SDK 58 for the app.

A pnpm workspace: the site at the root, the app in `mobile/`, shared code in `packages/shared` (`@bbc/shared`). Installs are hoisted (`nodeLinker: hoisted` in `pnpm-workspace.yaml`) because Expo needs a single copy of each `expo-*` package.

## Local development

```bash
pnpm install
docker run -d --name bbc-ems-db -e POSTGRES_USER=bbc -e POSTGRES_PASSWORD=bbc -e POSTGRES_DB=bbc_ems -p 54330:5432 postgres:17-alpine
cp .env.example .env.local      # then fill in values, see below
pnpm db:migrate
pnpm db:seed                    # three sample events
pnpm dev                        # http://localhost:3100
```

Without `RESEND_API_KEY`, emails (including the magic link and the app's sign-in code) are printed to the dev server console. To run the app against this server, see [`mobile/README.md`](mobile/README.md). Without `BLOB_READ_WRITE_TOKEN`, uploads land in `public/uploads/`.

### Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` | Public site URL (used in magic links, ticket QR URLs, emails) |
| `ADMIN_EMAILS` | Comma-separated emails that become admins on first sign-in. Promote or invite anyone else from `/admin/team`. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email delivery |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob for posters, GCash QR images and payment receipts |
| `CRON_SECRET` | Protects `/api/cron/expire-bookings` |
| `TICKET_SIGNING_PRIVATE_KEY`, `TICKET_SIGNING_PUBLIC_KEY` | ECDSA P-256 JWKs, base64url-encoded. Generate once and never rotate casually: old tickets stop verifying. |
| `EXPO_ACCESS_TOKEN` | Optional. Expo push access token, if "enhanced push security" is on for the Expo project |
| `REVIEW_ACCOUNT_EMAIL`, `REVIEW_OTP` | Optional. One app-store review account that signs in with a fixed 6-digit code and is never emailed. Leave empty except while an app is in review. |

Generate signing keys:

```bash
node -e '
const { generateKeyPairSync } = require("crypto");
const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
console.log("TICKET_SIGNING_PRIVATE_KEY=" + b64(privateKey.export({ format: "jwk" })));
console.log("TICKET_SIGNING_PUBLIC_KEY=" + b64(publicKey.export({ format: "jwk" })));'
```

## Scripts

| Command | What it does |
|---|---|
| `pnpm db:generate` / `pnpm db:migrate` | Drizzle migrations |
| `pnpm db:seed` | Sample events |
| `pnpm smoke:flow` | Books, pays, approves, rejects and expires bookings against the local DB |
| `pnpm smoke:tokens` | Sign/verify round trip for ticket tokens |
| `pnpm smoke:scan <png…>` | Decodes ticket PNGs to confirm they scan |
| `pnpm smoke:tickets` | Renders all ten ticket variants to `.smoke/tickets/` and decodes them the way the door scanner does (no inversion). Run after any change to the ticket renderers. |
| `pnpm smoke:api` | The mobile app's API over HTTP: email-code sign-in, bearer tokens, the `/api/v1` booking flow, receipt upload, tickets, push tokens, door access, the WebView handoff. Run the dev server with `RESEND_API_KEY=` (codes print to its log) and pass the log: `DEV_LOG=dev.log pnpm smoke:api`. |
| `pnpm e2e:scanner <cookies.txt or magic-link URL> <eventId>` | Drives the scanner in Chromium against the dev server (or `E2E_BASE`): online, duplicates, offline queue, resync, conflicts, cached reload. Picks unused tickets from the DB. Offline reload only works against a production build (`next start`). |

## How ticketing works

- Token: `v1.<ticketId>.<eventId>.<signature>`, encoded as `https://<site>/t/<token>` so any camera app opens a public status page that never checks anyone in.
- Signature: ECDSA P-256 over `ticketId|eventId`. The scanner verifies it locally with the public key from the event manifest, so forged QR codes are rejected even offline.
- Short code (`BBC-XXXX-XXXX`, Crockford base32) is printed on every ticket for manual entry.
- Styles: Summit, Night Sky, Trail Pass, Ridge Line, Campfire Stamp. Compare them at `/admin/ticket-lab`; set the default per event in the event form.
- Check-in: `/admin/scan/<eventId>` (admins and door crew) downloads the ticket list to IndexedDB, verifies and marks tickets locally, queues check-ins, and POSTs them to `/api/scan/sync` when online. First scan wins; conflicts surface as "already scanned on another device". Scans the door turned away are logged but never mark a ticket used on sync.

## Mobile app API

The Expo app (Android first, then iOS) uses the same accounts and data as the site:

- Sign-in is a 6-digit email code (better-auth `emailOTP`), since mail apps open magic links in the browser. The sign-in response carries a `set-auth-token` header; the app sends it back as `Authorization: Bearer <token>`, and sends `Origin: bbcems://` (trusted in `src/lib/auth.ts`).
- `/api/v1/*` is JSON for the member flows (events, bookings, payment, tickets, profile, push tokens) and door crew (`scan/events`, `scan/undo`). The routes are thin: booking side effects live in `src/lib/flows/bookings.ts`, which the web's Server Actions call too. Response types are in `packages/shared/src/api-types.ts`.
- The existing `/api/scan/*`, `/api/upload` and `/api/tickets/[id]/png` accept the bearer token as well.
- Organiser tools open the web admin in a WebView: the app fetches a one-time token (`/api/auth/one-time-token/generate`) and loads `/app/handoff?ott=…`, which swaps it for the session cookie. A `BBCApp/` user agent hides the account menu and theme toggle.
- Push notifications go out next to the booking emails (`src/lib/notifications.tsx`), plus reminders from the 15-minute cron (hold ending in two hours, event within a day).
- `packages/shared` (`@bbc/shared`) holds the React-free code both apps use: ticket tokens, short codes, request schemas, API types.

## Deploying to Vercel

1. `npm i -g vercel && vercel link`
2. Provision Neon Postgres, Resend and Blob from the Vercel Marketplace (`vercel integration add …`) or paste existing credentials with `vercel env add`.
3. Add the remaining env vars above (`vercel env add`), then `vercel env pull .env.local`.
4. Run migrations against the production database: `DATABASE_URL=… pnpm db:migrate`. (`0001_staff_role` and `0002_push` must be applied before deploying code that uses them.)
5. `vercel deploy --prod`. The cron in `vercel.json` expires unpaid holds every 15 minutes. If a deploy looks half-styled (new colours or utilities missing), redeploy without the build cache: Turbopack has reused a stale stylesheet from `.next/cache/turbopack` after a branch switch. Locally, `rm -rf .next/cache/turbopack` before `pnpm build`.
6. Verify the Resend sending domain so magic links do not land in spam.

Camera access requires HTTPS, so test the scanner on a preview or production URL, not plain http.
