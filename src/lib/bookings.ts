import "server-only";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { bookingItems, bookings, events, ticketTiers, tickets, users } from "@/db/schema";
import { holdingCondition, tierIsOnSale } from "./events";
import { generateShortCode } from "./tickets/shortcode";
import { issueSignature, newTicketId } from "./tickets/server";

export class BookingError extends Error {}

/**
 * The status a member should see. Overdue holds read as expired before the
 * cron sweeps them, so the booking page and /me never disagree.
 */
export function effectiveStatus(b: { status: string; expiresAt: Date | null }) {
  if ((b.status === "pending_payment" || b.status === "rejected") && b.expiresAt && b.expiresAt < new Date()) return "expired" as const;
  return b.status as (typeof bookings.$inferSelect)["status"];
}

export type BookingRequest = { eventId: string; items: { tierId: string; quantity: number }[] };

/**
 * Creates a booking, reserving quantity. Runs inside a transaction that locks
 * the tier rows so two people cannot both grab the last ticket.
 */
export async function createBooking(userId: string, req: BookingRequest) {
  // Merge duplicate tiers so limits apply to the whole order, not per line.
  const merged = new Map<string, number>();
  for (const i of req.items) if (i.quantity > 0) merged.set(i.tierId, (merged.get(i.tierId) ?? 0) + Math.floor(i.quantity));
  const items = [...merged].map(([tierId, quantity]) => ({ tierId, quantity }));
  if (items.length === 0) throw new BookingError("Pick at least one ticket");

  return db.transaction(async (tx) => {
    const event = await tx.query.events.findFirst({ where: eq(events.id, req.eventId) });
    if (!event || event.status !== "published") throw new BookingError("This event is not open for booking");
    const endsAt = event.endsAt ?? new Date(event.startsAt.getTime() + 6 * 3600e3);
    if (endsAt < new Date()) throw new BookingError("This event has already ended");

    // Lock tiers for this event
    const tiers = await tx
      .select()
      .from(ticketTiers)
      .where(eq(ticketTiers.eventId, event.id))
      .for("update");
    const now = new Date();
    const held = await tx
      .select({ tierId: bookingItems.tierId, held: sql<number>`coalesce(sum(${bookingItems.quantity}), 0)::int` })
      .from(bookingItems)
      .innerJoin(bookings, eq(bookings.id, bookingItems.bookingId))
      .where(
        and(eq(bookings.eventId, event.id), holdingCondition(now)),
      )
      .groupBy(bookingItems.tierId);
    const heldMap = new Map(held.map((h) => [h.tierId, h.held]));

    let total = 0;
    const lines: { tierId: string; quantity: number; unitPriceCents: number }[] = [];
    for (const item of items) {
      const tier = tiers.find((t) => t.id === item.tierId);
      if (!tier) throw new BookingError("Unknown ticket tier");
      if (!tierIsOnSale(tier, now)) throw new BookingError(`${tier.name} is not on sale right now`);
      if (item.quantity > tier.perOrderLimit) throw new BookingError(`Max ${tier.perOrderLimit} per order for ${tier.name}`);
      const remaining = tier.quantity - (heldMap.get(tier.id) ?? 0);
      if (item.quantity > remaining) {
        throw new BookingError(remaining <= 0 ? `${tier.name} is sold out` : `Only ${remaining} left for ${tier.name}`);
      }
      total += tier.priceCents * item.quantity;
      lines.push({ tierId: tier.id, quantity: item.quantity, unitPriceCents: tier.priceCents });
    }

    const id = nanoid(12);
    const free = total === 0;
    await tx.insert(bookings).values({
      id,
      eventId: event.id,
      userId,
      status: free ? "approved" : "pending_payment",
      totalCents: total,
      expiresAt: free ? null : new Date(Date.now() + event.bookingHoldHours * 3600e3),
      reviewedAt: free ? new Date() : null,
    });
    await tx.insert(bookingItems).values(lines.map((l) => ({ id: nanoid(12), bookingId: id, ...l })));
    if (free) await issueTicketsTx(tx, id);
    return { id, free };
  });
}

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function issueTicketsTx(tx: Tx, bookingId: string) {
  const booking = await tx.query.bookings.findFirst({
    where: eq(bookings.id, bookingId),
    with: { items: true, user: true },
  });
  if (!booking) throw new BookingError("Booking not found");
  const existing = await tx.select({ n: sql<number>`count(*)::int` }).from(tickets).where(eq(tickets.bookingId, bookingId));
  if (existing[0].n > 0) return; // idempotent
  const rows = [];
  for (const item of booking.items) {
    for (let k = 0; k < item.quantity; k++) {
      const id = newTicketId();
      rows.push({
        id,
        shortCode: generateShortCode(),
        bookingId,
        eventId: booking.eventId,
        tierId: item.tierId,
        userId: booking.userId,
        holderName: booking.user.name || booking.user.email.split("@")[0],
        signature: await issueSignature(id, booking.eventId),
      });
    }
  }
  await tx.insert(tickets).values(rows);
}

