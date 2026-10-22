import "server-only";
import { createHash } from "node:crypto";
import { ButtonStyle, ComponentType, GuildScheduledEventEntityType, GuildScheduledEventPrivacyLevel, GuildScheduledEventStatus } from "discord-api-types/v10";
import { isDemoDeployment } from "@/lib/demo/flag";
import { writeOutbox } from "@/lib/demo/outbox";
import { env } from "@/lib/env";
import { eventEndsAt, heldByTier, tierIsOnSale, type getEventById } from "@/lib/events";
import { fmtRange, peso } from "@/lib/format";
import { discordApi, discordBotEnabled } from "./client";
import type { DiscordSettings } from "./settings";

export type SyncEvent = NonNullable<Awaited<ReturnType<typeof getEventById>>>;
export type SyncRow = {
  messageId: string | null;
  messageChannelId: string | null;
  scheduledEventId: string | null;
  lastStateHash: string | null;
  scheduledStateHash: string | null;
};

/** Where an event is in its life, as far as the announcement is concerned. */
export type Phase = "draft" | "not-on-sale" | "selling" | "few-left" | "sold-out" | "happening" | "ended" | "cancelled";

const COLORS: Record<Phase, number> = {
  draft: 0x9db58a,
  "not-on-sale": 0x1e6fa3,
  selling: 0x1f9a3e,
  "few-left": 0xf7a417,
  "sold-out": 0xc0532b,
  happening: 0x8cc63e,
  ended: 0x27404a,
  cancelled: 0x6b7280,
};

const LABELS: Record<Phase, string> = {
  draft: "Draft",
  "not-on-sale": "Tickets not on sale yet",
  selling: "Tickets on sale",
  "few-left": "Few spots left",
  "sold-out": "Sold out · waitlist open",
  happening: "Happening now",
  ended: "Ended",
  cancelled: "Cancelled",
};

export const eventUrl = (slug: string) => `${env.appUrl}/events/${slug}`;
const absolute = (url: string | null) => (url ? new URL(url, env.appUrl).toString() : null);
const unix = (d: Date) => Math.floor(d.getTime() / 1000);
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("base64url").slice(0, 22);

