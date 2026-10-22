import "server-only";
import { ChannelType, PermissionFlagsBits } from "discord-api-types/v10";
import { discordLoginEnabled, env } from "@/lib/env";
import { discordApi, discordBotEnabled, guildPath } from "./client";
import type { DiscordSettings } from "./settings";

type ApiRole = { id: string; name: string; position: number; managed: boolean; permissions: string; color: number };
type ApiChannel = { id: string; name: string; type: number; position: number; parent_id: string | null };

export type GuildOverview =
  | { state: "unconfigured"; login: boolean; missing: string[] }
  | { state: "error"; login: boolean; message: string }
  | {
      state: "ok";
      login: boolean;
      guild: { id: string; name: string; iconUrl: string | null; members: number | null };
      bot: { name: string; topRole: string | null; topPosition: number };
      textChannels: { id: string; name: string; category: string | null }[];
      categories: { id: string; name: string }[];
      roles: { id: string; name: string; position: number; manageable: boolean }[];
      missingPermissions: string[];
    };

const NEEDED: [keyof typeof PermissionFlagsBits, string][] = [
  ["ViewChannel", "View Channels"],
  ["SendMessages", "Send Messages"],
  ["EmbedLinks", "Embed Links"],
  ["AttachFiles", "Attach Files"],
  ["ReadMessageHistory", "Read Message History"],
  ["PinMessages", "Pin Messages"],
  ["ManageRoles", "Manage Roles"],
  ["ManageChannels", "Manage Channels"],
  ["ManageEvents", "Manage Events"],
  ["CreateInstantInvite", "Create Invite (needed to add members)"],
];

/** Everything /admin/discord shows: the server, what the bot can do, and the channels and roles to pick from. */
export async function guildOverview(): Promise<GuildOverview> {
  const login = discordLoginEnabled;
  if (!discordBotEnabled) {
    const missing = [!env.discordBotToken && "DISCORD_BOT_TOKEN", !env.discordGuildId && "DISCORD_GUILD_ID"].filter(Boolean) as string[];
    return { state: "unconfigured", login, missing };
  }
  const [guild, channels, roles, me] = await Promise.all([
    discordApi<{ id: string; name: string; icon: string | null; approximate_member_count?: number }>("GET", guildPath("?with_counts=true")),
    discordApi<ApiChannel[]>("GET", guildPath("/channels")),
    discordApi<ApiRole[]>("GET", guildPath("/roles")),
    discordApi<{ id: string; username: string }>("GET", "/users/@me"),
  ]);
  if (!guild.ok) {
    const message =
      guild.status === 401 ? "Discord rejected the bot token. Copy it again from the Developer Portal (Bot → Reset Token)."
      : guild.status === 403 || guild.status === 404 ? "The bot isn't in this server yet, or DISCORD_GUILD_ID is wrong. Invite the bot with the link below."
      : `Couldn't reach Discord: ${guild.message}`;
    return { state: "error", login, message };
  }
  if (!channels.ok || !roles.ok || !me.ok) return { state: "error", login, message: "Discord answered, but the channel or role list didn't load. Try again." };

  const member = await discordApi<{ roles: string[] }>("GET", guildPath(`/members/${me.data.id}`));
  const botRoles = roles.data.filter((r) => member.ok && member.data.roles.includes(r.id));
  const everyone = roles.data.find((r) => r.id === guild.data.id);
  const perms = [everyone, ...botRoles].reduce((p, r) => p | BigInt(r?.permissions ?? "0"), BigInt(0));
  const admin = (perms & PermissionFlagsBits.Administrator) !== BigInt(0);
  const top = botRoles.reduce<ApiRole | null>((a, r) => (!a || r.position > a.position ? r : a), null);
  const topPosition = top?.position ?? 0;

  const categories = channels.data.filter((c) => c.type === ChannelType.GuildCategory).sort((a, b) => a.position - b.position);
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  return {
    state: "ok",
    login,
    guild: {
      id: guild.data.id,
      name: guild.data.name,
      iconUrl: guild.data.icon ? `https://cdn.discordapp.com/icons/${guild.data.id}/${guild.data.icon}.png?size=64` : null,
      members: guild.data.approximate_member_count ?? null,
    },
    bot: { name: me.data.username, topRole: top?.name ?? null, topPosition },
    textChannels: channels.data
      .filter((c) => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement)
      .sort((a, b) => a.position - b.position)
      .map((c) => ({ id: c.id, name: c.name, category: c.parent_id ? catName.get(c.parent_id) ?? null : null })),
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
    roles: roles.data
      .filter((r) => r.id !== guild.data.id && !r.managed)
      .sort((a, b) => b.position - a.position)
      .map((r) => ({ id: r.id, name: r.name, position: r.position, manageable: r.position < topPosition })),
    missingPermissions: admin ? [] : NEEDED.filter(([flag]) => (perms & PermissionFlagsBits[flag]) === BigInt(0)).map(([, label]) => label),
  };
}

/** Roles picked in settings that sit above the bot's own, which Discord won't let it hand out. */
export function unmanageablePicks(o: Extract<GuildOverview, { state: "ok" }>, s: DiscordSettings) {
  const picked = [s.organiserRoleId, s.doorRoleId, s.camperRoleId].filter(Boolean);
  return o.roles.filter((r) => picked.includes(r.id) && !r.manageable).map((r) => r.name);
}

/** The bot's invite link with exactly the permissions the EMS uses. */
export function botInviteUrl() {
  if (!env.discordClientId) return null;
  const perms = NEEDED.reduce((p, [flag]) => p | PermissionFlagsBits[flag], BigInt(0));
  const q = new URLSearchParams({ client_id: env.discordClientId, scope: "bot", permissions: String(perms) });
  if (env.discordGuildId) q.set("guild_id", env.discordGuildId);
  return `https://discord.com/oauth2/authorize?${q}`;
}
