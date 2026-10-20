# UI revamp: Alpine Day / Starlit Night

Design handoff for the Baguio Base Camp EMS revamp. Read this before touching any page.

- **Canvas (30 artboards):** https://claude.ai/artifact/FtdC55UzCsYQqBP3Pjd2hZ — the source of truth for layout and copy.
- **Mockup source:** [`mockups/`](./mockups/) holds the same 30 artboards as self-contained HTML (`*.dc.html`) plus `canvas.json` (positions, titles). Open any file in a browser, or read it for exact spacing, sizes and colour values. The markup uses inline styles and a tiny `.day` / `.night` CSS-variable set, so values translate 1:1 to the tokens below.
- **Status:** Phase 1 (foundations) is shipped on this branch. Phases 2–6 are specified below, page by page, and are meant to be built locally with the DB running and the canvas open beside the browser.

## The direction in one paragraph

The logo is cut in half: a sunny morning on the left, a starry night on the right. Light mode and dark mode now take one half each. **Light = Alpine Day**: cream page, white surfaces, sky cyan, lime ridges, sun-yellow highlights, soft clouds. **Dark = Starlit Night**: midnight page (`#0e1c20`, deeper than the old `#1c2f34`), night/slate surfaces, lime primary, star-yellow accents, a seeded star field and a crescent moon. One display face, **Bricolage Grotesque**, for headlines, big numbers and ticket codes; **Geist** for UI text; **Geist Mono** for references. Motifs come from the five ticket styles: layered ridge silhouettes with pines, topographic contours, ticket-stub notches and perforations, rubber stamps. The existing copy and voice stay.

### Seven signature moves
1. **Living Skyline** — one `<Skyline>` (ridges, pines, sun+clouds or stars+moon) in the hero, card fallbacks, login, footer and empties. Day in light, night in dark.
2. **Ticket-stub event cards** — punched notches, perforated price footer, a date "trail marker" tab, "SOLD OUT" stamp.
3. **Trail stepper** for booking — Pick → Pay → Ticket as markers on a dashed path; the current one is a sun-yellow mountain flag.
4. **Ticket wallet** — ticket on a dark stage with a soft glow, swipe between siblings, "CHECKED IN" stamp on used tickets.
5. **"Tonight" pass** on My tickets — an event within 18 h opens the page as a large pass with a live countdown and the QR one tap away.
6. **Door mode scanner** — always dark, animated viewfinder brackets and scan line, big segmented control, flood-colour results with a spring-in icon.
7. **Illustrated empties/404/errors** — a tent under the ridge; sun by day, moon by night.

## Phase 1: what is already on this branch

### Tokens (`src/app/globals.css`)

Brand values (`--bbc-*`) never change between themes. Semantic tokens pick from them:

| Token | Alpine Day (light) | Starlit Night (dark) | Tailwind class |
|---|---|---|---|
| `--background` | `#f6f4ec` cream | `#0e1c20` midnight | `bg-background` |
| `--surface-1` / `--card` | `#ffffff` | `#1c2f34` night | `bg-surface-1`, `bg-card` |
| `--surface-2` / `--muted` | `#eef2e8` | `#27404a` slate | `bg-surface-2`, `bg-muted` |
| `--surface-3` | `#e3e9dc` | `#324f57` | `bg-surface-3` (meters, shimmer) |
| `--foreground` | `#0b3d2e` deep forest | `#e8f0e6` fog | `text-foreground` |
| `--muted-foreground` | `#5b7060` (4.8:1) | `#a9bfae` (7.1:1) | `text-muted-foreground` |
| `--primary` | `#1b5e3b` pine | `#8cc63e` lime | `bg-primary text-primary-foreground` |
| `--accent-foreground` (links) | `#1e6fa3` sky deep | `#7fd8f0` | `text-accent-foreground` |
| `--success` / `-foreground` / `-soft` | `#39b54a` / `#1b5e3b` / 14% grass | `#8cc63e` / `#a6d85a` / 16% lime | `bg-success`, `text-success-foreground`, `bg-success-soft` |
| `--warning` / `-foreground` / `-soft` | `#d4b800` / `#6b4f00` / 26% sun | `#f5f0a0` / `#f5f0a0` / 14% star | `bg-warning`, `text-warning-foreground`, `bg-warning-soft` |
| `--info` / `-foreground` / `-soft` | `#1e6fa3` / same / 18% sky | `#7fd8f0` / same / 14% | `bg-info`, `text-info-foreground`, `bg-info-soft` |
| `--destructive` / `-soft` | `#b4321f` / 10% | `#ff8a76` / 14% | `bg-destructive`, `text-destructive`, `bg-destructive-soft` |
| highlight | `sun` `#f7e017` | `star` `#f5f0a0` | `bg-sun text-deep-forest`, `dark:bg-star` |

