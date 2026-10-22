import { MessagesSquare } from "lucide-react";
import { PageHeader } from "@/components/admin/panel";
import { CopyButton } from "@/components/ui/copy-button";
import { Notice } from "@/components/ui/notice";
import { isDemoDeployment } from "@/lib/demo/flag";
import { botInviteUrl, guildOverview, unmanageablePicks } from "@/lib/discord/guild";
import { getDiscordSettings } from "@/lib/discord/settings";
import { notFound } from "next/navigation";
import { discordEnabled, env } from "@/lib/env";
import { requireAdmin } from "@/lib/session";
import { DiscordActions, DiscordSettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discord" };

export default async function DiscordPage() {
  await requireAdmin();
  if (!discordEnabled) notFound();
  const [overview, settings, demo] = await Promise.all([guildOverview(), getDiscordSettings(), isDemoDeployment()]);
  const invite = botInviteUrl();
  const callback = `${env.appUrl}/api/auth/callback/discord`;
  const ok = overview.state === "ok" ? overview : null;
  const tooHigh = ok ? unmanageablePicks(ok, settings) : [];

  return (
    <div className="max-w-3xl space-y-[18px]">
      <PageHeader
        title={<span className="flex items-center gap-2.5"><MessagesSquare className="size-6 text-muted-foreground" aria-hidden /> Discord</span>}
        sub="Announce events in the server, give ticket holders and crew their roles, and let members link their Discord. Email stays the main channel; Discord is extra."
      />

      {demo && (
        <Notice tone="info" title="Demo site">
          Announcements and reminders also land in the outbox on Demo tools, so you can show them without a server.
        </Notice>
      )}

      {overview.state === "unconfigured" && (
        <Notice tone="warn" title="The bot isn't connected">
          Add {overview.missing.join(" and ")} to this deployment&apos;s environment, then reload. Steps are below.
        </Notice>
      )}
      {overview.state === "error" && (
        <Notice tone="destructive" title="Can't reach the server" actions={invite ? <a href={invite} target="_blank" rel="noreferrer" className="text-sm font-semibold underline">Invite the bot</a> : undefined}>
          {overview.message}
        </Notice>
      )}
      {!overview.login && (
        <Notice tone="info" title="Linking Discord accounts is off">
          Set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET to show &ldquo;Continue with Discord&rdquo; and the link button on account pages. Roles need members to link.
        </Notice>
      )}

      {ok && (
        <section aria-labelledby="server-h" className="flex items-center gap-3.5 rounded-[18px] border bg-card p-4">
          {ok.guild.iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ok.guild.iconUrl} alt="" className="size-12 rounded-2xl" />
          ) : (
            <span className="grid size-12 place-items-center rounded-2xl bg-surface-2 font-display text-lg font-extrabold" aria-hidden>{ok.guild.name.slice(0, 1)}</span>
          )}
          <div className="min-w-0 flex-1">
            <h2 id="server-h" className="truncate font-display text-lg font-extrabold">{ok.guild.name}</h2>
            <p className="text-xs text-muted-foreground">
              {ok.guild.members != null && <>{ok.guild.members} member{ok.guild.members === 1 ? "" : "s"} · </>}Bot: {ok.bot.name}
              {ok.bot.topRole && <> · top role &ldquo;{ok.bot.topRole}&rdquo;</>}
            </p>
          </div>
          <span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success-foreground">Connected</span>
        </section>
      )}

      {ok && ok.missingPermissions.length > 0 && (
        <Notice tone="warn" title="The bot is missing permissions" actions={invite ? <a href={invite} target="_blank" rel="noreferrer" className="text-sm font-semibold underline">Re-invite with the right ones</a> : undefined}>
          {ok.missingPermissions.join(", ")}. Without them some posts, roles or chats will fail.
        </Notice>
      )}
      {tooHigh.length > 0 && (
        <Notice tone="warn" title="Move the bot's role up">
          {tooHigh.map((n) => `“${n}”`).join(", ")} {tooHigh.length === 1 ? "sits" : "sit"} above the bot&apos;s role, so it can&apos;t hand {tooHigh.length === 1 ? "it" : "them"} out. In Server Settings → Roles, drag {ok?.bot.topRole ? `“${ok.bot.topRole}”` : "the bot's role"} above {tooHigh.length === 1 ? "it" : "them"}.
        </Notice>
      )}

      {ok && <DiscordSettingsForm initial={settings} channels={ok.textChannels} categories={ok.categories} roles={ok.roles} />}

      {(ok || demo) && <DiscordActions canTestPost={Boolean(ok && settings.eventsChannelId)} />}

      <section aria-labelledby="setup-h" className="rounded-[18px] border bg-card p-4 text-sm">
        <h2 id="setup-h" className="mb-2 font-display text-lg font-extrabold">Setup</h2>
        <ol className="list-decimal space-y-2 pl-5 text-[13px] leading-relaxed text-muted-foreground">
          <li>
            In the <a className="font-semibold text-foreground underline" href="https://discord.com/developers/applications" target="_blank" rel="noreferrer">Discord Developer Portal</a>, open your application. Under OAuth2, add this redirect:
            <span className="mt-1.5 flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 font-mono text-xs text-foreground">
              <span className="min-w-0 flex-1 truncate">{callback}</span>
              <CopyButton value={callback} label="redirect URL" />
            </span>
          </li>
          <li>Copy the Client ID and Client Secret into DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET, and the bot token (Bot → Reset Token) into DISCORD_BOT_TOKEN.</li>
          <li>Right-click the server name in Discord (with Developer Mode on) → Copy Server ID, into DISCORD_GUILD_ID. Use a private test server for local and demo sites.</li>
          <li>
            {invite ? <a className="font-semibold text-foreground underline" href={invite} target="_blank" rel="noreferrer">Invite the bot</a> : "Invite the bot"} with the permissions it needs.
            Then in Server Settings → Roles, drag the bot&apos;s role above every role it should hand out.
          </li>
          <li>Set DISCORD_INVITE_URL to a non-expiring invite so the site can link to the server. Redeploy, then pick channels and roles above.</li>
        </ol>
      </section>
    </div>
  );
}