function clip(s: string, n: number) {
  return s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`;
}

/** The first paragraph or two of the description, for the embed. Discord renders markdown itself. */
function excerpt(md: string, n = 450) {
  const paras = md.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p && !p.startsWith("!["));
  let out = "";
  for (const p of paras) {
    if (out && out.length + p.length > n) break;
    out += (out ? "\n\n" : "") + p;
  }
  return clip(out, n);
}

export async function eventPhase(ev: SyncEvent, now = new Date()) {
  const open = ev.tiers.filter((t) => tierIsOnSale(t, now));
  const held = await heldByTier([ev.id]);
  const remaining = open.reduce((n, t) => n + Math.max(0, t.quantity - (held.get(t.id) ?? 0)), 0);
  const capacity = open.reduce((n, t) => n + t.quantity, 0);
  let phase: Phase;
  if (ev.status === "cancelled") phase = "cancelled";
  else if (ev.status === "draft") phase = "draft";
  else if (ev.status === "ended" || eventEndsAt(ev) <= now) phase = "ended";
  else if (ev.startsAt <= now) phase = "happening";
  else if (ev.tiers.length > 0 && open.length === 0) phase = "not-on-sale";
  else if (remaining === 0) phase = "sold-out";
  else if (remaining <= 10) phase = "few-left";
  else phase = "selling";
  return { phase, remaining, capacity };
}

function priceLabel(ev: SyncEvent) {
  const prices = ev.tiers.map((t) => t.priceCents);
  if (prices.length === 0) return null;
  const lo = Math.min(...prices), hi = Math.max(...prices);
  return lo === hi ? peso(lo) : `${peso(lo)} – ${peso(hi)}`;
}

/** The #events post: an embed plus link buttons. Pure, so the hash only moves when the post would. */
export function buildAnnouncement(ev: SyncEvent, p: { phase: Phase; remaining: number; capacity: number }) {
  const url = eventUrl(ev.slug);
  const start = unix(ev.startsAt);
  const live = !["ended", "cancelled", "draft"].includes(p.phase);
  const fields = [
    { name: "When", value: live ? `<t:${start}:F>\n<t:${start}:R>` : `<t:${start}:D>`, inline: true },
    {
      name: "Where",
      value: clip([ev.venueName, ev.venueAddress].filter(Boolean).join("\n") + (ev.mapUrl ? `\n[Map](${ev.mapUrl})` : ""), 1000),
      inline: true,
    },
  ];
  const price = priceLabel(ev);
  if (price && live) fields.push({ name: "Tickets", value: price, inline: true });
  if (live && p.phase !== "happening" && p.capacity > 0) {
    fields.push({
      name: "Spots",
      value: p.phase === "sold-out" ? "Sold out. Join the waitlist and we'll tell you when one opens." : `${p.remaining} of ${p.capacity} left`,
      inline: false,
    });
  }
  const description = [ev.tagline ? `**${ev.tagline}**` : null, excerpt(ev.descriptionMd)].filter(Boolean).join("\n\n");
  const cover = absolute(ev.coverImageUrl);
  const embed = {
    title: clip(p.phase === "cancelled" ? `Cancelled: ${ev.title}` : ev.title, 256),
    url,
    description: description || undefined,
    color: COLORS[p.phase],
    fields,
    image: cover ? { url: cover } : undefined,
    footer: { text: `${LABELS[p.phase]} · Baguio Base Camp` },
  };
  const cta = p.phase === "sold-out" ? "Join the waitlist" : live && p.phase !== "happening" ? "Get tickets" : "Event page";
  const buttons = [
    { type: ComponentType.Button, style: ButtonStyle.Link, label: cta, url },
    ...(ev.mapUrl && live ? [{ type: ComponentType.Button, style: ButtonStyle.Link, label: "Map", url: ev.mapUrl }] : []),
  ];
  return {
    content: "",
    embeds: [embed],
    components: [{ type: ComponentType.ActionRow, components: buttons }],
    allowed_mentions: { parse: [] },
  };
}

export type AnnounceResult = "posted" | "edited" | "deleted" | "unchanged" | "off" | "failed";

/**
 * Creates, edits or removes the #events post so it matches the event. Drafts have no post
 * (unpublishing removes it); everything else keeps one post that is edited in place.
 * On the demo deployment each change is also captured in the outbox.
 */
export async function syncAnnouncement(ev: SyncEvent, row: SyncRow, s: DiscordSettings, opts: { force?: boolean } = {}) {
  const patch: Partial<SyncRow> = {};
  const channelId = s.eventsChannelId;
  const demo = await isDemoDeployment();
  const canPost = discordBotEnabled && Boolean(channelId);
  if (!canPost && !demo) return { result: "off" as AnnounceResult, patch };

  const p = await eventPhase(ev);

  if (p.phase === "draft") {
    if (!row.messageId && !row.lastStateHash) return { result: "unchanged" as AnnounceResult, patch };
    if (row.messageId && row.messageChannelId) {
      await discordApi("DELETE", `/channels/${row.messageChannelId}/messages/${row.messageId}`, { expect: [404], reason: "Event unpublished" });
    }
    if (demo) await writeOutbox({ kind: "discord", subject: `#events · removed ${ev.title}`, text: "Unpublished, so the post was deleted.", url: eventUrl(ev.slug), meta: { action: "delete" } });
    Object.assign(patch, { messageId: null, messageChannelId: null, lastStateHash: null });
    return { result: "deleted" as AnnounceResult, patch };
  }

  const payload = buildAnnouncement(ev, p);
  const h = hash(payload);
  // A post in a channel that's no longer the events channel stays where it is; the new channel gets its own.
  const sameChannel = row.messageId && row.messageChannelId === channelId;
  if (!opts.force && h === row.lastStateHash && (sameChannel || !canPost)) return { result: "unchanged" as AnnounceResult, patch };

  let result: AnnounceResult = "failed";
  if (canPost) {
    let messageId = sameChannel ? row.messageId : null;
    if (messageId) {
      const res = await discordApi("PATCH", `/channels/${channelId}/messages/${messageId}`, { body: payload, expect: [404] });
      if (res.ok) result = "edited";
      else if (res.status === 404) messageId = null; // deleted by hand: post it again
      else return { result, patch };
    }
    if (!messageId) {
      if (p.phase === "ended" || p.phase === "cancelled") {
        // Not worth a fresh post for something that's already over
        result = "unchanged";
      } else {
        const res = await discordApi<{ id: string }>("POST", `/channels/${channelId}/messages`, { body: payload });
        if (!res.ok) return { result, patch };
        result = "posted";
        Object.assign(patch, { messageId: res.data.id, messageChannelId: channelId });
      }
    }
  } else {
    result = row.lastStateHash ? "edited" : "posted";
  }
  if (result === "failed") return { result, patch };
  patch.lastStateHash = h;
  if (demo && result !== "unchanged") {
    const embed = payload.embeds[0];
    await writeOutbox({
      kind: "discord",
      subject: `#events · ${result === "posted" ? "new post" : "edited"} · ${embed.title}`,
      text: [embed.footer.text, ...embed.fields.map((f) => `${f.name}: ${f.value.replace(/\n?<t:\d+:R>/g, "").replace(/<t:(\d+):[FD]>/g, (_, t) => fmtRange(new Date(Number(t) * 1000)))}`)].join("\n"),
      url: embed.url,
      meta: { action: result, phase: p.phase },
    });
  }
  return { result, patch };
}

/** Discord wants the cover as a data URI, at most a few MB. */
async function coverDataUri(url: string | null) {
  const abs = absolute(url);
  if (!abs) return undefined;
  try {
    const res = await fetch(abs, { signal: AbortSignal.timeout(8000) });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !/^image\/(png|jpe?g|gif|webp)/.test(type)) return undefined;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 7_000_000) return undefined;
    return `data:${type.split(";")[0]};base64,${buf.toString("base64")}`;
  } catch {
    return undefined;
  }
}

