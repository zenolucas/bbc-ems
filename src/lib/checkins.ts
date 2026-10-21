import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { checkins, events, tickets, ticketTiers } from "@/db/schema";
import type { CheckinOutcome, IncomingCheckin, Manifest } from "@bbc/shared/scan-types";
import { publicKeyJwkB64 } from "./tickets/server";

export type { CheckinOutcome, IncomingCheckin, LocalResult, Manifest, ManifestTicket } from "@bbc/shared/scan-types";

/** Published events that haven't been over for more than a day. */
export function listDoorEvents() {
  const endsAt = sql`coalesce(${events.endsAt}, ${events.startsAt} + interval '6 hours')`;
  // A join rather than correlated subqueries: drizzle leaves columns unqualified in
  // single-table selects, so a subquery's "id" would bind to the ticket, not the event.
  return db
    .select({
      id: events.id,
      title: events.title,
      startsAt: events.startsAt,
      venue: events.venueName,
      total: sql<number>`(count(${tickets.id}) filter (where ${tickets.status} <> 'void'))::int`,
      used: sql<number>`(count(${tickets.id}) filter (where ${tickets.status} = 'used'))::int`,
      live: sql<boolean>`${events.startsAt} <= now()`,
      ended: sql<boolean>`${endsAt} < now()`,
      endsAt: sql<Date>`${endsAt}`.mapWith(events.startsAt),
    })
    .from(events)
    .leftJoin(tickets, eq(tickets.eventId, events.id))
    .where(sql`${inArray(events.status, ["published", "ended"])} and ${endsAt} > now() - interval '1 day'`)
    .groupBy(events.id)
    .orderBy(asc(events.startsAt));
}

export async function buildManifest(eventId: string): Promise<Manifest | null> {
  const ev = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!ev) return null;
  const rows = await db
    .select({
      id: tickets.id,
      code: tickets.shortCode,
      holder: tickets.holderName,
      tier: ticketTiers.name,
      status: tickets.status,
      checkedInAt: tickets.checkedInAt,
    })
    .from(tickets)
    .innerJoin(ticketTiers, eq(ticketTiers.id, tickets.tierId))
    .where(eq(tickets.eventId, eventId))
    .orderBy(asc(tickets.holderName));
  return {
    eventId,
    title: ev.title,
    status: ev.status,
    startsAt: ev.startsAt.toISOString(),
    endsAt: ev.endsAt?.toISOString() ?? null,
    venue: ev.venueName,
    publicKey: publicKeyJwkB64(),
    version: new Date().toISOString(),
    tickets: rows.map((r) => ({ ...r, checkedInAt: r.checkedInAt?.toISOString() ?? null })),
  };
}

/**
 * Applies queued check-ins. First scan wins: a ticket already `used` on the
 * server comes back as `duplicate` with the original time, so the scanner can
 * tell the door staff someone else let that ticket in.
 */
export async function applyCheckins(eventId: string, scannerUserId: string, deviceId: string, incoming: IncomingCheckin[]) {
  const outcomes: CheckinOutcome[] = [];
  for (const c of incoming) {
    const scannedAt = new Date(c.scannedAt);
    const safeScannedAt = isNaN(scannedAt.getTime()) ? new Date() : scannedAt;
    const outcome = await db.transaction(async (tx) => {
      // idempotent on client id
      const dup = await tx.query.checkins.findFirst({ where: eq(checkins.clientCheckinId, c.clientId) });
      if (dup) {
        const t = dup.ticketId ? await tx.query.tickets.findFirst({ where: eq(tickets.id, dup.ticketId) }) : null;
        return { clientId: c.clientId, ticketId: dup.ticketId, result: dup.result, checkedInAt: t?.checkedInAt?.toISOString() ?? null, holder: t?.holderName } satisfies CheckinOutcome;
      }
      let result: CheckinOutcome["result"] = "invalid";
      let checkedInAt: Date | null = null;
      let holder: string | undefined;
      const local = c.localResult ?? "ok";
      if (local !== "ok") {
        // The door turned this person away. Log it, but never flip the ticket to used:
        // e.g. a ticket issued after the manifest download, or one an admin un-checked.
        const t = c.ticketId ? await tx.query.tickets.findFirst({ where: and(eq(tickets.id, c.ticketId), eq(tickets.eventId, eventId)) }) : null;
        await tx.insert(checkins).values({
          id: nanoid(14),
          ticketId: t?.id ?? null,
          eventId,
          scannerUserId,
          deviceId,
          clientCheckinId: c.clientId,
          rawPayload: c.rawPayload?.slice(0, 500) ?? null,
          scannedAt: safeScannedAt,
          result: local,
        });
        return { clientId: c.clientId, ticketId: t?.id ?? null, result: local, checkedInAt: t?.checkedInAt?.toISOString() ?? null, holder: t?.holderName } satisfies CheckinOutcome;
      }
      if (c.ticketId) {
        const [t] = await tx
          .select()
          .from(tickets)
          .where(and(eq(tickets.id, c.ticketId), eq(tickets.eventId, eventId)))
          .for("update");
        if (t) {
          holder = t.holderName;
          if (t.status === "void") result = "void";
          else if (t.status === "used") {
            result = "duplicate";
            checkedInAt = t.checkedInAt;
          } else {
            result = "ok";
            checkedInAt = safeScannedAt;
            await tx.update(tickets).set({ status: "used", checkedInAt: safeScannedAt, checkedInBy: scannerUserId }).where(eq(tickets.id, t.id));
          }
        }
      }
      await tx.insert(checkins).values({
        id: nanoid(14),
        ticketId: result === "invalid" ? null : c.ticketId,
        eventId,
        scannerUserId,
        deviceId,
        clientCheckinId: c.clientId,
        rawPayload: c.rawPayload?.slice(0, 500) ?? null,
        scannedAt: safeScannedAt,
        result,
      });
      return { clientId: c.clientId, ticketId: c.ticketId, result, checkedInAt: checkedInAt?.toISOString() ?? null, holder } satisfies CheckinOutcome;
    });
    outcomes.push(outcome);
  }
  return outcomes;
}

/** Manual check-in by short code from the attendees page. */
export async function checkinByCode(eventId: string, scannerUserId: string, shortCode: string) {
  const t = await db.query.tickets.findFirst({ where: and(eq(tickets.eventId, eventId), eq(tickets.shortCode, shortCode)) });
  if (!t) return { result: "invalid" as const };
  const [o] = await applyCheckins(eventId, scannerUserId, "manual", [
    { clientId: `manual-${nanoid(10)}`, ticketId: t.id, rawPayload: shortCode, scannedAt: new Date().toISOString() },
  ]);
  return { ...o, holder: t.holderName };
}

export async function undoCheckin(ticketId: string) {
  await db.update(tickets).set({ status: "valid", checkedInAt: null, checkedInBy: null }).where(and(eq(tickets.id, ticketId), eq(tickets.status, "used")));
}
