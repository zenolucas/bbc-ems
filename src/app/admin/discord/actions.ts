"use server";
import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { discordEventSync } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { discordApi, discordBotEnabled } from "@/lib/discord/client";
import { discordSettingsSchema, getDiscordSettings, saveDiscordSettings, type DiscordSettings } from "@/lib/discord/settings";
import { discordActive, resyncAllDiscord, syncDiscordEvent } from "@/lib/discord/sync";
import { env } from "@/lib/env";
import { requireAdmin } from "@/lib/session";

export async function saveDiscordSettingsAction(input: DiscordSettings): Promise<ActionResult> {
  await requireAdmin();
  const parsed = discordSettingsSchema.safeParse(input);
  if (!parsed.success) return { error: "Those settings didn't look right. Reload and try again." };
  await saveDiscordSettings(parsed.data);
  revalidatePath("/admin/discord");
  return { ok: true };
}

/** A short message in the events channel, so organisers can see the bot can post there. */
export async function sendTestPostAction(): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!discordBotEnabled) return { error: "Set DISCORD_BOT_TOKEN and DISCORD_GUILD_ID first" };
  const s = await getDiscordSettings();
  if (!s.eventsChannelId) return { error: "Pick an events channel and save first" };
  const res = await discordApi("POST", `/channels/${s.eventsChannelId}/messages`, {
    body: { content: `👋 Test from Baguio Base Camp (${env.appUrl}), sent by ${admin.name || "an organiser"}. Events will be announced here.`, allowed_mentions: { parse: [] } },
  });
  if (!res.ok) return { error: res.status === 403 ? "The bot can't post in that channel. Give it Send Messages and Embed Links there." : `Discord said: ${res.message}` };
  return { ok: true };
}

export async function resyncAllDiscordAction(): Promise<ActionResult<{ events: number; posted: number; edited: number; members: number; synced: number }>> {
  await requireAdmin();
  if (!(await discordActive())) return { error: "Discord isn't set up on this deployment" };
  const r = await resyncAllDiscord();
  revalidatePath("/admin", "layout");
  return { ok: true, events: r.events, posted: r.posted, edited: r.edited, members: r.members, synced: r.roles.synced ?? 0 };
}

export async function syncEventDiscordAction(eventId: string): Promise<ActionResult<{ announcement: string }>> {
  await requireAdmin();
  if (!(await discordActive())) return { error: "Discord isn't set up on this deployment" };
  const r = await syncDiscordEvent(eventId, { force: true });
  if (r.skipped === "busy") return { error: "A sync for this event is already running. Try again in a moment." };
  if (r.announcement === "failed") return { error: "Discord didn't accept the post. Check the bot's permissions on the Discord page." };
  revalidatePath(`/admin/events/${eventId}`);
  return { ok: true, announcement: r.announcement };
}

/** The ticket holders' chat for one event. Turning it off leaves an existing chat alone. */
export async function setEventChatAction(eventId: string, on: boolean): Promise<ActionResult> {
  await requireAdmin();
  await db
    .insert(discordEventSync)
    .values({ eventId, wantsChannel: on })
    .onConflictDoUpdate({ target: discordEventSync.eventId, set: { wantsChannel: on, updatedAt: sql`now()` } });
  if (on && discordBotEnabled) await syncDiscordEvent(eventId);
  revalidatePath(`/admin/events/${eventId}`);
  return { ok: true };
}
