# Revamp progress

Where the Alpine Day / Starlit Night revamp stands. The plan and page specs are in [`README.md`](./README.md); this file records what was actually built, where it differs from the spec, and what is still open.

**Status (2026-10-21):** all six phases are built and merged into `master` (`05d5dfb`). Nothing in the spec is left unbuilt; the gaps below are deliberate and each has a reason.

| Phase | Scope | State |
|---|---|---|
| 1 · Foundations | Tokens, fonts, Skyline, Stamp, motion, re-themed primitives, ticket colours | Done (`32d7d25`) |
| 2 · Public pages | Home, event cards, event page, sign-in, nav/footer, 404/error, about | Done |
| 3 · Booking and tickets | Book form, booking states, ticket wallet, My tickets, `/t/` verify page | Done |
| 4 · Organiser | Admin shell, dashboard, events, overview, review queue, attendees, event form, team, ticket lab | Done |
| 5 · Door crew | Scanner index, door mode, result floods, type code, guest list | Done |
| 6 · Comms | All emails, OG image | Done |

Phases 2–6 landed in `a17427f`; a scanner data-loss fix found along the way is its own commit, `3c8a988`.

## How it was checked

- `pnpm typecheck`, `pnpm lint` and `pnpm build`: clean.
- `pnpm smoke:tickets`: 10/10 ticket variants render and decode.
- `pnpm e2e:scanner` against a production build (`next start`): all 22 checks pass, twice in a row, including the offline-reload checks that only work outside `next dev`.
- Every page screenshotted at 390 and 1280 wide, light and dark, signed out, as a member, as an admin and as door crew: no console or hydration errors, no horizontal scroll at 390. Interaction states were driven in a real browser: booking, receipt upload, cancel, wallet swipe (drag, arrows, links), ⌘K search, review-queue keys, attendee search, every scanner result flood, undo, offline banner.
- Emails rendered (not sent) at 600 and 390 wide, with images on and blocked.

## What was built

### Phase 2 · Public pages
- **Home** (`src/app/(public)/page.tsx`): skyline hero (deep-forest copy by day, white by night); "Up next" card with a `relative()` chip, riding the ridge at the hero's right on desktop; "Coming up" as a staggered grid (compact rows on phones); "Past events" as a 75%-opacity rail; illustrated empty state.
- **Event cards** (`src/components/event/event-card.tsx`): stub notches, date tab, availability chips, SOLD OUT stamp over a dimmed poster, struck-through cancelled, perforated price footer, hover lift. New exports `EventRow`, `PastEventCard`, `UpNextCard` and friends; `priceSummary` kept (the OG image uses it).
- **Event page**: phone poster hero with scrim, glass back/share buttons, tier meters with "N left", sticky CTA; desktop two columns with a sticky ticket panel, your existing booking in a tinted panel, share card.
- **Sign-in**: skyline panel with the card overlapping it; desktop split; sent state with envelope, resend cooldown and "Open mail app" (for known webmail domains only). The magic-link call is unchanged.
- **Nav, footer, states**: pill nav, account menu with role badge, skyline footer strip, "We couldn't find that trail" 404 and an error view showing the digest.

### Phase 3 · Booking and tickets
- **Book form**: trail steps (Pick current), 44px round steppers, sticky summary whose CTA follows the selection.
- **Booking page**: trail steps per status as specced; hold countdown ring; GCash panel with copy buttons; receipt dropzone; rejected state with a live resubmit deadline; expired state with "Book again"; approved state with guest-name cards, "Add to calendar" (.ics) and "Send <name> their ticket".
- **Ticket wallet** (`src/components/ticket/ticket-wallet.tsx`): night stage with a lime glow, drag to swipe between a booking's tickets (plus arrow keys and links), dots and a "Swipe for …" hint, CHECKED IN stamp on used tickets, Save image / Copy code / Share.
- **My tickets**: "Your passes", attention banner, the "Tonight" pass for an approved event within 18 hours (live countdown, Show my QR), Coming up, Past collapsed. Fixed a 27px sideways scroll at 390.
- **`/t/` verify page**: full-height result with a 148px seal per outcome. Still a pure server component.
- Shared additions: `fmtLeft()` in `src/lib/format.ts`; `useCountdown`, `CountdownText` and `CountdownRing` in `src/components/ui/countdown.tsx` (the old `Countdown` is unchanged).

