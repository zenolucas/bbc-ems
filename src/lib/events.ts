import "server-only";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { bookingItems, bookings, events, ticketTiers, tickets } from "@/db/schema";

export const HOLDING_STATUSES = ["pending_payment", "under_review", "approved"] as const;

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
  return { upcoming, past };
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

/** Quantity held per tier: approved + unexpired pending/under-review bookings. */
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
        sql`(${bookings.status} = 'approved' or ${bookings.status} = 'under_review' or (${bookings.status} = 'pending_payment' and (${bookings.expiresAt} is null or ${bookings.expiresAt} > ${now})))`,
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
