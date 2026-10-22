import "server-only";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { PermissionFlagsBits, OverwriteType, ChannelType } from "discord-api-types/v10";
import slugify from "slugify";
import { db } from "@/db/client";
import { accounts, bookings, discordEventSync, users } from "@/db/schema";
import { env } from "@/lib/env";
import { fmtDate, fmtRange } from "@/lib/format";
import { discordApi, discordBotEnabled, guildPath } from "./client";
import { eventUrl, type SyncEvent } from "./announce";
import { getDiscordId, getGuildMember } from "./members";
import { getDiscordSettings, staffRoleFor, type DiscordSettings } from "./settings";

const VIEW = PermissionFlagsBits.ViewChannel;
const TALK = VIEW | PermissionFlagsBits.SendMessages | PermissionFlagsBits.ReadMessageHistory | PermissionFlagsBits.EmbedLinks | PermissionFlagsBits.AttachFiles;

/** The bot's own user id is the first part of its token. */
function botUserId() {
  try {
    return Buffer.from(env.discordBotToken!.split(".")[0], "base64").toString("utf8");
  } catch {
    return null;
  }
}

export const eventRoleName = (ev: Pick<SyncEvent, "title" | "startsAt">) => `🎟 ${ev.title}`.slice(0, 80) + ` · ${fmtDate(ev.startsAt, "MMM d")}`;
const eventChannelName = (ev: Pick<SyncEvent, "slug" | "title" | "startsAt">) =>
  `${slugify(ev.title, { lower: true, strict: true }).slice(0, 70)}-${fmtDate(ev.startsAt, "MMM-d").toLowerCase()}`;

type RoleRow = { roleId: string | null; channelId: string | null; wantsChannel: boolean };

/**
 * The ticket holders' role for an event: created when it's published (if event roles are on)
 * and renamed with the event. Returns the patch to store, and whether the role is new so the
 * caller can hand it to people who already hold tickets.
 */
export async function ensureEventRole(ev: SyncEvent, row: RoleRow, s: DiscordSettings) {
  if (!discordBotEnabled || !s.eventRoles || ev.status !== "published") return { patch: {}, created: false };
  const name = eventRoleName(ev);
  if (row.roleId) {
    const roles = await discordApi<{ id: string; name: string }[]>("GET", guildPath("/roles"));
    const current = roles.ok ? roles.data.find((r) => r.id === row.roleId) : undefined;
    if (current && current.name !== name) await discordApi("PATCH", guildPath(`/roles/${row.roleId}`), { body: { name }, reason: "Event renamed" });
    if (current || !roles.ok) return { patch: {}, created: false };
    // Deleted by hand: make a new one
  }
  const res = await discordApi<{ id: string }>("POST", guildPath("/roles"), {
    body: { name, permissions: "0", mentionable: false, hoist: false },
    reason: `Ticket holders for ${ev.title}`,
  });
  return res.ok ? { patch: { roleId: res.data.id }, created: true } : { patch: {}, created: false };
}

/**
 * A private text channel for the event's ticket holders, if the organiser asked for one.
 * Only the event role, the staff roles and the bot can see it.
 */
export async function ensureEventChannel(ev: SyncEvent, row: RoleRow, s: DiscordSettings) {
  if (!discordBotEnabled || !row.wantsChannel || !row.roleId || !s.chatsCategoryId || ev.status !== "published") return {};
  const name = eventChannelName(ev);
  const topic = `${ev.title} · ${fmtRange(ev.startsAt, ev.endsAt)} · ${ev.venueName} · ${eventUrl(ev.slug)}`.slice(0, 1024);
  if (row.channelId) {
    const ch = await discordApi<{ name: string; topic: string | null }>("GET", `/channels/${row.channelId}`, { expect: [404] });
    if (ch.ok) {
      // Channel renames are heavily rate limited, so only when something really changed
      if (ch.data.name !== name || ch.data.topic !== topic) await discordApi("PATCH", `/channels/${row.channelId}`, { body: { name, topic }, reason: "Event details changed" });
      return {};
    }
    if (ch.status !== 404) return {};
  }
  const bot = botUserId();
  const allowStaff = [s.organiserRoleId, s.doorRoleId].filter(Boolean).map((id) => ({ id: id!, type: OverwriteType.Role, allow: String(TALK), deny: "0" }));
  const res = await discordApi<{ id: string }>("POST", guildPath("/channels"), {
    body: {
      name,
      type: ChannelType.GuildText,
      parent_id: s.chatsCategoryId,
      topic,
      permission_overwrites: [
        // @everyone's role id is the guild id
        { id: env.discordGuildId, type: OverwriteType.Role, allow: "0", deny: String(VIEW) },
        { id: row.roleId, type: OverwriteType.Role, allow: String(TALK), deny: "0" },
        ...allowStaff,
        ...(bot ? [{ id: bot, type: OverwriteType.Member, allow: String(TALK), deny: "0" }] : []),
      ],
    },
    reason: `Chat for ${ev.title} ticket holders`,
  });
  if (!res.ok) return {};
  const channelId = res.data.id;
  const start = Math.floor(ev.startsAt.getTime() / 1000);
  const welcome = await discordApi<{ id: string }>("POST", `/channels/${channelId}/messages`, {
    body: {
      content: [
        `👋 This chat is for everyone with a ticket to **${ev.title}**.`,
        `📅 <t:${start}:F> (<t:${start}:R>)`,
        `📍 ${ev.venueName}${ev.mapUrl ? ` · <${ev.mapUrl}>` : ""}`,
        `🎟 Your tickets: <${env.appUrl}/tickets>`,
        "",
        "Use it for meetups, carpools and photos afterwards. Organisers are here too.",
      ].join("\n"),
      allowed_mentions: { parse: [] },
    },
  });
  if (welcome.ok) await discordApi("PUT", `/channels/${channelId}/pins/${welcome.data.id}`, { expect: [403] });
  return { channelId };
}