export async function submitPayment(userId: string, bookingId: string, data: { paymentRef: string; paymentProofUrl: string }) {
  const b = await db.query.bookings.findFirst({ where: and(eq(bookings.id, bookingId), eq(bookings.userId, userId)) });
  if (!b) throw new BookingError("Booking not found");
  if (effectiveStatus(b) === "expired") {
    throw new BookingError("This reservation has expired. Please book again.");
  }
  if (b.status !== "pending_payment" && b.status !== "rejected") throw new BookingError("This booking is not awaiting payment");
  await db
    .update(bookings)
    .set({ status: "under_review", paymentRef: data.paymentRef, paymentProofUrl: data.paymentProofUrl, submittedAt: new Date(), reviewNote: null, updatedAt: new Date() })
    .where(eq(bookings.id, bookingId));
}

export async function approveBooking(adminId: string, bookingId: string) {
  return db.transaction(async (tx) => {
    const b = await tx.query.bookings.findFirst({ where: eq(bookings.id, bookingId), with: { event: true, items: true } });
    if (!b) throw new BookingError("Booking not found");
    // Already approved (a double tap, two organisers at once): nothing to do, and nothing to email
    if (b.status === "approved") return { changed: false, userId: b.userId };
    // Rejected is allowed so a mistaken rejection can be undone.
    if (!["under_review", "pending_payment", "rejected"].includes(b.status)) throw new BookingError(`Can't approve a booking that is ${b.status.replace("_", " ")}`);
    if (b.event.status === "cancelled") throw new BookingError("This event was cancelled");
    if (b.event.status === "draft") throw new BookingError("Publish the event before approving bookings");

    // A lapsed hold (expired but not yet swept, or a rejection past its window) no longer
    // reserves seats, so check there's still room before turning it into tickets.
    if (effectiveStatus(b) === "expired") {
      const tiers = await tx.select().from(ticketTiers).where(eq(ticketTiers.eventId, b.eventId)).for("update");
      const held = await tx
        .select({ tierId: bookingItems.tierId, held: sql<number>`coalesce(sum(${bookingItems.quantity}), 0)::int` })
        .from(bookingItems)
        .innerJoin(bookings, eq(bookings.id, bookingItems.bookingId))
        .where(and(eq(bookings.eventId, b.eventId), holdingCondition()))
        .groupBy(bookingItems.tierId);
      const heldMap = new Map(held.map((h) => [h.tierId, h.held]));
      for (const item of b.items) {
        const tier = tiers.find((t) => t.id === item.tierId);
        const left = (tier?.quantity ?? 0) - (heldMap.get(item.tierId) ?? 0);
        if (item.quantity > left) throw new BookingError(`This hold lapsed and ${tier?.name ?? "the tier"} only has ${Math.max(0, left)} left. Raise the quantity first or ask them to rebook.`);
      }
    }
    await tx.update(bookings).set({ status: "approved", reviewedBy: adminId, reviewedAt: new Date(), reviewNote: null, updatedAt: new Date() }).where(eq(bookings.id, bookingId));
    await issueTicketsTx(tx, bookingId);
    return { changed: true, userId: b.userId };
  });
}

