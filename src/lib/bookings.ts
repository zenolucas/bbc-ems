import "server-only";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { bookingItems, bookings, events, ticketTiers, tickets, users } from "@/db/schema";
import { tierIsOnSale } from "./events";
import { generateShortCode } from "./tickets/shortcode";
import { issueSignature, newTicketId } from "./tickets/server";

export class BookingError extends Error {}

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
        and(
          eq(bookings.eventId, event.id),
          sql`(${bookings.status} = 'approved' or ${bookings.status} = 'under_review' or (${bookings.status} = 'pending_payment' and (${bookings.expiresAt} is null or ${bookings.expiresAt} > ${now})))`,
        ),
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

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function issueTicketsTx(tx: Tx, bookingId: string) {
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
  if (b.status === "expired" || (b.status === "pending_payment" && b.expiresAt && b.expiresAt < new Date())) {
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
    const b = await tx.query.bookings.findFirst({ where: eq(bookings.id, bookingId) });
    if (!b) throw new BookingError("Booking not found");
    if (b.status === "approved") return;
    if (b.status !== "under_review" && b.status !== "pending_payment") throw new BookingError(`Cannot approve a ${b.status} booking`);
    await tx.update(bookings).set({ status: "approved", reviewedBy: adminId, reviewedAt: new Date(), reviewNote: null, updatedAt: new Date() }).where(eq(bookings.id, bookingId));
    await issueTicketsTx(tx, bookingId);
  });
}

export async function rejectBooking(adminId: string, bookingId: string, note: string) {
  const b = await db.query.bookings.findFirst({ where: eq(bookings.id, bookingId) });
  if (!b) throw new BookingError("Booking not found");
  if (b.status !== "under_review" && b.status !== "pending_payment") throw new BookingError(`Cannot reject a ${b.status} booking`);
  await db
    .update(bookings)
    .set({ status: "rejected", reviewedBy: adminId, reviewedAt: new Date(), reviewNote: note || null, updatedAt: new Date() })
    .where(eq(bookings.id, bookingId));
}

export async function cancelBooking(userId: string, bookingId: string) {
  const b = await db.query.bookings.findFirst({ where: and(eq(bookings.id, bookingId), eq(bookings.userId, userId)) });
  if (!b) throw new BookingError("Booking not found");
  if (!["pending_payment", "under_review"].includes(b.status)) throw new BookingError("Only unpaid bookings can be cancelled");
  await db.update(bookings).set({ status: "cancelled", updatedAt: new Date() }).where(eq(bookings.id, bookingId));
}

/** Expires overdue holds. Returns how many were expired. */
export async function expireOverdueBookings() {
  const rows = await db
    .update(bookings)
    .set({ status: "expired", updatedAt: new Date() })
    .where(and(eq(bookings.status, "pending_payment"), lt(bookings.expiresAt, new Date())))
    .returning({ id: bookings.id });
  return rows.length;
}

export async function getBookingForUser(bookingId: string, userId: string, isAdmin = false) {
  const b = await db.query.bookings.findFirst({
    where: isAdmin ? eq(bookings.id, bookingId) : and(eq(bookings.id, bookingId), eq(bookings.userId, userId)),
    with: {
      event: true,
      items: { with: { tier: true } },
      tickets: { with: { tier: true } },
      user: true,
    },
  });
  return b ?? null;
}

export async function listUserBookings(userId: string) {
  return db.query.bookings.findMany({
    where: eq(bookings.userId, userId),
    orderBy: (b, { desc }) => desc(b.createdAt),
    with: { event: true, items: { with: { tier: true } }, tickets: { with: { tier: true } } },
  });
}

export async function voidTicket(ticketId: string) {
  await db.update(tickets).set({ status: "void" }).where(eq(tickets.id, ticketId));
}

export async function usersByIds(ids: string[]) {
  if (!ids.length) return [];
  return db.select().from(users).where(inArray(users.id, ids));
}
