import { DiscordIcon } from "@/components/brand/discord-icon";
import { Notice } from "@/components/ui/notice";
import { discordBotEnabled } from "@/lib/discord/client";
import { getDiscordAccount, getDiscordProfile, getGuildMember } from "@/lib/discord/members";
import { discordLoginEnabled, env } from "@/lib/env";
import { LinkDiscordButton, UnlinkDiscordButton } from "./discord-link";

const ERRORS: Record<string, string> = {
  account_already_linked_to_different_user: "That Discord account is already linked to another Base Camp account. Sign in with it and unlink it there first.",
  "email_doesn't_match": "That Discord account couldn't be linked. Try again.",
  access_denied: "Discord linking was cancelled.",
};

/** The profile page's Discord section: link, or who you're linked as, whether you're in the server, unlink. */
export async function DiscordAccountCard({ userId, back, error }: { userId: string; back: string; error?: string }) {
  if (!discordLoginEnabled) return null;
  const account = await getDiscordAccount(userId);
  const [profile, member] = account && discordBotEnabled ? await Promise.all([getDiscordProfile(account.accountId), getGuildMember(account.accountId)]) : [null, null];
  const invite = env.discordInviteUrl;

  return (
    <section aria-labelledby="discord-h" className="space-y-3 rounded-[20px] border bg-card p-5">
      <div className="flex items-center gap-2.5">
        <DiscordIcon className="size-5 text-[#5865F2]" />
        <h2 id="discord-h" className="text-lg font-extrabold">Discord</h2>
      </div>
      {error && <Notice tone="destructive" title="Not linked">{ERRORS[error] ?? "Something went wrong talking to Discord. Try again."}</Notice>}
      {account ? (
        <>
          <div className="flex items-center gap-3">
            {profile?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt="" className="size-10 rounded-full" />
            ) : (
              <span className="grid size-10 place-items-center rounded-full bg-[#5865F2]/15" aria-hidden><DiscordIcon className="size-5 text-[#5865F2]" /></span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{profile ? profile.globalName ?? profile.username : "Linked"}</p>
              <p className="truncate text-xs text-muted-foreground">
                {profile && <>@{profile.username} · </>}
                {discordBotEnabled ? (member ? "In the Baguio Base Camp server" : "Not in the server yet") : "Linked"}
              </p>
            </div>
            <UnlinkDiscordButton />
          </div>
          {discordBotEnabled && !member && invite && (
            <p className="text-[13px] text-muted-foreground">
              <a href={invite} target="_blank" rel="noreferrer" className="font-semibold text-accent-foreground hover:underline">Join the server</a> to get your event roles and chats.
            </p>
          )}
          {discordBotEnabled && member && <p className="text-[13px] leading-relaxed text-muted-foreground">Your tickets give you each event&apos;s role and its chat, if it has one. They&apos;re removed a few days after the event.</p>}
        </>
      ) : (
        <>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Link your Discord to join the Baguio Base Camp server and get each event&apos;s role and chat when you have a ticket. Optional: tickets and emails work the same either way.
          </p>
          <LinkDiscordButton back={back} className="h-11 w-full rounded-full sm:w-auto" />
        </>
      )}
    </section>
  );
}
