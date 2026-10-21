import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { events, users, waitlist } from "@/db/schema";
import { renderSeatsOpenEmail } from "@/emails/waitlist";
import { sendEmail } from "./email";
import { tierAvailability, tierIsOnSale } from "./events";
import { fmtRange } from "./format";
import { sendPush } from "./push";

/** Joining again after a notification puts you back in line (clears notified_at). */
export async function joinWaitlist(userId: string, eventId: string) {
  await db
    .insert(waitlist)
    .values({ id: nanoid(12), eventId, userId })
    .onConflictDoUpdate({ target: [waitlist.eventId, waitlist.userId], set: { notifiedAt: null, createdAt: new Date() } });
}

export async function leaveWaitlist(userId: string, eventId: string) {
  await db.delete(waitlist).where(and(eq(waitlist.userId, userId), eq(waitlist.eventId, eventId)));
}

/** True while the member is waiting and hasn't been told yet. */
export async function isOnWaitlist(userId: string, eventId: string) {
  const row = await db.query.waitlist.findFirst({ where: and(eq(waitlist.userId, userId), eq(waitlist.eventId, eventId), isNull(waitlist.notifiedAt)) });
  return Boolean(row);
}

/** Seats bookable right now across the tiers on sale. */
async function seatsOpen(eventId: string) {
  const ev = await db.query.events.findFirst({ where: eq(events.id, eventId), with: { tiers: true } });
  if (!ev || ev.status !== "published") return { ev: null, left: 0 };
  const endsAt = ev.endsAt ?? new Date(ev.startsAt.getTime() + 6 * 3600e3);
  if (endsAt < new Date()) return { ev: null, left: 0 };
  const avail = await tierAvailability(eventId);
  const left = ev.tiers.filter((t) => tierIsOnSale(t)).reduce((n, t) => n + avail(t).remaining, 0);
  return { ev, left };
}

/**
 * Tells everyone still waiting for this event, if seats are open. Each person is told once
 * (notified_at), by email and push. Returns how many were told. Never throws: called after
 * cancellations and from the cron, where a failed email mustn't undo anything.
 */
export async function notifyWaitlist(eventId: string) {
  try {
    const { ev, left } = await seatsOpen(eventId);
    if (!ev || left <= 0) return 0;
    // Claim the rows first, so an overlapping cron run can't send twice
    const claimed = await db
      .update(waitlist)
      .set({ notifiedAt: new Date() })
      .where(and(eq(waitlist.eventId, eventId), isNull(waitlist.notifiedAt)))
      .returning({ userId: waitlist.userId });
    for (const { userId } of claimed) {
      const u = await db.query.users.findFirst({ where: eq(users.id, userId) });
      if (!u) continue;
      const when = fmtRange(ev.startsAt, ev.endsAt);
      try {
        const { html, text } = await renderSeatsOpenEmail({ eventTitle: ev.title, slug: ev.slug, left, recipient: u.email, when, venue: ev.venueName, venueAddress: ev.venueAddress, mapUrl: ev.mapUrl });
        await Promise.all([
          sendEmail({ to: u.email, subject: `Tickets just opened up · ${ev.title}`, html, text }),
          sendPush(userId, { title: "Tickets just opened up", body: `${ev.title} · ${left === 1 ? "1 ticket" : `${left} tickets`} back. First to book gets them.`, url: `/events/${ev.slug}` }),
        ]);
      } catch (e) {
        console.error("[waitlist] notify", userId, e);
      }
    }
    return claimed.length;
  } catch (e) {
    console.error("[waitlist]", eventId, e);
    return 0;
  }
}

/** Cron: every event that has people waiting. Seats free up through expiry, rejection lapses and organiser edits too. */
export async function notifyAllWaitlists() {
  const rows = await db.selectDistinct({ eventId: waitlist.eventId }).from(waitlist).where(isNull(waitlist.notifiedAt));
  let told = 0;
  for (const r of rows) told += await notifyWaitlist(r.eventId);
  return told;
}