Rules that came out of the contrast checks: **sun yellow is a background only on light surfaces** (text on it is deep forest); star yellow may carry text at night (12:1 on midnight); the eyebrow on light surfaces is **pine**, never grass (2.4:1); "Welcome in" on the scanner is lime with deep-forest text, not white on grass.

Fonts: `font-display` (Bricolage, via `--font-bricolage` from `next/font/google` with the `opsz` axis), `font-sans` (Geist), `font-mono` (Geist Mono). `h1`–`h3` get the display face by default. Scale: hero 56/800, display 40/800, h1 32/700, h2 24/700, h3 18/600, body 16, UI 15/500, small 13, eyebrow 11 caps +18% tracking, code 20/700 +8%.

Utilities: `.bbc-eyebrow`, `.bbc-skyline` (day→night gradient), `.bbc-dawn`, `.bbc-dusk`, `.bbc-contour` (topographic texture, theme-aware), `.bbc-stub` + `--stub-notch` + `--stub-bg` (put it on an outer element that does **not** clip; the rounded `overflow-hidden` card goes inside), `.bbc-perforation`, `.bbc-shimmer`. Animations: `animate-twinkle`, `animate-drift`, `animate-shimmer`, `animate-scanline`, `animate-pulse-ring`, `animate-pop`, `animate-fade-up`. Everything stops under `prefers-reduced-motion`.

### Components shipped

| Component | File | Notes |
|---|---|---|
| `Skyline` | `src/components/brand/skyline.tsx` | `variant="auto\|day\|night"`, `size="hero\|card\|strip"`, `seed` (stars are deterministic, pass the event slug), `animated`. Server component; give it `absolute inset-0`. |
| `CampIllustration` | same | Tent under the ridge, theme-aware. Used by `EmptyState`. |
| `Stamp` | `src/components/brand/stamp.tsx` | `tone="success\|destructive\|info\|muted\|inverse"`, `size="sm\|md\|lg"`. Rotated, double ring. |
| `FadeUp`, `Stagger`, `StaggerItem`, `Pop` | `src/components/motion.tsx` | `motion/react` islands; collapse under reduced motion. Use for card grids, the scanner result icon, the wallet. |
| `Button` | `src/components/ui/button.tsx` | new `variant="sun"` (the one pay/confirm/show-QR action) and `variant="glass"` (on imagery); `size="lg"` is now a pill. |
| `Badge` | `src/components/ui/badge.tsx` | new tones `success`, `warning`, `info`, `danger`, `muted`, `sun`, `inverse`. |
| `StatusBadge` | `src/components/event/status-badge.tsx` | tone + leading dot (check icon for "used"); labels unchanged. |
| `Card` | `src/components/ui/card.tsx` | `rounded-2xl` with a border instead of a ring; title in the display face. |
| `Notice` | `src/components/ui/notice.tsx` | left accent bar + icon on a plain card. Same props. |
| `EmptyState` | `src/components/ui/empty-state.tsx` | illustrated; `title` is new, `children` is the one-liner. |
| `Skeleton` | `src/components/ui/skeleton.tsx` | shimmer. |
| `Stat` | `src/components/admin/stat.tsx` | display number, eyebrow label, new `progress` meter, `highlight` = sun tint. |
| `TrailSteps` | `src/components/ui/trail-steps.tsx` | `steps: { label, status: done\|current\|pending\|waiting\|error }[]`. |
| `Segmented` | `src/components/ui/segmented.tsx` | tablist control, 44px targets. |
| `BottomNav` | `src/components/ui/bottom-nav.tsx` | phone tab bar on `/`, `/me`, `/about`, `/me/profile` only; the body pads itself via `data-bottom-nav`. Mounted from `SiteHeader`. |
| `ThemeToggle` | `src/components/layout/theme-toggle.tsx` | the sun/moon switch over a ridge; `role="switch"`. |
| `Input` | `src/components/ui/input.tsx` | 44px on phones, `rounded-xl`. |

Tickets (`src/lib/tickets/render/styles/*`): titles, short codes and holder names now use `DISPLAY` (Bricolage); the light-ticket eyebrow is pine. QR geometry is byte-identical. One deliberate colour change: the **dark** Summit and Trail Pass tickets used to draw light modules on a dark plate, and the door scanner (`@zxing/browser`) never attempts inverted codes, so a member showing the on-screen ticket in dark mode could not be scanned in. Both now keep dark modules on a light window in both themes, as Night Sky always did. `src/assets/fonts/BricolageGrotesque-{SemiBold,Bold,ExtraBold}.ttf` (OFL, licence alongside) feed resvg and the OG image. `pnpm smoke:tickets` renders all ten variants to `.smoke/tickets/` and decodes them with no inversion, mirroring the scanner.