/**
 * After the event (or straight away if it was cancelled): delete its role, which takes it off
 * everyone, and move the chat to the archive category, where only staff can still read it.
 */
export async function archiveEventDiscord(row: RoleRow, s: DiscordSettings) {
  if (!discordBotEnabled) return {};
  if (row.roleId) await discordApi("DELETE", guildPath(`/roles/${row.roleId}`), { expect: [404], reason: "Event is over" });
  if (row.channelId && s.archiveCategoryId) {
    await discordApi("PATCH", `/channels/${row.channelId}`, { body: { parent_id: s.archiveCategoryId }, expect: [404], reason: "Event is over" });
  }
  return { roleId: null, archivedAt: new Date() };
}

export type RoleSyncResult = "synced" | "not-linked" | "not-in-server" | "off" | "failed";

/**
 * Makes a member's EMS-managed roles in Discord match the EMS: their staff role, Camper if they
 * have ever had an approved booking, and the role of every upcoming event they hold tickets
 * for. Roles the EMS doesn't manage are never touched.
 */
export async function syncMemberRoles(userId: string): Promise<RoleSyncResult> {
  if (!discordBotEnabled) return "off";
  const discordId = await getDiscordId(userId);
  if (!discordId) return "not-linked";
  const s = await getDiscordSettings();
  const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { role: true } });
  if (!user) return "failed";

  const eventRoles = await db
    .select({ eventId: discordEventSync.eventId, roleId: discordEventSync.roleId })
    .from(discordEventSync)
    .where(and(isNotNull(discordEventSync.roleId), isNull(discordEventSync.archivedAt)));
  const approved = await db
    .selectDistinct({ eventId: bookings.eventId })
    .from(bookings)
    .where(and(eq(bookings.userId, userId), eq(bookings.status, "approved")));
  const holds = new Set(approved.map((b) => b.eventId));

  const managed = new Set([s.organiserRoleId, s.doorRoleId, s.camperRoleId, ...eventRoles.map((r) => r.roleId)].filter(Boolean) as string[]);
  const desired = new Set(
    [
      staffRoleFor(s, user.role),
      approved.length > 0 ? s.camperRoleId : undefined,
      ...eventRoles.filter((r) => holds.has(r.eventId)).map((r) => r.roleId),
    ].filter(Boolean) as string[],
  );

  const member = await getGuildMember(discordId);
  if (!member) return "not-in-server";
  const current = new Set(member.roles);
  let ok = true;
  for (const role of desired) {
    if (current.has(role)) continue;
    const res = await discordApi("PUT", guildPath(`/members/${discordId}/roles/${role}`), { reason: "Baguio Base Camp roles sync" });
    ok &&= res.ok;
  }
  for (const role of current) {
    if (!managed.has(role) || desired.has(role)) continue;
    const res = await discordApi("DELETE", guildPath(`/members/${discordId}/roles/${role}`), { reason: "Baguio Base Camp roles sync" });
    ok &&= res.ok;
  }
  return ok ? "synced" : "failed";
}

/** Strips every EMS-managed role, for when someone unlinks their account. */
export async function removeManagedRoles(discordId: string) {
  if (!discordBotEnabled) return;
  const s = await getDiscordSettings();
  const eventRoles = await db.select({ roleId: discordEventSync.roleId }).from(discordEventSync).where(isNotNull(discordEventSync.roleId));
  const managed = new Set([s.organiserRoleId, s.doorRoleId, s.camperRoleId, ...eventRoles.map((r) => r.roleId)].filter(Boolean) as string[]);
  const member = await getGuildMember(discordId);
  if (!member) return;
  for (const role of member.roles) {
    if (managed.has(role)) await discordApi("DELETE", guildPath(`/members/${discordId}/roles/${role}`), { reason: "Unlinked their Baguio Base Camp account" });
  }
}

/** Everyone linked who holds an approved booking for the event, e.g. to hand out a role that was just made. */
export async function linkedHolders(eventId: string) {
  const rows = await db
    .selectDistinct({ userId: bookings.userId })
    .from(bookings)
    .innerJoin(accounts, and(eq(accounts.userId, bookings.userId), eq(accounts.providerId, "discord")))
    .where(and(eq(bookings.eventId, eventId), inArray(bookings.status, ["approved"])));
  return rows.map((r) => r.userId);
}
