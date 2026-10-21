import "server-only";
import { and, eq, exists, gt, inArray, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { bookings, events, pushTokens } from "@/db/schema";
import { fmtDateTime, fmtTime, peso } from "./format";
import { sendPushOnce } from "./push";

const HOUR = 3600e3;

/** Only members with the app installed; otherwise the log would swallow reminders they can never get. */
const hasApp = exists(db.select({ x: pushTokens.id }).from(pushTokens).where(eq(pushTokens.userId, bookings.userId)));

/**
 * Push reminders, run by the 15-minute cron: unpaid holds about to lapse, and
 * events starting within a day. Each goes out once (see sendPushOnce).
 */
export async function sendReminders(now = new Date()) {
  let sent = 0;

  const lapsing = await db
    .select({ id: bookings.id, userId: bookings.userId, expiresAt: bookings.expiresAt, totalCents: bookings.totalCents, title: events.title })
    .from(bookings)
    .innerJoin(events, eq(events.id, bookings.eventId))
    .where(and(inArray(bookings.status, ["pending_payment", "rejected"]), gt(bookings.expiresAt, now), lt(bookings.expiresAt, new Date(now.getTime() + 2 * HOUR)), hasApp));
  for (const b of lapsing) {
    const ok = await sendPushOnce(b.userId, "hold-expiring", b.id, {
      title: `Your hold ends at ${fmtTime(b.expiresAt!)}`,
      body: `Send ${peso(b.totalCents)} and upload the receipt to keep your ${b.title} tickets.`,
      url: `/bookings/${b.id}`,
    });
    if (ok) sent++;
  }

  const soon = await db
    .select({ id: bookings.id, userId: bookings.userId, startsAt: events.startsAt, title: events.title, venue: events.venueName })
    .from(bookings)
    .innerJoin(events, eq(events.id, bookings.eventId))
    .where(and(eq(bookings.status, "approved"), eq(events.status, "published"), gt(events.startsAt, now), lt(events.startsAt, new Date(now.getTime() + 24 * HOUR)), hasApp));
  for (const b of soon) {
    const ok = await sendPushOnce(b.userId, "event-soon", b.id, {
      title: b.startsAt.getTime() - now.getTime() < 6 * HOUR ? `${b.title} starts at ${fmtTime(b.startsAt)}` : `Coming up: ${b.title}`,
      body: `${fmtDateTime(b.startsAt)} at ${b.venue}. Your tickets are saved in the app, signal or not.`,
      url: "/tickets",
    });
    if (ok) sent++;
  }
  return sent;
}
