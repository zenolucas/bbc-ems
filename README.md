# Baguio Base Camp · Event Management System

Events, gigs and paperless QR tickets for the Baguio Base Camp community.

- Admins create events with ticket tiers (free or paid) and publish them.
- Members sign in with an email magic link, book tickets, and pay via GCash/Maya proof-of-payment.
- Tickets are ECDSA-signed QR codes in one of five brand styles, delivered in-app and by email.
- Door staff scan with their phone. The scanner works offline and syncs when signal returns.

## Stack

Next.js 16 (App Router) · Tailwind v4 + shadcn/ui · Drizzle ORM + Postgres (Neon in prod) · Better Auth (magic link) · Resend · Vercel Blob · resvg + bwip-js for ticket PNGs · @zxing/browser for camera scanning.

## Local development

```bash
pnpm install
docker run -d --name bbc-ems-db -e POSTGRES_USER=bbc -e POSTGRES_PASSWORD=bbc -e POSTGRES_DB=bbc_ems -p 54330:5432 postgres:17-alpine
cp .env.example .env.local      # then fill in values, see below
pnpm db:migrate
pnpm db:seed                    # three sample events
pnpm dev                        # http://localhost:3100
```

Without `RESEND_API_KEY`, emails (including the magic link) are printed to the dev server console. Without `BLOB_READ_WRITE_TOKEN`, uploads land in `public/uploads/`.

### Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` | Public site URL (used in magic links, ticket QR URLs, emails) |
| `ADMIN_EMAILS` | Comma-separated emails that become admins on first sign-in |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email delivery |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob for posters, GCash QR images and payment receipts |
| `CRON_SECRET` | Protects `/api/cron/expire-bookings` |
| `TICKET_SIGNING_PRIVATE_KEY`, `TICKET_SIGNING_PUBLIC_KEY` | ECDSA P-256 JWKs, base64url-encoded. Generate once and never rotate casually: old tickets stop verifying. |

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
| `pnpm e2e:scanner <cookies.txt> <eventId> <code1> <code2>` | Drives the scanner page in Chromium: online, offline queue, resync, cached reload |

## How ticketing works

- Token: `v1.<ticketId>.<eventId>.<signature>`, encoded as `https://<site>/t/<token>` so any camera app opens a public status page that never checks anyone in.
- Signature: ECDSA P-256 over `ticketId|eventId`. The scanner verifies it locally with the public key from the event manifest, so forged QR codes are rejected even offline.
- Short code (`BBC-XXXX-XXXX`, Crockford base32) is printed on every ticket for manual entry.
- Styles: Summit, Night Sky, Trail Pass, Ridge Line, Campfire Stamp. Compare them at `/admin/ticket-lab`; set the default per event in the event form.
- Check-in: `/admin/scan/<eventId>` downloads the ticket list to IndexedDB, verifies and marks tickets locally, queues check-ins, and POSTs them to `/api/scan/sync` when online. First scan wins; conflicts surface as "already scanned on another device".

## Deploying to Vercel

1. `npm i -g vercel && vercel link`
2. Provision Neon Postgres, Resend and Blob from the Vercel Marketplace (`vercel integration add …`) or paste existing credentials with `vercel env add`.
3. Add the remaining env vars above (`vercel env add`), then `vercel env pull .env.local`.
4. Run migrations against the production database: `DATABASE_URL=… pnpm db:migrate`.
5. `vercel deploy --prod`. The cron in `vercel.json` expires unpaid holds every 15 minutes.
6. Verify the Resend sending domain so magic links do not land in spam.

Camera access requires HTTPS, so test the scanner on a preview or production URL, not plain http.
