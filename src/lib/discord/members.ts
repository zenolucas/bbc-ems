import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts } from "@/db/schema";
import { discordApi, guildPath } from "./client";

/** The member's linked Discord account, if any. */
export async function getDiscordAccount(userId: string) {
  return db.query.accounts.findFirst({
    where: and(eq(accounts.userId, userId), eq(accounts.providerId, "discord")),
    columns: { id: true, accountId: true, accessToken: true, scope: true, createdAt: true },
  });
}

export async function getDiscordId(userId: string) {
  return (await getDiscordAccount(userId))?.accountId ?? null;
}

export type DiscordProfile = { id: string; username: string; globalName: string | null; avatarUrl: string | null };

/** Username and avatar for the account page, looked up as the bot so we never need the member's token. */
export async function getDiscordProfile(discordId: string): Promise<DiscordProfile | null> {
  const res = await discordApi<{ id: string; username: string; global_name: string | null; avatar: string | null }>("GET", `/users/${discordId}`);
  if (!res.ok) return null;
  const u = res.data;
  return {
    id: u.id,
    username: u.username,
    globalName: u.global_name,
    avatarUrl: u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64` : null,
  };
}

export type GuildMember = { roles: string[]; user?: { id: string } };

/** null when they aren't in the server. */
export async function getGuildMember(discordId: string) {
  const res = await discordApi<GuildMember>("GET", guildPath(`/members/${discordId}`), { expect: [404] });
  return res.ok ? res.data : null;
}

/**
 * Adds a member to the server with the access token from their Discord sign-in
 * (needs the `guilds.join` scope). Already being a member is fine (Discord answers 204).
 */
export async function joinGuild(discordId: string, accessToken: string) {
  const res = await discordApi("PUT", guildPath(`/members/${discordId}`), {
    body: { access_token: accessToken },
    reason: "Linked their Baguio Base Camp account",
  });
  return res.ok ? (res.status === 201 ? "joined" : "already-member") : "failed";
}