### Phase 4 · Organiser
- **Shell** (`src/components/admin/shell.tsx`, `sidebar.tsx`, `tab-bar.tsx`, `command-palette.tsx`): sidebar from 1024px with breadcrumb, ⌘K and New event; slim header plus bottom tabs (Home, Events, Review, Scanner, More) on phones. Door mode (`/admin/scan/[eventId]`) renders with no shell at all. Door crew only see the scanner, as before.
- **⌘K search** (`src/app/admin/search/route.ts`): read-only, admins only; finds events, bookings (name, email, booking ID, GCash ref) and people.
- **Dashboard**: greeting, "Needs attention" inbox, four stat tiles (the last with a 14-day sparkline from the new `ticketsPerDay()` in `src/lib/events.ts`), live events with meters, drafts, recent activity.
- **Events list**: Upcoming / Drafts / Past / All, search, table on desktop and stacked rows on phones.
- **Event overview and tabs**: poster header, tabs with counts, stat tiles, quick actions, status card with the danger zone, tiers with meters.
- **Review queue**: split view from 1024px, oldest receipt first, large receipt with zoom, hints (reused reference, repeat customer, booking ID to look for in the GCash note), keys J/K/A/R/Z (A still asks for confirmation), quick reject reasons. Phones get receipt-first cards. Same four server actions as before.
- **Attendees**: check-in-by-code bar, progress card, CSV, status pills, tier filter, search with highlights.
- **Event form** (`event-form.tsx`, new `event-preview.tsx`): outline nav with ticks, collapsible sections with summaries, tier stub cards, live card preview, publish checklist, sticky save bar with "Unsaved changes" and a leave warning.
- **New pages**: `/admin/review` opens the event with the oldest waiting receipt (or shows "Queue is clear"); `/admin/attendees` lists events by check-in progress.
- **Team and ticket lab** restyled; the ticket lab has a style switcher and day/night side by side.

### Phase 5 · Door crew
- **Scanner index**: always dark; live event card with a pulsing dot and meter, other events as rows, offline explainer, and what this phone has stored.
- **Door mode** (`src/components/scanner/*`): full-screen and always dark; stats strip, connection pill, Camera / Type code / Guest list, viewfinder with lime brackets and a scan line, torch. Result floods: Welcome in (lime), Already scanned (sun, with two-tap "Undo that check-in"), Invalid (red), Not in list yet (blue, "Refresh list and retry"). Auto-dismiss timings are unchanged.
- **Type code**: 60px mono input, progress row, "Check in · N more characters".
- **Guest list**: search with highlights, inline Cancel/Confirm on the row.
- `use-scanner.ts`, `feedback.ts`, the API routes and `lib/checkins.ts` keep their logic, apart from the queue fix below.

### Phase 6 · Comms
- **Emails** (`src/emails/*`): all seven (reserved, received, approved, rejected, booking cancelled, event cancelled, magic link) on a shared layout: skyline header strip, ticket stubs with a dashed edge, pill button, footer line. Plain-text versions kept.
- The header and QR tile are PNGs in `public/brand/email/`, built from the SVG source in `src/emails/art.ts`. After changing the art, run `pnpm exec tsx src/emails/build-assets.ts`.
- **OG image**: with a poster, a blurred backdrop, left scrim and the sharp poster on the right; without one, the skyline. Any failure loading the poster falls back to the skyline.

## Bugs fixed along the way

- **Scanner could lose check-ins** (`3c8a988`). The offline queue was read, then written back after an `await`. Two quick scans, or a scan during a sync, overwrote each other: the check-in never reached the server and "To sync" still showed 0. The same race hit the local "used" list and recent scans. Each is now one IndexedDB transaction.
- **Stale CSS in production builds.** After switching branches, `next build` reused the previous branch's stylesheet from `.next/cache/turbopack`: new tokens and utilities were missing in production only. Fix: `rm -rf .next/cache/turbopack` and rebuild. On Vercel, redeploy without the build cache if a deploy looks half-styled.
- Theme toggle hydration mismatch in dark mode (`aria-checked` now waits for hydration).
- Empty-state moon vanished when several empties shared a page (shared SVG mask id; now a plain path).
- Hero stars too large on desktop (radius now grows sub-linearly).
- Scanner index always showed 0 tickets (unqualified columns in a count subquery).
- Type-code formatter mangled codes typed key by key.
- Team invite input collapsed on phones.
- Native selects on Attendees and Team use 16px text on phones again so iOS doesn't zoom (kept from "Mobile polish" through the merge).

