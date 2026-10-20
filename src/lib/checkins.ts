import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { checkins, events, tickets, ticketTiers } from "@/db/schema";
import { publicKeyJwkB64 } from "./tickets/server";

export type ManifestTicket = {
  id: string;
  code: string;
  holder: string;
  tier: string;
  status: "valid" | "used" | "void";
  checkedInAt: string | null;
};

export type Manifest = {
  eventId: string;
  title: string;
  status: "draft" | "published" | "cancelled" | "ended";
  startsAt: string;
  endsAt: string | null;
  venue: string;
  publicKey: string;
  version: string;
  tickets: ManifestTicket[];
};

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

export type LocalResult = "ok" | "duplicate" | "invalid" | "void";

export type IncomingCheckin = {
  clientId: string;
  ticketId: string | null;
  rawPayload: string | null;
  scannedAt: string;
  /** What the door saw. Anything but "ok" is recorded for the audit trail and never admits. Missing = "ok" (older clients). */
  localResult?: LocalResult;
};

export type CheckinOutcome = {
  clientId: string;
  ticketId: string | null;
  result: "ok" | "duplicate" | "invalid" | "void";
  checkedInAt: string | null;
  holder?: string;
};

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
