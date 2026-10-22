# Baguio Base Camp · Event Management System

Events, gigs and paperless QR tickets for the Baguio Base Camp community.

- Admins create events with ticket tiers (free or paid) and publish them.
- Members sign in with an email magic link, book tickets, and pay via GCash/Maya proof-of-payment.
- Tickets are ECDSA-signed QR codes in one of five brand styles, delivered in-app and by email.
- Door staff scan with their phone. The scanner works offline and syncs when signal returns.
- Organisers give volunteers **door crew** access from `/admin/team`: scanner and check-in only, no emails, payments or event editing.
- The organiser area has a dashboard, a review queue (`/admin/review`, keys J/K/A/R/Z), an attendees index and ⌘K search across events, bookings and people.
- Events have a category (gig, outdoors, other) for the home page filters (All / Gigs / Outdoors / Free). Sold-out events offer a waitlist: everyone waiting is emailed and pushed at once when seats free up (checked every 15 minutes by the cron, and straight after a member cancels).
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
| `DISCORD_ENABLED` | Feature flag for the whole Discord integration: `1` turns it on. Off by default; with it off the other `DISCORD_*` variables are ignored. |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | Optional. Discord application for "Continue with Discord" and account linking. See [Discord](#discord). |
| `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID` | Optional. The bot that posts events and manages roles, and the server it works in. |
| `DISCORD_INVITE_URL` | Optional. Public invite link shown on the site ("Join our Discord"). |
| `DEMO_MODE` | Demo deployment only (`1`). Never set it on production; see [Demo deployment](#demo-deployment). |

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
| `pnpm demo:seed --init --yes` / `--reset` / `switch on\|off` | Marks an empty database as the demo one and seeds it, wipes it back to the demo story, or flips the demo switch. Reads `.env.local`, then `.env.demo` over it. |
| `pnpm smoke:demo` | Demo mode over HTTP against a demo server: personas, sample receipts, auto-approve, expire hold + cron + waitlist, scan samples, the outbox, reset and the switch. `--expect-off` against any other server checks every demo route is shut. |
| `pnpm smoke:discord` | Discord announcements, scheduled events, roles, chats, reminders and archiving against a fake Discord and the local DB; cleans up after itself. `--serve` runs only the fake. |
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
- Organisers review receipts natively: `GET /api/v1/admin/review`, `POST /api/v1/admin/bookings/[id]/approve|reject`. Approve and reject go through `src/lib/flows/admin-bookings.ts`, which the web's Server Actions call too. Approving an approved booking does nothing (no second email); "Resend tickets" is for that.
- Waitlist: `POST`/`DELETE /api/v1/events/[slug]/waitlist`; the logic is in `src/lib/waitlist.ts`.
- Organiser tools open the web admin in a WebView: the app fetches a one-time token (`/api/auth/one-time-token/generate`) and loads `/app/handoff?ott=…`, which swaps it for the session cookie. A `BBCApp/` user agent hides the account menu and theme toggle.
- Push notifications go out next to the booking emails (`src/lib/notifications.tsx`), plus reminders from the 15-minute cron (hold ending in two hours, event within a day).
- `packages/shared` (`@bbc/shared`) holds the React-free code both apps use: ticket tokens, short codes, request schemas, API types.

## Demo deployment

A separate deployment for testing end to end and showing the app off, without sign-in emails, real payments or a second phone at the door. On it:

- **One-tap personas**: Mara Santos (member), Jun Reyes (door crew) and Bea Cruz (organiser), on `/login`, in the yellow demo strip at the top of every page, and in the app's sign-in and Profile. No email, no name step; switching ends the previous session.
- **Sample receipts**: "Use a sample receipt" on the payment step (web and app). **Auto-approve** (off by default, so the review queue can be shown) confirms bookings the moment the receipt is sent.
- **Time**: "Expire hold now" on unpaid bookings, and "Run cron" (expire holds, reminders, waitlists) on `/admin/demo`.
- **Door**: a "scan a sample" panel on the scanner (valid, already in, another event, edited QR, unknown code) and, in the app, "Pretend there's no signal" to show check-ins queueing and syncing.
- **Outbox**: every email and push lands on `/admin/demo` instead of an inbox (`@demo.invalid` addresses can't receive mail anyway).
- **Reset**: `/admin/demo` puts the data back to the starting story: an event happening now, a paid gig with three receipts to review, a free hike, a sold-out show with a waitlist and a hold about to lapse, a draft and a past event.

Three locks keep this off production; all must be open:

1. `DEMO_MODE=1` on the deployment.
2. The database carries a demo marker, written only by `pnpm demo:seed --init`, which refuses any database with accounts outside `@demo.invalid` or any booking. `DEMO_MODE` pointed at the production database does nothing.
3. The switch on `/admin/demo` (live, no redeploy). With it off the site behaves like the real one, still emailing only to the outbox.

Anyone who opens the demo site can become the organiser, so keep nothing real on it, give it its own keys and storage, and turn on Vercel Deployment Protection if it shouldn't be public.

Set it up:

1. A second Vercel project from this repo, with its own Neon database and Blob store, and its own ticket signing keys. No `RESEND_API_KEY` (everything goes to the outbox). `DEMO_MODE=1`, and the other variables as usual. The 15-minute cron in `vercel.json` needs a Pro plan; on Hobby, override it for this project.
2. `DATABASE_URL=<demo db> pnpm db:migrate`, then `DATABASE_URL=<demo db> DEMO_MODE=1 pnpm demo:seed --init --yes`.
3. Seeding from your laptop signs the tickets with your local key. If it differs from the deployment's, `/admin/demo` says so: press Reset there once to re-sign them with the deployment's key.
4. If the switch gets turned off and nobody is signed in as Bea any more: `pnpm demo:seed switch on` against the demo database.
5. App: set `EXPO_PUBLIC_API_URL` in `mobile/eas.json`'s `demo` profile and `npx eas-cli@latest build -p android --profile demo`. It installs as "BBC Demo" next to the real app.

Locally: create a second database (`docker exec bbc-ems-db psql -U bbc -d bbc_ems -c "create database bbc_ems_demo"`), put `DEMO_MODE=1` and its `DATABASE_URL` in `.env.demo`, migrate and `pnpm demo:seed --init --yes`, then run the site with `set -a; . ./.env.demo; set +a; pnpm dev`.

## Discord

Baguio Base Camp started as a Discord server, so the site can work with it. It ships **switched off**: nothing below happens, and `/admin/discord` doesn't exist, until `DISCORD_ENABLED=1` is set on the deployment. Everything is optional even then; email and push stay the main channel.

- **Announcements**: publishing an event posts it to the events channel (poster, date in each viewer's time zone, venue, price, spots left, Get tickets and Map buttons) and creates a native Discord event people can mark Interested. The post is edited in place as seats sell, when it sells out, starts, ends or is cancelled, and deleted if the event is unpublished. A "tomorrow" reminder goes out the day before for events with seats.
- **Sign in / link**: "Continue with Discord" on `/login` and "Link Discord" on `/me/profile` (the app opens the website for it). Linking adds the member to the server. A Discord account whose email isn't verified can't create an account.
- **Roles**: Organisers and door crew get their server roles from `/admin/team`; anyone with a confirmed booking gets Campers; each event gets a ticket holders' role, deleted three days after it ends. Roles the site didn't hand out are never touched, and unlinking takes back the ones it did.
- **Ticket holders' chat** (per event, a switch on the event's page): a private channel for that event's role and the crew, moved to an archive category after the event.

How it runs: plain REST calls as the bot (no gateway process), after the response so nothing waits on Discord, never failing a booking. The 15-minute cron catches up on anything that failed, updates seat counts, starts and ends the Discord events, posts reminders and archives old events. What was created for each event is in `discord_event_sync`; the channel and role picks are in `app_settings` (key `discord`), set on `/admin/discord`.

Set it up:

1. In the [Discord Developer Portal](https://discord.com/developers/applications), on your application, add the OAuth2 redirect `<NEXT_PUBLIC_APP_URL>/api/auth/callback/discord` (one per deployment, including `http://localhost:3100/...`).
2. Set `DISCORD_ENABLED=1`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID` and `DISCORD_INVITE_URL`. Use a private test server for local and demo sites; on the demo site, posts also land in the outbox.
3. Invite the bot with the link on `/admin/discord` (it asks for exactly the permissions used), then in Server Settings → Roles drag the bot's role above every role it should hand out.
4. On `/admin/discord`, pick the events channel, roles and chat categories, send a test post, and press Resync to announce the upcoming events.

`pnpm smoke:discord` runs the whole flow against a fake Discord and the local database (no token needed); `pnpm smoke:discord --serve` starts only the fake, on :3199, to click through the UI with `DISCORD_ENABLED=1 DISCORD_API_BASE=http://127.0.0.1:3199`.

## Deploying to Vercel

1. `npm i -g vercel && vercel link`
2. Provision Neon Postgres, Resend and Blob from the Vercel Marketplace (`vercel integration add …`) or paste existing credentials with `vercel env add`.
3. Add the remaining env vars above (`vercel env add`), then `vercel env pull .env.local`.
4. Run migrations against the production database: `DATABASE_URL=… pnpm db:migrate`. (`0001_staff_role`, `0002_push`, `0003_categories_waitlist` and `0004_demo_mode` must be applied before deploying code that uses them.)
5. `vercel deploy --prod`. The cron in `vercel.json` expires unpaid holds every 15 minutes. If a deploy looks half-styled (new colours or utilities missing), redeploy without the build cache: Turbopack has reused a stale stylesheet from `.next/cache/turbopack` after a branch switch. Locally, `rm -rf .next/cache/turbopack` before `pnpm build`.
6. Verify the Resend sending domain so magic links do not land in spam.

Camera access requires HTTPS, so test the scanner on a preview or production URL, not plain http.