## Phases 2–6: page specs

Every page: phone first (390), then desktop (1280); both themes; copy as in the mockups (it is the app's existing voice). Reuse the data helpers that exist (`listPublishedEvents`, `tierAvailability`, `tierIsOnSale`, `effectiveStatus`, `publishChecklist`, `eventStats`, `fmt*`, `peso`, `relative`); no new server actions are needed for any of this.

### Phase 2: public pages
| Page | Mockup | Build |
|---|---|---|
| `src/app/(public)/page.tsx` | `HomeMobile`, `HomeDesktop` | Hero: `<Skyline variant="auto" size="hero">` behind eyebrow + display headline + two CTAs (day copy is deep forest on the light sky, night copy is white — swap with `dark:` classes). "Up next": the first upcoming event as a large stub card with a `relative()` chip; on desktop it rides the ridge at the hero's right. "Coming up": `Stagger` grid of stub cards. "Past events": compact rail at 75% opacity. Filter pills (All / Gigs / Outdoors / Free) are visual only unless you add a category — skip them if not. |
| `src/components/event/event-card.tsx` | `EventCards` | Outer `bbc-stub` wrapper (`--stub-notch` at the perforation), inner rounded card; date tab top-left, availability chip top-right (`sun` for few-left, `inverse` for sold out + `<Stamp>` over a dimmed poster, `danger` for cancelled), title wraps 2 lines, perforated footer with price in the display face. Hover: lift 4px + poster `scale-[1.03]`. |
| `src/app/(public)/events/[slug]/page.tsx` | `EventMobile`, `EventDesktop` | Phone: poster hero with a bottom scrim and the title on it, glass back/share buttons; tier list with a thin meter and "12 left" in warning; sticky CTA stays. Desktop: two columns, sticky ticket panel with the existing-booking panel in `success-soft`, share card. |
| `src/app/login/*` | `SignIn`, `SignInDesktop` | Skyline panel + card overlapping it by 36px; sent state with the envelope illustration, resend cooldown, "Open mail app" `sun` button. Desktop is a split. |
| `src/app/(public)/about/page.tsx` | (copy only) | Four-step trail using `TrailSteps` statuses `done`. |
| `src/components/layout/*`, route states | `NavEmpty` | Pill nav, account menu with role badge, footer with `<Skyline size="strip">`. 404 "We couldn't find that trail", error with the digest, both via `EmptyState`. |

### Phase 3: booking and tickets
| Page | Mockup | Build |
|---|---|---|
| `events/[slug]/book/book-form.tsx` | `BookMobile` | `TrailSteps` (Pick current), tier rows with 44px round steppers, sticky summary whose CTA label changes with the selection (already in the form's logic). |
| `bookings/[id]/page.tsx`, `payment-form.tsx` | `PayMobile`, `BookingStates` | `TrailSteps` per status (`pending_payment` → Pay current; `under_review` → Ticket waiting; `rejected` → Pay error; `approved` → Ticket current; `expired` → all pending, dimmed). Hold countdown as a ring (SVG `stroke-dashoffset` driven by the existing `Countdown` logic). GCash panel with copy buttons; receipt dropzone; `sun` button for resubmit. Guest-name rows as in the approved state. |
| `tickets/[id]/page.tsx` + new `src/components/ticket/ticket-wallet.tsx` | `Wallet` | Client island: dark stage (`bg-midnight`) with a radial lime glow, the ticket SVG, `motion` drag to swipe between siblings (route to prev/next on release), dots + "Swipe for Mika's ticket"; `<Stamp tone="success" size="lg">Checked in</Stamp>` over a 55%-opacity ticket when `status === "used"`. Actions: Save image, Copy code, Share. Keep the page light on JS for signed-out `/t/`. |
| `me/page.tsx` | `MyTickets` | "Your passes"; attention banner in `warning-soft` with a `sun` button; "Tonight" pass (night Skyline card, `sun`/`star` "Show my QR", second ticket as glass); Coming up blocks; Past collapsed. |
| `t/[payload]/page.tsx` | `Verify` | Full-height result: a 148px seal (double ring) in the tone's soft colour, eyebrow "Ticket check", display title, meta card with a dashed divider, one line of reassurance. |

### Phase 4: organiser
| Page | Mockup | Build |
|---|---|---|
| `src/app/admin/layout.tsx` + new `src/components/admin/sidebar.tsx`, `command-palette.tsx` | `Dashboard` (shell) | Sidebar rail (logo + role chip, Dashboard, Events, Review queue with count, Attendees, Door scanner; Team, Ticket lab; View site; user). Top bar with breadcrumb, ⌘K search (events, bookings, people, "new event"), New event. Phone: `AdminMobile` with its own bottom tab bar (Home, Events, Review, Scanner, More). |
| `admin/page.tsx` | `Dashboard` | Greeting; "Needs attention" priority inbox (rows with tone-tinted icon tiles); four `Stat` tiles, the last with a 14-day sparkline (single hue, numbers in text tokens, hover tooltip; a per-day ticket count query goes in `lib/events.ts`); Live events with meters; Drafts; Recent activity. |
| `admin/events/page.tsx` | `EventsList` | Filter segmented (Upcoming/Drafts/Past/All) + search; table in an `overflow-x-auto` box: thumb, title/venue, when, status, meter + n/cap, to-review `sun` pill, confirmed ₱, actions. |
| `admin/events/[id]/layout.tsx`, `page.tsx` | `EventOverview` | Poster thumb header + status + "in 12 days"; tabs with a count; warn notice; `Stat` tiles incl. `highlight`; Quick actions; Status card (danger zone below a divider); Tiers with meters. |
| `admin/events/[id]/bookings/review-list.tsx` | `ReviewQueue` | Split view ≥ 1024px: queue list left (receipt thumb, name, amount, ref, age), selected booking right (receipt large with zoom/open, details with "matches" hints, Approve `A`, Reject `R` with quick reasons, Cancel). Keys J/K/A/R/Z. Phone: receipt-first cards as today. Actions are unchanged (`approveAction`, `rejectAction`, `adminCancelBookingAction`, `resendTicketsAction`). |
| `admin/events/[id]/attendees/attendee-table.tsx` | `Attendees` | Check-in-by-code bar + progress card + CSV; status segmented + tier select + search with `<mark>` highlights; table with row actions. |
| `src/components/admin/event-form.tsx` + new `event-preview.tsx` | `EventForm` | Outline nav with per-section ticks, collapsible sections with a summary line when closed, tier cards as stubs, a live public-card preview and publish checklist in the aside, sticky save bar with "Unsaved changes". |
| `admin/team`, `admin/ticket-lab` | (restyle) | Cards; ticket lab as a gallery with a style switcher. |

### Phase 5: door crew
| Page | Mockup | Build |
|---|---|---|
| `admin/scan/page.tsx` | `ScanIndex` | Always dark (wrap in `.dark`). Live event card with a pulsing dot (`animate-pulse-ring`), meter, "Scan"; other events as rows; offline explainer. |
| `src/components/scanner/scanner.tsx`, `camera.tsx` | `DoorMode`, `ScanResults`, `ScanCodeList` | Always dark. Stats strip, conn pill, `Segmented` for Camera/Type code/Guest list, viewfinder with lime corner brackets + `animate-scanline`, torch button. Result overlay: full flood (`ok` lime/deep-forest, `duplicate` sun/deep-forest with "Undo that check-in", `invalid` `#b4321f`/white, `stale` `#1e6fa3`/white with "Refresh list and retry"), `Pop` on the icon, auto-dismiss timings as today. Type code: 60px mono input with a progress row and a CTA that counts remaining characters. Guest list: search, inline Cancel/Confirm on the row. `use-scanner.ts`, `store.ts`, `feedback.ts` stay as they are. |

### Phase 6: comms
| Surface | Mockup | Build |
|---|---|---|
| `src/emails/*` | `Emails` | System fonts. Skyline header strip (SVG inline, 560×112) with the logo; stub blocks per ticket with a dashed left edge; pill button; footer line. Magic link: one button, the "door crew: open in Safari/Chrome" note. |
| `events/[slug]/opengraph-image.tsx` | `OgTickets` | Poster-aware: when `coverImageUrl` exists, blur it as the background with a left scrim and show it sharp on the right; otherwise the skyline. Fonts are already wired. |

## Non-negotiables
- Contrast: 4.5:1 for text (3:1 at 24px+); the rules above about sun/star/pine are the known traps.
- `prefers-reduced-motion`: nothing may rely on animation to be understood.
- Stars and contours are seeded (`src/lib/seeded.ts`) so SSR and hydration agree; never `Math.random()` in render.
- Ticket renderers: never move a QR module, plate or finder. Run `pnpm smoke:tickets` after any change there.
- 44px touch targets in the scanner and booking steppers; 16px inputs on phones.
- Use real `<button>` / `<a>` / `<input>` + `<label>`; icon-only buttons get `aria-label`.

## Verification
```bash
pnpm typecheck && pnpm lint && pnpm build
pnpm smoke:tickets            # 10/10 PASS, PNGs in .smoke/tickets/
pnpm dev                      # then screenshot each page at 390 and 1280, light and dark
```
`scripts/e2e-scanner.ts` drives the scanner in Chromium against the dev server; keep it green after Phase 5.
