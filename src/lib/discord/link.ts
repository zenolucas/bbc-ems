import "server-only";
import { discordBotEnabled } from "./client";
import { joinGuild } from "./members";
import { syncMemberRoles } from "./roles";
import { getDiscordSettings } from "./settings";
import { discordLater } from "./sync";

type LinkedAccount = { providerId: string; accountId: string; userId: string; accessToken?: string | null; scope?: string | null };

/**
 * Runs when someone links Discord or signs in with it (better-auth's account hooks): adds
 * them to the server if they asked for guilds.join and aren't in it, then hands out their
 * roles. After the response, so the sign-in redirect isn't kept waiting on Discord.
 */
export async function onDiscordAccountLinked(account: LinkedAccount) {
  if (account.providerId !== "discord" || !discordBotEnabled) return;
  const { userId, accountId, accessToken, scope } = account;
  discordLater("link", async () => {
    const s = await getDiscordSettings();
    if (s.autoJoin && accessToken && scope?.split(/[ ,]/).includes("guilds.join")) await joinGuild(accountId, accessToken);
    await syncMemberRoles(userId);
  });
}
