import "server-only";
import { createHash } from "node:crypto";
import { DEMO_RECEIPTS, demoPaymentRef } from "@bbc/shared/demo";
import { eq, inArray, notInArray, notLike, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { at, day, sampleEvents } from "@/db/sample-events";
import { appSettings, bookingItems, bookings, checkins, events, ticketTiers, tickets, users, waitlist } from "@/db/schema";
import { issueTicketsTx, type Tx } from "@/lib/bookings";
import { env } from "@/lib/env";
import { DEMO_ENV, type DemoMarker, getDemoMarker, MARKER_KEY } from "./flag";
import { DEMO_EMAIL_DOMAIN, PERSONAS, upsertPersonas } from "./personas";

const HOUR = 3600e3;

/** Fake members, recreated on every reset so the review queue, guest lists and waitlist look lived in. */
const FAKES = ["Paolo Dizon", "Kat Ramos", "Lia Mendoza", "Rafa Bautista", "Nina Villanueva", "Migs Torres", "Tala Aquino", "Enzo Garcia"].map((name, i) => ({
  id: `demo_fake_${i + 1}`,
  name,
  email: `${name.split(" ")[0].toLowerCase()}@${DEMO_EMAIL_DOMAIN}`,
}));

const PERSONA_IDS = Object.values(PERSONAS).map((p) => p.id);

/** Short fingerprint of the ticket signing key, so /admin/demo can spot tickets signed by another deployment's key. */
export function demoKeyFingerprint() {
  if (!env.signingPublicKey) throw new Error("TICKET_SIGNING_PUBLIC_KEY is not set");
  return createHash("sha256").update(env.signingPublicKey).digest("hex").slice(0, 12);
}

/**
 * Marks a fresh database as demo-only, then seeds it. Refuses a database that has any
 * account outside @demo.invalid or any booking: that is someone's real data.
 */
export async function initDemoDatabase() {
  if (!DEMO_ENV) throw new Error("Set DEMO_MODE=1 for the demo deployment before marking its database");
  const realUsers = await db.select({ email: users.email }).from(users).where(notLike(users.email, `%@${DEMO_EMAIL_DOMAIN}`)).limit(5);
  const [{ n: bookingCount }] = await db.select({ n: sql<number>`count(*)::int` }).from(bookings);
  const marked = await getDemoMarker();
  if (!marked && (realUsers.length || bookingCount)) {
    throw new Error(
      `Refusing to turn this database into a demo: it has ${realUsers.length ? `real accounts (${realUsers.map((u) => u.email).join(", ")})` : `${bookingCount} bookings`}. Use an empty database.`,
    );
  }
  const marker: DemoMarker = { createdAt: new Date().toISOString(), keyFingerprint: demoKeyFingerprint() };
  await db.insert(appSettings).values({ key: MARKER_KEY, value: marker }).onConflictDoUpdate({ target: appSettings.key, set: { value: marker, updatedAt: new Date() } });
  return resetDemo();
}

/**
 * Wipes the demo database back to the story below, in one transaction. Persona accounts
 * (and so their sessions and push tokens) survive, so presenters stay signed in.
 */
export async function resetDemo() {
  if (!(await getDemoMarker())) throw new Error("This database isn't a demo database");
  return db.transaction(async (tx) => {
    // Two "Reset" taps at once would otherwise interleave their truncates and inserts
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('bbc-demo-reset'))`);
    // TRUNCATE skips the per-row FK checks that make deleting tiers under bookings fail
    await tx.execute(
      sql`truncate table checkins, tickets, booking_items, bookings, waitlist, ticket_tiers, discord_event_sync, events, notification_log, role_grants, demo_outbox, verifications`,
    );
    await tx.delete(users).where(notInArray(users.id, PERSONA_IDS));
    await upsertPersonas(tx);
    await tx.insert(users).values(FAKES.map((f) => ({ ...f, role: "member" as const, emailVerified: true })));
    // Every ticket is re-signed below with this deployment's key, so the marker now matches it
    const marker = await getDemoMarker();
    if (marker && marker.keyFingerprint !== demoKeyFingerprint()) {
      const next: DemoMarker = { ...marker, keyFingerprint: demoKeyFingerprint() };
      await tx.update(appSettings).set({ value: next, updatedAt: new Date() }).where(eq(appSettings.key, MARKER_KEY));
    }
    for (const [key, value] of [["demo.enabled", true], ["demo.autoApprove", false]] as const) {
      await tx.insert(appSettings).values({ key, value }).onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
    }
    return seedStory(tx);
  });
}

type Line = { tier: string; qty: number };
type BookingSeed = {
  userId: string;
  lines: Line[];
  status: (typeof bookings.$inferSelect)["status"];
  expiresAt?: Date | null;
  receipt?: boolean;
  reviewNote?: string;
  /** Tickets to mark as checked in, from the first. */
  checkedIn?: number;
};

async function seedStory(tx: Tx) {
  const member = PERSONAS.member.id;
  const door = PERSONAS.door.id;
  const organiser = PERSONAS.organiser.id;
  const fake = (n: number) => FAKES[n - 1].id;
  const now = Date.now();
  const counts = { events: 0, bookings: 0, tickets: 0, checkins: 0 };

  async function addEvent(e: Omit<typeof events.$inferInsert, "id"> & { tiers: Omit<typeof ticketTiers.$inferInsert, "id" | "eventId">[] }) {
    const { tiers, ...row } = e;
    const id = nanoid(12);
    await tx.insert(events).values({ id, createdBy: organiser, ...row });
    const tierRows = tiers.map((t, i) => ({ id: nanoid(12), eventId: id, sortOrder: i, ...t }));
    await tx.insert(ticketTiers).values(tierRows);
    counts.events++;
    return { id, tier: (name: string) => tierRows.find((t) => t.name === name)!.id };
  }

  async function addBooking(ev: { id: string; tier: (name: string) => string }, b: BookingSeed) {
    const id = nanoid(12);
    const lines = b.lines.map((l) => ({ tierId: ev.tier(l.tier), qty: l.qty }));
    const tierRows = await tx.select().from(ticketTiers).where(inArray(ticketTiers.id, lines.map((l) => l.tierId)));
    const price = (tierId: string) => tierRows.find((t) => t.id === tierId)!.priceCents;
    const total = lines.reduce((n, l) => n + price(l.tierId) * l.qty, 0);
    const submitted = b.receipt || b.status === "under_review" || (b.status === "approved" && total > 0);
    const reviewed = b.status === "approved" || b.status === "rejected";
    await tx.insert(bookings).values({
      id,
      eventId: ev.id,
      userId: b.userId,
      status: b.status,
      totalCents: total,
      expiresAt: b.expiresAt ?? null,
      paymentRef: submitted ? demoPaymentRef() : null,
      paymentProofUrl: submitted ? DEMO_RECEIPTS[counts.bookings % DEMO_RECEIPTS.length] : null,
      submittedAt: submitted ? new Date(now - 2 * HOUR) : null,
      reviewNote: b.reviewNote ?? null,
      reviewedBy: reviewed && total > 0 ? organiser : null,
      reviewedAt: reviewed ? new Date(now - HOUR) : null,
    });
    await tx.insert(bookingItems).values(lines.map((l) => ({ id: nanoid(12), bookingId: id, tierId: l.tierId, quantity: l.qty, unitPriceCents: price(l.tierId) })));
    counts.bookings++;
    if (b.status === "approved") {
      await issueTicketsTx(tx, id);
      const issued = await tx.select().from(tickets).where(eq(tickets.bookingId, id)).orderBy(tickets.createdAt, tickets.id);
      counts.tickets += issued.length;
      for (const t of issued.slice(0, b.checkedIn ?? 0)) {
        const when = new Date(now - (20 + counts.checkins * 3) * 60e3);
        await tx.update(tickets).set({ status: "used", checkedInAt: when, checkedInBy: door }).where(eq(tickets.id, t.id));
        await tx.insert(checkins).values({ id: nanoid(14), ticketId: t.id, eventId: ev.id, scannerUserId: door, deviceId: "demo-seed", scannedAt: when, result: "ok" });
        counts.checkins++;
      }
    }
    return id;
  }

  const [vol3, hike, anime] = sampleEvents();

  // 1. Live now: the door crew's event. Started an hour ago, a third of the room is in.
  const live = await addEvent({
    slug: "open-mic-at-the-pines",
    title: "Open Mic at the Pines",
    tagline: "Bring a song, a poem, or just your ears.",
    venueName: "Pine Grove Café",
    venueAddress: "Session Rd, Baguio City",
    startsAt: new Date(now - HOUR),
    endsAt: new Date(now + 4 * HOUR),
    status: "published",
    category: "gig",
    ticketStyle: "campfire-stamp",
    descriptionMd: "Sign-up sheet at the door. Five minutes each, house guitar provided.",
    gcashName: "Baguio Base Camp",
    gcashNumber: "0917 000 0000",
    tiers: [
      { name: "Walk-in", priceCents: 15000, quantity: 60, perOrderLimit: 4 },
      { name: "Performer", description: "Free for performers", priceCents: 0, quantity: 15, perOrderLimit: 1 },
    ],
  });
  // The member's pair: one ticket already scanned, one still valid to show at the door
  await addBooking(live, { userId: member, lines: [{ tier: "Walk-in", qty: 2 }], status: "approved", checkedIn: 1 });
  for (let n = 1; n <= 8; n++) {
    await addBooking(live, { userId: fake(n), lines: [{ tier: n <= 6 ? "Walk-in" : "Performer", qty: n <= 6 ? 3 : 1 }], status: "approved", checkedIn: n <= 4 ? 2 : 0 });
  }

  // 2. Paid gig in 12 days: the organiser's review queue and the member's unpaid hold
  const gig = await addEvent({ ...vol3, category: "gig" });
  await addBooking(gig, { userId: member, lines: [{ tier: "Regular", qty: 2 }], status: "pending_payment", expiresAt: new Date(now + 20 * HOUR) });
  for (const n of [1, 2, 3]) await addBooking(gig, { userId: fake(n), lines: [{ tier: n === 1 ? "Early Bird" : "Regular", qty: n }], status: "under_review", receipt: true });
  await addBooking(gig, {
    userId: fake(4),
    lines: [{ tier: "Regular", qty: 1 }],
    status: "rejected",
    receipt: true,
    reviewNote: "The amount on the receipt is ₱300, the ticket is ₱350. Send the ₱50 balance and upload both receipts.",
    expiresAt: new Date(now + 22 * HOUR),
  });
  await addBooking(gig, { userId: fake(5), lines: [{ tier: "Early Bird", qty: 2 }], status: "expired", expiresAt: new Date(now - 3 * HOUR) });
  await addBooking(gig, { userId: fake(6), lines: [{ tier: "Regular", qty: 1 }], status: "cancelled", expiresAt: new Date(now + 5 * HOUR) });
  await addBooking(gig, { userId: fake(7), lines: [{ tier: "Early Bird", qty: 2 }], status: "approved" });

  // 3. Free hike: nothing booked by the member, so they can show instant free tickets
  const free = await addEvent({ ...hike, category: "outdoors" });
  for (const n of [2, 5, 8]) await addBooking(free, { userId: fake(n), lines: [{ tier: "Hiker", qty: 1 + (n % 2) }], status: "approved" });

  // 4. Sold out in a week, three people waiting. One hold lapses in 5 minutes:
  //    "Expire hold now" → "Run cron" → the waitlist email lands in the outbox.
  const soldOut = await addEvent({
    slug: "cabin-fever-acoustic-night",
    title: "Cabin Fever: Acoustic Night",
    tagline: "Ten seats, one fireplace.",
    venueName: "The Log Cabin",
    venueAddress: "Camp John Hay, Baguio City",
    startsAt: at(7, 19),
    endsAt: at(7, 22),
    status: "published",
    category: "gig",
    ticketStyle: "ridge-line",
    descriptionMd: "An intimate unplugged set. Hot cocoa included.",
    gcashName: "Baguio Base Camp",
    gcashNumber: "0917 000 0000",
    tiers: [{ name: "Seat", priceCents: 50000, quantity: 10, perOrderLimit: 4 }],
  });
  await addBooking(soldOut, { userId: fake(1), lines: [{ tier: "Seat", qty: 4 }], status: "approved" });
  await addBooking(soldOut, { userId: fake(3), lines: [{ tier: "Seat", qty: 4 }], status: "approved" });
  await addBooking(soldOut, { userId: fake(6), lines: [{ tier: "Seat", qty: 2 }], status: "pending_payment", expiresAt: new Date(now + 5 * 60e3) });
  await tx.insert(waitlist).values([fake(2), fake(4), fake(8)].map((userId, i) => ({ id: nanoid(12), eventId: soldOut.id, userId, createdAt: new Date(now - (3 - i) * HOUR) })));

  // 5. Draft: shows the organiser's publish step
  await addEvent({ ...anime, category: "other" });

  // 6. Two weeks ago: the member's ticket stub
  const past = await addEvent({
    slug: "base-camp-sessions-vol-2",
    title: "Base Camp Sessions Vol. 2",
    tagline: "Where it all started (again).",
    venueName: "Canto, Ketchup Food Community",
    venueAddress: "Romulo Dr, Baguio City",
    startsAt: new Date(now - 14 * day),
    endsAt: new Date(now - 14 * day + 4 * HOUR),
    status: "published",
    category: "gig",
    ticketStyle: "summit",
    descriptionMd: "Thanks to everyone who came out.",
    tiers: [{ name: "Regular", priceCents: 30000, quantity: 100, perOrderLimit: 4 }],
  });
  await addBooking(past, { userId: member, lines: [{ tier: "Regular", qty: 1 }], status: "approved", checkedIn: 1 });
  for (const n of [1, 3, 5, 7]) await addBooking(past, { userId: fake(n), lines: [{ tier: "Regular", qty: 2 }], status: "approved", checkedIn: 2 });

  return { ...counts, waitlist: 3, personas: PERSONA_IDS.length, fakes: FAKES.length };
}
