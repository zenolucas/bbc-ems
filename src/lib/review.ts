import "server-only";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import type { ReviewHintsDTO } from "@bbc/shared/admin-types";
import { db } from "@/db/client";
import { bookings } from "@/db/schema";

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * What the review queue tells an organiser about each booking: whether it's the
 * member's first booking with us, and whether its GCash reference already appears
 * on another booking (the duplicate-receipt tell). Shared by the web review list
 * and /api/v1/admin/review.
 */
export async function reviewHints(rows: { id: string; userId: string; paymentRef: string | null }[]) {
  const userIds = [...new Set(rows.map((r) => r.userId))];
  const refs = [...new Set(rows.map((r) => r.paymentRef?.replace(/\s+/g, "")).filter((x): x is string => !!x))];
  const [history, refUse] = await Promise.all([
    // How many bookings each member has made with us, oldest first, to say "2nd booking with us"
    userIds.length
      ? db.select({ id: bookings.id, userId: bookings.userId }).from(bookings).where(and(inArray(bookings.userId, userIds), ne(bookings.status, "expired"))).orderBy(asc(bookings.createdAt))
      : Promise.resolve([]),
    // The same GCash reference on two bookings is the duplicate-receipt tell
    refs.length
      ? db.select({ id: bookings.id, ref: sql<string>`replace(${bookings.paymentRef}, ' ', '')` }).from(bookings).where(and(sql`replace(${bookings.paymentRef}, ' ', '') in ${refs}`, ne(bookings.status, "cancelled")))
      : Promise.resolve([]),
  ]);
  const out = new Map<string, ReviewHintsDTO & { otherBookings: number }>();
  for (const b of rows) {
    const mine = history.filter((h) => h.userId === b.userId);
    const nth = mine.findIndex((h) => h.id === b.id) + 1;
    const ref = b.paymentRef?.replace(/\s+/g, "");
    const others = ref ? refUse.filter((r) => r.ref === ref && r.id !== b.id) : [];
    out.set(b.id, {
      history: nth > 1 ? `${ordinal(nth)} booking with us` : "First booking with us",
      refCheck: !b.paymentRef ? null : others.length ? { ok: false, text: `also on ${others.length === 1 ? `booking ${others[0].id}` : `${others.length} other bookings`}` } : { ok: true, text: "not used on another booking" },
      otherBookings: mine.filter((h) => h.id !== b.id).length,
    });
  }
  return out;
}

/** Receipts waiting for an organiser, oldest first (first come, first served), across events or for one. */
export async function listReviewQueue(eventId?: string) {
  const rows = await db.query.bookings.findMany({
    where: and(eq(bookings.status, "under_review"), eventId ? eq(bookings.eventId, eventId) : undefined),
    orderBy: [sql`${bookings.submittedAt} asc nulls last`, asc(bookings.createdAt)],
    with: { user: true, event: true, items: { with: { tier: true } } },
  });
  const hints = await reviewHints(rows);
  return rows.map((b) => ({ ...b, hints: hints.get(b.id)! }));
}