## Where it differs from the spec, and why

- **No filter pills on the home page.** Events have no category field.
- **No data the app doesn't store:** "142 came" on past cards, "Live since Oct 8", "N phones scanning", "1 of 2 on this booking", tier perk text on scan results, receipt amount "matches" in the review queue, "Still to send ₱200" on a rejected booking.
- **No Discord link or waitlist copy.** There's no Discord URL in the app; sold-out cards say "No tickets left".
- **The site header stays above the event poster on phones**, to keep the account menu and theme toggle.
- **The wallet stage is dark in light mode too** and always shows the night ticket render.
- **Rejected booking:** the GCash details stay as step 1 with the form as step 2, instead of merged.
- **Scanner "Invalid ticket" keeps its title** (not "Not a ticket"): the same result covers typos and a missing list, and the e2e expects it. Undo only appears online, once the check-in has synced, and takes two taps.
- **Scanner confirmations are inline**, not dialogs, because portals render in the site theme instead of dark.
- **Email header is a PNG, not inline SVG**, because Gmail strips SVG and Outlook doesn't draw it. Footer text is `#5b7060` instead of the mockup's `#9db58a` (2.2:1 fails contrast). Emails are light-only.
- **OG meta line is set in Bricolage**: Satori mis-measures some Geist words.
- **Event form:** the outline nav hides below 1280px; the preview and checklist move under the form below 1024px.

## Known issues and follow-ups

- **Toasts are light over dark door mode** (sonner follows the site theme).
- **Wallet page:** a small cream gap above the footer at 390. The landscape Trail Pass ticket is about 350px wide on phones, so its QR is small, as before.
- **"Edit event" shows on the edit tab itself:** layouts don't get the pathname.
- **Missing events return HTTP 200** with the 404 view, because `notFound()` fires after streaming starts. This predates the revamp.
- **Dashboard sparkline is flat in dev**: nearly all local tickets were created on the same day.
- **Some old seeded bookings point at receipt files that don't exist** (`/uploads/test.png`, `/uploads/x.png`), so the review page logs 404s for them.
- **Build warning** about dynamic filesystem access in `src/lib/tickets/render/server.ts`. The font loading there works the same way as before the revamp.
- **Email images use absolute URLs** from `NEXT_PUBLIC_APP_URL`, so production must set it to the public domain. If the art changes, consider a version suffix on the file names: Gmail caches images by URL.
- **Resend test sender:** with `EMAIL_FROM=onboarding@resend.dev`, mail only reaches the Resend account's own address; everything else returns a 500 from sign-in. Verify a sending domain before launch.

## Test data in the local database

Created for testing and deliberately kept until testing is finished. Local DB only; production is untouched.

- **Events:** `zz-test-tonight`, `zz-test-trail-run`, `zz-test-open-mic` (published, so they show on the home page and in admin).
- **Users:** `member.test@example.com` (bookings in every state), `paolo.reyes.p4@`, `mika.delacruz.p4@`, `jun.macario.p4@`, `aya.santos.p4@example.com`, and `door.p4@example.com` (door crew).
- **Bookings on real events:** on Base Camp Sessions Vol. 3, a pending-payment booking from `member.test` and four from the `.p4` members (Aya's approved with one ticket issued, the other three under review); on Sunrise Hike, an approved free booking with two tickets.
- **Check-ins:** the scanner e2e runs checked in about 20 Base Camp Sessions Vol. 3 tickets.
- **Files:** receipt images under `public/uploads/payments/` and a fake GCash QR at `public/uploads/gcash/zz-test-gcash-qr.png` (gitignored).

Sign-in emails can't reach these addresses through the Resend test sender, so sessions for them are created directly in the database.
