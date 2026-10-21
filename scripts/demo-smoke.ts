/*
 * Demo mode end to end over HTTP: persona sign-in, sample receipts, auto-approve,
 * expire hold + cron + waitlist, scan samples, the outbox, reset and the switch.
 *
 *   createdb bbc_ems_demo; DATABASE_URL=…/bbc_ems_demo pnpm db:migrate
 *   pnpm demo:seed --init --yes                     # with .env.demo (DEMO_MODE=1, demo DATABASE_URL)
 *   set -a; . ./.env.demo; set +a; pnpm dev         # the demo server
 *   pnpm smoke:demo
 *
 * Against a normal server (no DEMO_MODE, or DEMO_MODE on a database that isn't
 * marked as a demo), `pnpm smoke:demo --expect-off` checks that every demo route is shut.
 *
 * Changes the demo data; it resets it at the end.
 */
import type { BookingDTO, EventDetailDTO, MeDTO } from "@bbc/shared/api-types";
import type { ConfigDTO, DemoPersonaKey, DemoSignInDTO, ScanSample } from "@bbc/shared/demo";
import { parseToken } from "@bbc/shared/token";
import { Pool } from "pg";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";

function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${!ok && detail !== undefined ? ` → ${JSON.stringify(detail)}` : ""}`);
  if (!ok) process.exitCode = 1;
}

async function call<T = unknown>(path: string, init: RequestInit & { token?: string; json?: unknown } = {}) {
  const headers = new Headers(init.headers);
  if (init.token) headers.set("authorization", `Bearer ${init.token}`);
  // Like the app: a trusted Origin for better-auth's checks
  headers.set("origin", "bbcems://");
  let body = init.body;
  if (init.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(init.json);
  }
  const res = await fetch(BASE + path, { ...init, body, headers, redirect: "manual" });
  const type = res.headers.get("content-type") ?? "";
  const data = type.includes("json") ? await res.json() : null;
  return { res, status: res.status, data: data as T };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function become(persona: DemoPersonaKey, previous?: string) {
  const r = await call<DemoSignInDTO>("/api/v1/demo/sign-in", { method: "POST", json: { persona }, token: previous });
  if (r.status !== 200 || !r.data.token) throw new Error(`sign-in as ${persona} failed: ${r.status} ${JSON.stringify(r.data)}`);
  return r.data;
}

async function expectOff() {
  const config = await call<ConfigDTO>("/api/v1/config");
  check("config: no demo", config.status === 200 && config.data.demo === null && config.data.demoSite === false, config.data);
  for (const [method, path] of [
    ["POST", "/api/v1/demo/sign-in"],
    ["POST", "/api/v1/demo/settings"],
    ["POST", "/api/v1/demo/reset"],
    ["POST", "/api/v1/demo/cron"],
    ["POST", "/api/v1/demo/bookings/x/expire"],
    ["GET", "/api/v1/demo/scan-samples?eventId=x"],
  ] as const) {
    const r = await call(path, { method, json: method === "POST" ? { persona: "organiser", enabled: true } : undefined });
    check(`${method} ${path.split("?")[0]} → 404`, r.status === 404, r.status);
  }
}

async function main() {
  if (process.argv.includes("--expect-off")) return expectOff();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const one = async <T>(q: string, params: unknown[] = []) => (await pool.query(q, params)).rows[0] as T;

  // 1. Config
  const config = await call<ConfigDTO>("/api/v1/config");
  check("config: demo on, three personas", config.data.demo?.enabled === true && config.data.demo.personas.length === 3, config.data);

  // 2. Personas
  let member = await become("member");
  const me = await call<MeDTO>("/api/v1/me", { token: member.token! });
  check("member signs in with no email", me.status === 200 && me.data.role === "member" && me.data.name === "Mara Santos", me.data);
  const asMember = await call<ConfigDTO>("/api/v1/config", { token: member.token! });
  check("config knows the current persona", asMember.data.demo?.current === "member", asMember.data.demo?.current);

  const door = await become("door", member.token!);
  check("door crew is staff", door.me.role === "staff", door.me);
  const stale = await call("/api/v1/me", { token: member.token! });
  check("switching persona ends the old session", stale.status === 401, stale.status);

  const organiser = await become("organiser");
  check("organiser is admin", organiser.me.role === "admin", organiser.me);
  const queue = await call<{ items: unknown[] }>("/api/v1/admin/review", { token: organiser.token! });
  check("review queue is seeded (3)", queue.status === 200 && queue.data.items?.length === 3, queue.data.items?.length);

  // 3. Paying with a sample receipt waits for review…
  member = await become("member");
  const gig = await call<EventDetailDTO>("/api/v1/events/base-camp-sessions-vol-3");
  const regular = gig.data.tiers.find((t) => t.name === "Regular")!;
  const pay = async () => {
    const booked = await call<{ id: string; free: boolean }>("/api/v1/bookings", { method: "POST", token: member.token!, json: { eventId: gig.data.id, items: [{ tierId: regular.id, quantity: 1 }] } });
    const paid = await call<{ ok: boolean; autoApproved: boolean }>(`/api/v1/bookings/${booked.data.id}/payment`, {
      method: "POST",
      token: member.token!,
      json: { paymentRef: "1234567890123", paymentProofUrl: "/demo/sample-receipt-1.png" },
    });
    const after = await call<BookingDTO>(`/api/v1/bookings/${booked.data.id}`, { token: member.token! });
    return { id: booked.data.id, paid: paid.data, booking: after.data };
  };
  const first = await pay();
  check("sample receipt → under review", first.paid.ok && !first.paid.autoApproved && first.booking.status === "under_review", { paid: first.paid, status: first.booking.status });

  // …unless auto-approve is on
  const on = await call("/api/v1/demo/settings", { method: "POST", token: organiser.token!, json: { autoApprove: true } });
  check("organiser turns on auto-approve", on.status === 200, on.data);
  const second = await pay();
  check("auto-approve → approved with tickets", second.paid.autoApproved && second.booking.status === "approved" && second.booking.tickets.length === 1, { paid: second.paid, status: second.booking.status });
  await call("/api/v1/demo/settings", { method: "POST", token: organiser.token!, json: { autoApprove: false } });

  // 4. Expire a hold on the sold-out event → the waitlist hears about it
  const lapsing = await one<{ id: string }>(
    `select b.id from bookings b join events e on e.id = b.event_id where e.slug = 'cabin-fever-acoustic-night' and b.status = 'pending_payment'`,
  );
  const expired = await call<{ status: string }>(`/api/v1/demo/bookings/${lapsing.id}/expire`, { method: "POST", token: organiser.token! });
  check("expire hold now", expired.status === 200 && expired.data.status === "expired", expired.data);
  const cron = await call<{ expired: number; waitlisted: number }>("/api/v1/demo/cron", { method: "POST", token: organiser.token! });
  check("run cron now", cron.status === 200 && typeof cron.data.expired === "number", cron.data);
  let seatsOpen = 0;
  for (let i = 0; i < 20 && seatsOpen < 3; i++) {
    seatsOpen = (await one<{ n: number }>(`select count(*)::int n from demo_outbox where kind = 'email' and subject like 'Tickets just opened up%'`)).n;
    if (seatsOpen < 3) await sleep(250);
  }
  check("waitlist emails land in the outbox (3)", seatsOpen === 3, seatsOpen);

  // 5. Scan samples at the live event
  const doorAgain = await become("door");
  const live = await one<{ id: string }>(`select id from events where slug = 'open-mic-at-the-pines'`);
  const samples = await call<{ samples: ScanSample[] }>(`/api/v1/demo/scan-samples?eventId=${live.id}`, { token: doorAgain.token! });
  const kinds = samples.data.samples?.map((s) => s.kind) ?? [];
  check("scan samples cover every case", ["valid", "used", "wrong-event", "forged", "unknown"].every((k) => kinds.includes(k as ScanSample["kind"])), kinds);
  const valid = samples.data.samples.find((s) => s.kind === "valid" && s.via === "qr")!;
  const ticketId = parseToken(valid.text)?.ticketId ?? null;
  const scan = async () =>
    call<{ outcomes: { result: string }[] }>("/api/scan/sync", {
      method: "POST",
      token: doorAgain.token!,
      json: { eventId: live.id, deviceId: "demo-smoke", checkins: [{ clientId: crypto.randomUUID(), ticketId, rawPayload: valid.text, scannedAt: new Date().toISOString() }] },
    });
  const firstScan = await scan();
  check("valid sample checks in", firstScan.data.outcomes?.[0]?.result === "ok", firstScan.data);
  const secondScan = await scan();
  check("same ticket again is a duplicate", secondScan.data.outcomes?.[0]?.result === "duplicate", secondScan.data);

  // 6. The member's emails
  await sleep(1500); // notifyLater runs after the response
  const mail = await pool.query<{ subject: string }>(`select subject from demo_outbox where kind = 'email' and to_address = 'member@demo.invalid'`);
  const subjects = mail.rows.map((r) => r.subject);
  for (const [label, prefix] of [["reserved", "Pay "], ["receipt received", "Receipt submitted"], ["tickets", "Your tickets"]] as const) {
    check(`outbox has the ${label} email`, subjects.some((s) => s.startsWith(prefix)), subjects);
  }

  // 7. Reset
  const reset = await call<{ ok: boolean; counts: { bookings: number; tickets: number } }>("/api/v1/demo/reset", { method: "POST", token: organiser.token! });
  check("reset", reset.status === 200 && reset.data.counts.bookings > 20, reset.data);
  const kept = await call<MeDTO>("/api/v1/me", { token: member.token! });
  check("personas stay signed in across a reset", kept.status === 200, kept.status);
  const queueAfter = await call<{ items: unknown[] }>("/api/v1/admin/review", { token: organiser.token! });
  check("review queue back to the seed (3)", queueAfter.data.items?.length === 3, queueAfter.data.items?.length);

  // 8. The switch
  await call("/api/v1/demo/settings", { method: "POST", token: organiser.token!, json: { enabled: false } });
  const offSignIn = await call("/api/v1/demo/sign-in", { method: "POST", json: { persona: "member" } });
  check("switch off: persona sign-in is gone", offSignIn.status === 404, offSignIn.status);
  const offConfig = await call<ConfigDTO>("/api/v1/config");
  check("switch off: still the demo site", offConfig.data.demoSite === true && offConfig.data.demo === null, offConfig.data);
  const page = await fetch(`${BASE}/admin/demo`, { headers: { cookie: `better-auth.session_token=${organiser.token}` }, redirect: "manual" });
  check("switch off: /admin/demo still opens for organisers", page.status === 200, page.status);
  const back = await call<{ enabled: boolean }>("/api/v1/demo/settings", { method: "POST", token: organiser.token!, json: { enabled: true } });
  check("switch back on", back.data.enabled === true, back.data);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
