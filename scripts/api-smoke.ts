/*
 * The mobile app's API, end to end over HTTP: email-code sign-in, bearer auth,
 * /api/v1 booking flow, receipt upload, tickets, push tokens, door access and
 * the WebView handoff.
 *
 *   RESEND_API_KEY= pnpm dev > dev.log 2>&1 &
 *   DEV_LOG=dev.log pnpm smoke:api
 *
 * Codes are read from the dev server's "[email:dev]" output, so the server must
 * run without RESEND_API_KEY. Uses the local test accounts member.test@example.com
 * and door.p4@example.com, plus api.smoke@example.com for the booking flow (created
 * on first run; its booking is cancelled at the end).
 */
import { readFileSync } from "node:fs";
import type { BookingDTO, DoorEventDTO, EventDetailDTO, EventsDTO, MeDTO, TicketDTO } from "@bbc/shared/api-types";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const DEV_LOG = process.env.DEV_LOG;
const MEMBER = process.env.SMOKE_MEMBER ?? "member.test@example.com";
const STAFF = process.env.SMOKE_STAFF ?? "door.p4@example.com";
// Books and cancels a ticket each run; created on first sign-in, which also checks app sign-up.
const BOOKER = process.env.SMOKE_BOOKER ?? "api.smoke@example.com";
// 1x1 PNG, enough for /api/upload's type check
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${!ok && detail !== undefined ? ` → ${JSON.stringify(detail)}` : ""}`);
  if (!ok) process.exitCode = 1;
}

async function call<T = unknown>(path: string, init: RequestInit & { token?: string; cookie?: string } = {}) {
  const headers = new Headers(init.headers);
  if (init.token) headers.set("authorization", `Bearer ${init.token}`);
  if (init.cookie) headers.set("cookie", init.cookie);
  // Like the app: better-auth's sign-in CSRF check wants a trusted Origin whenever the
  // HTTP stack adds Sec-Fetch-* headers (Node's fetch does), and bbcems:// is trusted.
  headers.set("origin", "bbcems://");
  if (init.body && typeof init.body === "string") headers.set("content-type", "application/json");
  const res = await fetch(BASE + path, { ...init, headers, redirect: "manual" });
  const type = res.headers.get("content-type") ?? "";
  const data = type.includes("json") ? await res.json() : null;
  return { res, status: res.status, data: data as T };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Latest code mailed to `email` after `since` bytes of the log. */
async function codeFromLog(email: string, since: number) {
  for (let i = 0; i < 40; i++) {
    const log = readFileSync(DEV_LOG!, "utf8").slice(since);
    const blocks = log.split("[email:dev] to: ").filter((b) => b.startsWith(email));
    const m = blocks.at(-1)?.match(/subject: (\d{6}) is your/);
    if (m) return m[1];
    await sleep(250);
  }
  throw new Error(`No code for ${email} in ${DEV_LOG}`);
}

async function signIn(email: string) {
  const since = readFileSync(DEV_LOG!, "utf8").length;
  const sent = await call("/api/auth/email-otp/send-verification-otp", { method: "POST", body: JSON.stringify({ email, type: "sign-in" }) });
  check(`send code to ${email}`, sent.status === 200, sent.data);
  const otp = await codeFromLog(email, since);
  const bad = await call("/api/auth/sign-in/email-otp", { method: "POST", body: JSON.stringify({ email, otp: otp === "000000" ? "111111" : "000000" }) });
  check("wrong code is refused", bad.status >= 400, bad.status);
  const ok = await call("/api/auth/sign-in/email-otp", { method: "POST", body: JSON.stringify({ email, otp }) });
  const token = ok.res.headers.get("set-auth-token");
  check(`sign in ${email} with code, token in set-auth-token`, ok.status === 200 && !!token, ok.status);
  return token!;
}

async function main() {
  if (!DEV_LOG) throw new Error("Set DEV_LOG to the dev server's log file (see the header of this script)");

  // ── Signed out
  check("GET /me without a token is 401", (await call("/api/v1/me")).status === 401);
  check("GET /me with a forged token is 401", (await call("/api/v1/me", { token: "forged.token" })).status === 401);
  const events = await call<EventsDTO>("/api/v1/events");
  check("GET /events works signed out", events.status === 200 && Array.isArray(events.data.upcoming), events.status);

  // ── Member
  const member = await signIn(MEMBER);
  const me = await call<MeDTO>("/api/v1/me", { token: member });
  check("GET /me returns the member", me.status === 200 && me.data.email === MEMBER && me.data.role === "member", me.data);

  const renamed = await call<MeDTO>("/api/v1/me", { token: member, method: "PATCH", body: JSON.stringify({ name: me.data.name }) });
  check("PATCH /me keeps the name", renamed.status === 200 && renamed.data.name === me.data.name, renamed.data);
  check("PATCH /me rejects a 1-letter name with 422", (await call("/api/v1/me", { token: member, method: "PATCH", body: JSON.stringify({ name: "x" }) })).status === 422);

  // ── Booking flow, as a separate member so earlier runs' bookings don't block it
  const booker = await signIn(BOOKER);
  const bookerMe = await call<MeDTO>("/api/v1/me", { token: booker });
  check("a new email signs up through the code flow as a member", bookerMe.status === 200 && bookerMe.data.role === "member", bookerMe.data);

  // An upcoming event with a paid tier on sale and room left
  let target: { event: EventDetailDTO; tierId: string } | null = null;
  for (const e of events.data.upcoming) {
    const d = await call<EventDetailDTO>(`/api/v1/events/${e.slug}`, { token: booker });
    const tier = d.data.tiers?.find((t) => t.onSale && t.priceCents > 0 && t.remaining > 0);
    if (d.status === 200 && tier && !d.data.myBooking) {
      target = { event: d.data, tierId: tier.id };
      break;
    }
  }
  check("GET /events/[slug] 404s for a missing event", (await call("/api/v1/events/no-such-event-xyz")).status === 404);

  if (!target) {
    console.log("SKIP booking flow: no upcoming paid tier on sale without a live booking for the smoke account");
  } else {
    const { event, tierId } = target;
    check(`GET /events/${event.slug} has tiers and availability`, event.tiers.length > 0 && event.availability !== null);

    const tooMany = await call("/api/v1/bookings", { token: booker, method: "POST", body: JSON.stringify({ eventId: event.id, items: [{ tierId, quantity: 49 }] }) });
    check("POST /bookings over the per-order limit is 400 with a reason", tooMany.status === 400 && typeof (tooMany.data as { error?: string }).error === "string", tooMany.data);

    const made = await call<{ id: string; free: boolean }>("/api/v1/bookings", { token: booker, method: "POST", body: JSON.stringify({ eventId: event.id, items: [{ tierId, quantity: 1 }] }) });
    check("POST /bookings reserves a paid ticket", made.status === 200 && !!made.data.id && made.data.free === false, made.data);
    const id = made.data.id;

    const held = await call<BookingDTO>(`/api/v1/bookings/${id}`, { token: booker });
    check("GET /bookings/[id] is pending_payment with a deadline and GCash details", held.data.status === "pending_payment" && !!held.data.expiresAt && "gcashNumber" in held.data.payment, held.data);

    const form = new FormData();
    form.set("folder", "payments");
    form.set("file", new Blob([PNG], { type: "image/png" }), "receipt.png");
    const up = await call<{ url: string }>("/api/upload", { token: booker, method: "POST", body: form });
    check("POST /api/upload accepts a bearer token", up.status === 200 && !!up.data.url, up.data);

    const form2 = new FormData();
    form2.set("folder", "posters");
    form2.set("file", new Blob([PNG], { type: "image/png" }), "poster.png");
    check("POST /api/upload to posters is admin-only", (await call("/api/upload", { token: booker, method: "POST", body: form2 })).status === 403);

    const badPay = await call(`/api/v1/bookings/${id}/payment`, { token: booker, method: "POST", body: JSON.stringify({ paymentRef: "1", paymentProofUrl: up.data.url }) });
    check("POST payment with a short reference is 422", badPay.status === 422, badPay.data);
    const pay = await call(`/api/v1/bookings/${id}/payment`, { token: booker, method: "POST", body: JSON.stringify({ paymentRef: "SMOKE12345", paymentProofUrl: up.data.url }) });
    check("POST /bookings/[id]/payment submits the receipt", pay.status === 200, pay.data);
    const review = await call<BookingDTO>(`/api/v1/bookings/${id}`, { token: booker });
    check("booking is now under_review", review.data.status === "under_review", review.data.status);

    const mine = await call<BookingDTO[]>("/api/v1/bookings", { token: booker });
    check("GET /bookings lists it", mine.status === 200 && mine.data.some((b) => b.id === id));

    const cancel = await call(`/api/v1/bookings/${id}/cancel`, { token: booker, method: "POST" });
    check("POST /bookings/[id]/cancel cancels it", cancel.status === 200, cancel.data);
    check("cancelling twice is 400", (await call(`/api/v1/bookings/${id}/cancel`, { token: booker, method: "POST" })).status === 400);
  }

  // ── Tickets
  const tickets = await call<TicketDTO[]>("/api/v1/tickets", { token: member });
  check("GET /tickets returns a list", tickets.status === 200 && Array.isArray(tickets.data), tickets.status);
  const t = tickets.data.find((x) => x.status === "valid");
  if (!t) console.log("SKIP ticket checks: member has no valid tickets");
  else {
    check("ticket carries token, QR URL and PNG path", t.qrUrl.endsWith(`/t/${t.token}`) && t.token.startsWith("v1.") && t.pngPath === `/api/tickets/${t.id}/png`);
    const png = await call(t.pngPath + "?theme=dark", { token: member });
    check("ticket PNG with a bearer token", png.status === 200 && png.res.headers.get("content-type") === "image/png", png.status);
    const same = await call<TicketDTO>(`/api/v1/tickets/${t.id}`, { token: member, method: "PATCH", body: JSON.stringify({ holderName: t.holderName }) });
    check("PATCH /tickets/[id] renames", same.status === 200 && same.data.holderName === t.holderName, same.data);
  }

  // ── Push tokens
  const fake = `ExponentPushToken[smoke-${Date.now()}]`;
  const reg = await call("/api/v1/push/register", { token: member, method: "POST", body: JSON.stringify({ token: fake, platform: "android", deviceId: "smoke" }) });
  check("POST /push/register", reg.status === 200, reg.data);
  check("POST /push/register rejects a non-Expo token", (await call("/api/v1/push/register", { token: member, method: "POST", body: JSON.stringify({ token: "not-a-push-token-xyz", platform: "android", deviceId: "smoke" }) })).status === 422);
  check("POST /push/unregister", (await call("/api/v1/push/unregister", { token: member, method: "POST", body: JSON.stringify({ token: fake }) })).status === 200);

  // ── Door endpoints are staff-only
  check("member GET /scan/events is 403", (await call("/api/v1/scan/events", { token: member })).status === 403);
  check("member GET /api/scan/manifest is 403", (await call("/api/scan/manifest/anything", { token: member })).status === 403);

  // ── WebView handoff: one-time token → session cookie
  const ott = await call<{ token: string }>("/api/auth/one-time-token/generate", { token: member });
  check("generate a one-time token with the bearer token", ott.status === 200 && !!ott.data.token, ott.status);
  const hand = await call(`/app/handoff?ott=${ott.data.token}&next=/admin`, {});
  const cookies = hand.res.headers.getSetCookie();
  const session = cookies.find((c) => /session_token=/.test(c));
  check("/app/handoff redirects to /admin and sets the session cookie", hand.status >= 300 && hand.status < 400 && new URL(hand.res.headers.get("location")!, BASE).pathname === "/admin" && !!session, { status: hand.status, location: hand.res.headers.get("location"), cookies });
  if (session) {
    const cookie = session.split(";")[0];
    const viaCookie = await call<MeDTO>("/api/v1/me", { cookie });
    check("the handed-off cookie is the same account", viaCookie.status === 200 && viaCookie.data.email === MEMBER, viaCookie.status);
  }
  const again = await call(`/app/handoff?ott=${ott.data.token}&next=/admin`, {});
  check("a one-time token works once", (again.res.headers.get("location") ?? "").includes("/login"), again.res.headers.get("location"));
  const offsite = await call(`/app/handoff?ott=x&next=//evil.example`, {});
  check("/app/handoff never redirects off-site", !(offsite.res.headers.get("location") ?? "").includes("evil.example"), offsite.res.headers.get("location"));

  // ── Door crew
  const staff = await signIn(STAFF);
  const doors = await call<DoorEventDTO[]>("/api/v1/scan/events", { token: staff });
  check("staff GET /scan/events", doors.status === 200 && Array.isArray(doors.data), doors.data);
  const door = doors.data[0];
  if (door) {
    const manifest = await call<{ tickets: unknown[]; publicKey: string }>(`/api/scan/manifest/${door.id}`, { token: staff });
    check("staff GET /api/scan/manifest with a bearer token", manifest.status === 200 && Array.isArray(manifest.data.tickets) && !!manifest.data.publicKey, manifest.status);
    check("POST /scan/undo 404s for a ticket not on this event", (await call("/api/v1/scan/undo", { token: staff, method: "POST", body: JSON.stringify({ eventId: door.id, ticketId: "nope" }) })).status === 404);
  }

  // ── Sign-out kills the bearer token
  const out = await call("/api/auth/sign-out", { token: staff, method: "POST", body: "{}" });
  check("sign out", out.status === 200, out.status);
  check("token is dead after sign-out", (await call("/api/v1/me", { token: staff })).status === 401);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