export async function rejectBooking(adminId: string, bookingId: string, note: string) {
  if (!note.trim()) throw new BookingError("Tell the member what to fix");
  const b = await db.query.bookings.findFirst({ where: eq(bookings.id, bookingId), with: { event: true } });
  if (!b) throw new BookingError("Booking not found");
  if (b.status !== "under_review" && b.status !== "pending_payment") throw new BookingError(`Cannot reject a ${b.status} booking`);
  // A fresh hold window: the seats stay reserved while the member fixes the payment.
  const expiresAt = new Date(Date.now() + b.event.bookingHoldHours * 3600e3);
  await db
    .update(bookings)
    .set({ status: "rejected", reviewedBy: adminId, reviewedAt: new Date(), reviewNote: note || null, expiresAt, updatedAt: new Date() })
    .where(eq(bookings.id, bookingId));
}

export async function cancelBooking(userId: string, bookingId: string) {
  const b = await db.query.bookings.findFirst({ where: and(eq(bookings.id, bookingId), eq(bookings.userId, userId)) });
  if (!b) throw new BookingError("Booking not found");
  if (!["pending_payment", "under_review", "rejected"].includes(b.status)) {
    throw new BookingError(b.status === "approved" ? "Confirmed bookings can't be cancelled here. Message the organisers for a refund." : "This booking can no longer be cancelled");
  }
  await db.update(bookings).set({ status: "cancelled", updatedAt: new Date() }).where(eq(bookings.id, bookingId));
}

/** Expires overdue unpaid and rejected holds. Returns how many were expired. */
export async function expireOverdueBookings() {
  const rows = await db
    .update(bookings)
    .set({ status: "expired", updatedAt: new Date() })
    .where(and(inArray(bookings.status, ["pending_payment", "rejected"]), lt(bookings.expiresAt, new Date())))
    .returning({ id: bookings.id });
  return rows.length;
}

export async function getBookingForUser(bookingId: string, userId: string, isAdmin = false) {
  const b = await db.query.bookings.findFirst({
    where: isAdmin ? eq(bookings.id, bookingId) : and(eq(bookings.id, bookingId), eq(bookings.userId, userId)),
    with: {
      event: true,
      items: { with: { tier: true } },
      // Same order as the ticket page's "2 of 3" navigation
      tickets: { with: { tier: true }, orderBy: (t, { asc }) => [asc(t.createdAt), asc(t.id)] },
      user: true,
    },
  });
  return b ?? null;
}

export async function listUserBookings(userId: string) {
  return db.query.bookings.findMany({
    where: eq(bookings.userId, userId),
    orderBy: (b, { desc }) => desc(b.createdAt),
    with: { event: true, items: { with: { tier: true } }, tickets: { with: { tier: true }, orderBy: (t, { asc }) => [asc(t.createdAt), asc(t.id)] } },
  });
}

/** Lets the booker put a guest's name on one of their tickets. */
export async function renameTicket(userId: string, ticketId: string, name: string) {
  const clean = name.replace(/\s+/g, " ").trim();
  if (clean.length < 1 || clean.length > 60) throw new BookingError("Names must be 1 to 60 characters");
  const t = await db.query.tickets.findFirst({ where: and(eq(tickets.id, ticketId), eq(tickets.userId, userId)) });
  if (!t) throw new BookingError("Ticket not found");
  if (t.status !== "valid") throw new BookingError(t.status === "used" ? "This ticket was already checked in" : "This ticket is voided");
  await db.update(tickets).set({ holderName: clean }).where(eq(tickets.id, ticketId));
  return { bookingId: t.bookingId };
}

export async function voidTicket(ticketId: string) {
  await db.update(tickets).set({ status: "void" }).where(eq(tickets.id, ticketId));
}

export async function usersByIds(ids: string[]) {
  if (!ids.length) return [];
  return db.select().from(users).where(inArray(users.id, ids));
}

/** The member's live tickets (valid or used, never void), soonest event first. */
export async function listUserTickets(userId: string) {
  const rows = await db.query.tickets.findMany({
    where: and(eq(tickets.userId, userId), inArray(tickets.status, ["valid", "used"])),
    with: { tier: true, event: true },
    orderBy: (t, { asc }) => [asc(t.createdAt), asc(t.id)],
  });
  return rows.sort((a, b) => a.event.startsAt.getTime() - b.event.startsAt.getTime());
}

export async function getTicketForUser(ticketId: string, userId: string) {
  const t = await db.query.tickets.findFirst({
    where: and(eq(tickets.id, ticketId), eq(tickets.userId, userId)),
    with: { tier: true, event: true },
  });
  return t ?? null;
}
