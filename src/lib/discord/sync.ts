import "server-only";
import { and, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/db/client";
import { accounts, bookings, discordEventSync, events } from "@/db/schema";
import { isDemoDeployment } from "@/lib/demo/flag";
import { discordEnabled } from "@/lib/env";
import { eventEndsAt, getEventById } from "@/lib/events";
import { discordBotEnabled } from "./client";
import { postReminder, syncAnnouncement, syncScheduledEvent } from "./announce";
import { archiveEventDiscord, ensureEventChannel, ensureEventRole, linkedHolders, syncMemberRoles } from "./roles";
import { getDiscordSettings } from "./settings";

const DAY = 86400e3;
/** How long an event's role and chat stay open after it ends. */
const ARCHIVE_AFTER = 3 * DAY;

/** Anything to do at all: the feature is on, and there's a configured bot or the demo site's outbox. */
export async function discordActive() {
  return discordEnabled && (discordBotEnabled || (await isDemoDeployment()));
}

/**
 * Runs Discord work after the response, like notifyLater. Never throws and never slows
 * the page down; the cron catches up on anything that failed.
 */
export function discordLater(label: string, work: () => Promise<unknown>) {
  after(async () => {
    try {
      if (await discordActive()) await work();
    } catch (e) {
      console.error(`[discord] ${label}`, e);
    }
  });
}

export type EventSyncSummary = { announcement: string; role?: "created" | "kept"; channel?: boolean; archived?: boolean; skipped?: "busy" | "missing" };

/**
 * Brings everything the EMS keeps in Discord for one event in line with the event: the
 * #events post, the native scheduled event, the ticket holders' role and chat, and the
 * archive afterwards. Safe to call any time and from anywhere; an advisory lock makes
 * concurrent calls for the same event skip rather than double-post.
 */
export async function syncDiscordEvent(eventId: string, opts: { force?: boolean } = {}): Promise<EventSyncSummary> {
  const result = await db.transaction(async (tx): Promise<EventSyncSummary> => {
    const { rows } = await tx.execute<{ locked: boolean }>(sql`select pg_try_advisory_xact_lock(hashtext(${`discord:${eventId}`})) as locked`);
    if (!rows[0]?.locked) return { announcement: "unchanged", skipped: "busy" };
    const ev = await getEventById(eventId);
    if (!ev) return { announcement: "unchanged", skipped: "missing" };

    await tx.insert(discordEventSync).values({ eventId }).onConflictDoNothing();
    const row = (await tx.query.discordEventSync.findFirst({ where: eq(discordEventSync.eventId, eventId) }))!;
    const s = await getDiscordSettings();
    const summary: EventSyncSummary = { announcement: "off" };
    const save = (patch: Partial<typeof discordEventSync.$inferInsert>) =>
      Object.keys(patch).length ? tx.update(discordEventSync).set({ ...patch, updatedAt: new Date() }).where(eq(discordEventSync.eventId, eventId)) : null;

    const a = await syncAnnouncement(ev, row, s, opts);
    summary.announcement = a.result;
    await save(a.patch);

    const sched = await syncScheduledEvent(ev, row, s, opts);
    await save(sched);

    if (discordBotEnabled && !row.archivedAt) {
      const over = ev.status === "cancelled" || ((ev.status === "ended" || ev.status === "published") && eventEndsAt(ev).getTime() + ARCHIVE_AFTER < Date.now());
      if (over) {
        if (row.roleId || row.channelId) {
          await save(await archiveEventDiscord(row, s));
          summary.archived = true;
        }
      } else {
        const role = await ensureEventRole(ev, row, s);
        await save(role.patch);
        const roleId = role.patch.roleId ?? row.roleId;
        if (roleId) summary.role = role.created ? "created" : "kept";
        const channel = await ensureEventChannel(ev, { ...row, roleId }, s);
        await save(channel);
        summary.channel = Boolean(channel.channelId ?? row.channelId);
      }
    }
    return summary;
  });
  // A new role goes to everyone who already holds tickets, once the role id is committed
  if (result.role === "created") {
    for (const userId of await linkedHolders(eventId)) await syncMemberRoles(userId).catch(() => null);
  }
  return result;
}

/** Queues a sync for after the response. */
export function syncDiscordEventLater(eventId: string, opts: { force?: boolean } = {}) {
  discordLater(`event ${eventId}`, () => syncDiscordEvent(eventId, opts));
}

export function syncMemberRolesLater(userIds: string | string[]) {
  const ids = [...new Set(Array.isArray(userIds) ? userIds : [userIds])];
  if (!discordBotEnabled || ids.length === 0) return;
  discordLater("roles", async () => {
    for (const id of ids) await syncMemberRoles(id);
  });
}

/**
 * The 15-minute catch-up: re-syncs published events that aren't long over (the post's seat
 * count, starting/ending the scheduled event, archiving), posts "tomorrow" reminders, and
 * re-applies roles for anyone whose bookings changed recently in case a hook failed.
 */
export async function runDiscordCron(now = new Date()) {
  if (!(await discordActive())) return { events: 0, reminders: 0, members: 0 };
  const s = await getDiscordSettings();
  const recent = await db
    .select({ id: events.id })
    .from(events)
    .leftJoin(discordEventSync, eq(discordEventSync.eventId, events.id))
    .where(
      or(
        and(inArray(events.status, ["published", "ended"]), gt(sql`coalesce(${events.endsAt}, ${events.startsAt} + interval '6 hours')`, new Date(now.getTime() - ARCHIVE_AFTER - DAY))),
        // Cancelled or long-finished events whose role or chat hasn't been archived yet
        and(isNull(discordEventSync.archivedAt), sql`(${discordEventSync.roleId} is not null or ${discordEventSync.channelId} is not null)`),
      ),
    );
  let synced = 0;
  for (const e of recent) {
    await syncDiscordEvent(e.id).catch((err) => console.error("[discord] cron sync", e.id, err));
    synced++;
  }

  let reminders = 0;
  if (s.reminderPosts) {
    const due = await db
      .select({ id: events.id })
      .from(events)
      .innerJoin(discordEventSync, eq(discordEventSync.eventId, events.id))
      .where(and(eq(events.status, "published"), isNull(discordEventSync.remindedAt), gt(events.startsAt, now), lt(events.startsAt, new Date(now.getTime() + DAY))));
    for (const { id } of due) {
      // Claim first, so two overlapping crons can't both post
      const [claimed] = await db
        .update(discordEventSync)
        .set({ remindedAt: now })
        .where(and(eq(discordEventSync.eventId, id), isNull(discordEventSync.remindedAt)))
        .returning({ id: discordEventSync.eventId });
      const ev = claimed && (await getEventById(id));
      if (ev && (await postReminder(ev, s))) reminders++;
    }
  }

  let members = 0;
  if (discordBotEnabled) {
    const changed = await db
      .selectDistinct({ userId: bookings.userId })
      .from(bookings)
      .innerJoin(accounts, and(eq(accounts.userId, bookings.userId), eq(accounts.providerId, "discord")))
      .where(gt(bookings.updatedAt, new Date(now.getTime() - 45 * 60e3)))
      .limit(50);
    for (const { userId } of changed) {
      await syncMemberRoles(userId).catch(() => null);
      members++;
    }
  }
  return { events: synced, reminders, members };
}

/** "Resync everything" on /admin/discord: every live event, then every linked member. */
export async function resyncAllDiscord() {
  const live = await db
    .select({ id: events.id })
    .from(events)
    .where(and(inArray(events.status, ["published", "cancelled", "ended"]), gt(sql`coalesce(${events.endsAt}, ${events.startsAt} + interval '6 hours')`, new Date(Date.now() - ARCHIVE_AFTER - DAY))));
  const results = [];
  for (const e of live) results.push(await syncDiscordEvent(e.id, { force: true }));
  const linked = await db.selectDistinct({ userId: accounts.userId }).from(accounts).where(eq(accounts.providerId, "discord"));
  const roles: Record<string, number> = {};
  for (const { userId } of linked) {
    const r = await syncMemberRoles(userId);
    roles[r] = (roles[r] ?? 0) + 1;
  }
  return {
    events: results.length,
    posted: results.filter((r) => r.announcement === "posted").length,
    edited: results.filter((r) => r.announcement === "edited").length,
    members: linked.length,
    roles,
  };
}