/**
 * The native Discord event next to the post, so people can hit "Interested" and get
 * Discord's own reminder. Started when the event starts, completed (or removed if it
 * never started) when it ends, cancelled with the event.
 */
export async function syncScheduledEvent(ev: SyncEvent, row: SyncRow, s: DiscordSettings, opts: { force?: boolean } = {}) {
  const patch: Partial<SyncRow> = {};
  if (!discordBotEnabled) return patch;
  const base = `/guilds/${env.discordGuildId}/scheduled-events`;
  const now = new Date();
  const end = eventEndsAt(ev);
  const id = row.scheduledEventId;
  const clear = { scheduledEventId: null, scheduledStateHash: null };

  if (ev.status === "draft" || (!s.scheduledEvents && id && ev.startsAt > now)) {
    if (id) await discordApi("DELETE", `${base}/${id}`, { expect: [404], reason: "Event unpublished" });
    return id ? clear : patch;
  }
  if (ev.status === "cancelled") {
    if (!id) return patch;
    const res = await discordApi("PATCH", `${base}/${id}`, { body: { status: GuildScheduledEventStatus.Canceled }, expect: [400, 404], reason: "Event cancelled" });
    if (!res.ok) await discordApi("DELETE", `${base}/${id}`, { expect: [404] });
    return clear;
  }
  if (ev.status === "ended" || end <= now) {
    if (!id) return patch;
    const res = await discordApi("PATCH", `${base}/${id}`, { body: { status: GuildScheduledEventStatus.Completed }, expect: [400, 404] });
    // Never started (an external event can't go straight to completed): just remove it
    if (!res.ok) await discordApi("DELETE", `${base}/${id}`, { expect: [404] });
    return clear;
  }
  if (!s.scheduledEvents) return patch;

  if (ev.startsAt <= now) {
    if (id && row.scheduledStateHash !== "active") {
      const res = await discordApi("PATCH", `${base}/${id}`, { body: { status: GuildScheduledEventStatus.Active }, expect: [400, 404] });
      if (res.ok || res.status === 400) patch.scheduledStateHash = "active";
    }
    return patch;
  }

  const body = {
    name: clip(ev.title, 100),
    description: clip([ev.tagline, `Tickets: ${eventUrl(ev.slug)}`].filter(Boolean).join("\n\n"), 1000),
    scheduled_start_time: ev.startsAt.toISOString(),
    scheduled_end_time: end.toISOString(),
    privacy_level: GuildScheduledEventPrivacyLevel.GuildOnly,
    entity_type: GuildScheduledEventEntityType.External,
    entity_metadata: { location: clip([ev.venueName, ev.venueAddress].filter(Boolean).join(", "), 100) },
  };
  const h = hash({ ...body, cover: ev.coverImageUrl });
  if (id && h === row.scheduledStateHash && !opts.force) return patch;
  const image = await coverDataUri(ev.coverImageUrl);
  if (id) {
    const res = await discordApi("PATCH", `${base}/${id}`, { body: { ...body, ...(image ? { image } : {}) }, expect: [404] });
    if (res.ok) return { scheduledStateHash: h };
    if (res.status !== 404) return patch;
  }
  const res = await discordApi<{ id: string }>("POST", base, { body: { ...body, ...(image ? { image } : {}) }, reason: "Event published" });
  return res.ok ? { scheduledEventId: res.data.id, scheduledStateHash: h } : patch;
}

/** "Tomorrow" nudge in the events channel, once per event, for events still selling. */
export async function postReminder(ev: SyncEvent, s: DiscordSettings) {
  const demo = await isDemoDeployment();
  if (!(discordBotEnabled && s.eventsChannelId) && !demo) return false;
  const p = await eventPhase(ev);
  if (!["selling", "few-left", "sold-out", "not-on-sale"].includes(p.phase)) return false;
  const start = unix(ev.startsAt);
  const spots = p.phase === "sold-out" ? "Sold out, but the waitlist is open." : p.capacity > 0 ? `${p.remaining} of ${p.capacity} spots left.` : "";
  const content = `⏰ **${ev.title}** is <t:${start}:R> (<t:${start}:F>) at ${ev.venueName}. ${spots}`.trim();
  if (demo) await writeOutbox({ kind: "discord", subject: `#events · reminder · ${ev.title}`, text: `${ev.title} is tomorrow, ${fmtRange(ev.startsAt)}. ${spots}`.trim(), url: eventUrl(ev.slug), meta: { action: "reminder" } });
  if (!(discordBotEnabled && s.eventsChannelId)) return true;
  const res = await discordApi("POST", `/channels/${s.eventsChannelId}/messages`, {
    body: {
      content,
      components: [{ type: ComponentType.ActionRow, components: [{ type: ComponentType.Button, style: ButtonStyle.Link, label: p.phase === "sold-out" ? "Join the waitlist" : "Get tickets", url: eventUrl(ev.slug) }] }],
      allowed_mentions: { parse: [] },
    },
  });
  return res.ok;
}
