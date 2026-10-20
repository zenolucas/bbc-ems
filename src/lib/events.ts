import "server-only";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { bookingItems, bookings, events, ticketTiers, tickets } from "@/db/schema";

export const HOLDING_STATUSES = ["pending_payment", "under_review", "approved"] as const;

/**
 * Bookings that hold inventory: approved, under review, and unpaid or rejected
 * holds whose deadline hasn't passed. Rejected bookings keep their seats for a
 * fresh hold window so the member can resubmit without overselling.
 */
export function holdingCondition(now = new Date()) {
  return sql`(${bookings.status} in ('approved', 'under_review')
    or (${bookings.status} = 'pending_payment' and (${bookings.expiresAt} is null or ${bookings.expiresAt} > ${now}))
    or (${bookings.status} = 'rejected' and ${bookings.expiresAt} > ${now}))`;
}

export async function listPublishedEvents() {
  const now = new Date();
  const upcoming = await db.query.events.findMany({
    where: and(eq(events.status, "published"), gte(sql`coalesce(${events.endsAt}, ${events.startsAt} + interval '6 hours')`, now)),
    orderBy: asc(events.startsAt),
    with: { tiers: { orderBy: asc(ticketTiers.sortOrder) } },
  });
  const past = await db.query.events.findMany({
    where: and(inArray(events.status, ["published", "ended"]), sql`coalesce(${events.endsAt}, ${events.startsAt} + interval '6 hours') < ${now}`),
    orderBy: desc(events.startsAt),
    limit: 6,
    with: { tiers: { orderBy: asc(ticketTiers.sortOrder) } },
  });
  const held = await heldByTier(upcoming.map((e) => e.id));
  const now2 = new Date();
  const withAvailability = upcoming.map((e) => {
    const open = e.tiers.filter((t) => tierIsOnSale(t, now2));
    const remaining = open.reduce((n, t) => n + Math.max(0, t.quantity - (held.get(t.id) ?? 0)), 0);
    const availability: "sold-out" | "few-left" | "available" | "not-on-sale" =
      e.tiers.length > 0 && open.length === 0 ? "not-on-sale" : remaining === 0 ? "sold-out" : remaining <= 10 ? "few-left" : "available";
    return { ...e, availability };
  });
  return { upcoming: withAvailability, past };
}

export async function heldByTier(eventIds: string[]) {
  if (eventIds.length === 0) return new Map<string, number>();
  const rows = await db
    .select({ tierId: bookingItems.tierId, held: sql<number>`coalesce(sum(${bookingItems.quantity}), 0)::int` })
    .from(bookingItems)
    .innerJoin(bookings, eq(bookings.id, bookingItems.bookingId))
    .where(and(inArray(bookings.eventId, eventIds), holdingCondition()))
    .groupBy(bookingItems.tierId);
  return new Map(rows.map((r) => [r.tierId, r.held]));
}

/** The member's live booking for an event (not cancelled or expired), if any. */
export async function activeBookingFor(userId: string, eventId: string) {
  const rows = await db.query.bookings.findMany({
    where: and(eq(bookings.userId, userId), eq(bookings.eventId, eventId), inArray(bookings.status, ["pending_payment", "under_review", "approved", "rejected"])),
    orderBy: desc(bookings.createdAt),
    with: { items: true },
  });
  const now = new Date();
  return rows.find((b) => !((b.status === "pending_payment" || b.status === "rejected") && b.expiresAt && b.expiresAt < now)) ?? null;
}

export async function getEventBySlug(slug: string) {
  return db.query.events.findFirst({
    where: eq(events.slug, slug),
    with: { tiers: { orderBy: asc(ticketTiers.sortOrder) } },
  });
}

export async function getEventById(id: string) {
  return db.query.events.findFirst({
    where: eq(events.id, id),
    with: { tiers: { orderBy: asc(ticketTiers.sortOrder) } },
  });
}

/** Quantity held per tier, see holdingCondition(). */
export async function tierAvailability(eventId: string) {
  const now = new Date();
  const rows = await db
    .select({
      tierId: bookingItems.tierId,
      held: sql<number>`coalesce(sum(${bookingItems.quantity}), 0)::int`,
    })
    .from(bookingItems)
    .innerJoin(bookings, eq(bookings.id, bookingItems.bookingId))
    .where(
      and(
        eq(bookings.eventId, eventId),
        holdingCondition(now),
      ),
    )
    .groupBy(bookingItems.tierId);
  const held = new Map(rows.map((r) => [r.tierId, r.held]));
  return (tier: { id: string; quantity: number }) => ({
    held: held.get(tier.id) ?? 0,
    remaining: Math.max(0, tier.quantity - (held.get(tier.id) ?? 0)),
  });
}

export async function eventStats(eventId: string) {
  const [row] = await db
    .select({
      issued: sql<number>`count(*)::int`,
      used: sql<number>`count(*) filter (where ${tickets.status} = 'used')::int`,
    })
    .from(tickets)
    .where(eq(tickets.eventId, eventId));
  const [pending] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(bookings)
    .where(and(eq(bookings.eventId, eventId), eq(bookings.status, "under_review")));
  return { issued: row?.issued ?? 0, used: row?.used ?? 0, pendingReview: pending?.n ?? 0 };
}

export function tierIsOnSale(t: { salesStart: Date | null; salesEnd: Date | null }, now = new Date()) {
  if (t.salesStart && t.salesStart > now) return false;
  if (t.salesEnd && t.salesEnd < now) return false;
  return true;
}

export type PublishCheck = { label: string; ok: boolean; required: boolean };

/** What the Status card shows before publishing. Required items block publish. */
export function publishChecklist(e: { startsAt: Date; coverImageUrl: string | null; gcashNumber: string | null; gcashQrUrl: string | null; venueName: string; descriptionMd: string }, tiers: { priceCents: number; quantity: number }[]): PublishCheck[] {
  const paid = tiers.some((t) => t.priceCents > 0);
  return [
    { label: "At least one ticket tier", ok: tiers.length > 0 && tiers.some((t) => t.quantity > 0), required: true },
    { label: "Starts in the future", ok: e.startsAt > new Date(), required: true },
    ...(paid ? [{ label: "GCash/Maya number or QR for paid tiers", ok: Boolean(e.gcashNumber || e.gcashQrUrl), required: true }] : []),
    { label: "Poster image", ok: Boolean(e.coverImageUrl), required: false },
    { label: "Description", ok: e.descriptionMd.trim().length > 20, required: false },
  ];
}

/** Bookings waiting for an organiser, per event. */
export async function pendingReviewByEvent() {
  const rows = await db
    .select({ eventId: bookings.eventId, n: sql<number>`count(*)::int` })
    .from(bookings)
    .where(eq(bookings.status, "under_review"))
    .groupBy(bookings.eventId);
  return new Map(rows.map((r) => [r.eventId, r.n]));
}

export function eventEndsAt(e: { startsAt: Date; endsAt: Date | null }) {
  return e.endsAt ?? new Date(e.startsAt.getTime() + 6 * 3600e3);
}
