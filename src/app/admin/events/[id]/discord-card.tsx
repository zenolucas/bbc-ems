import Link from "next/link";
import { eq } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import { db } from "@/db/client";
import { discordEventSync } from "@/db/schema";
import { isDemoDeployment } from "@/lib/demo/flag";
import { channelUrl, discordBotEnabled, messageUrl, scheduledEventUrl } from "@/lib/discord/client";
import { eventRoleName } from "@/lib/discord/roles";
import { getDiscordSettings } from "@/lib/discord/settings";
import { discordEnabled } from "@/lib/env";
import { relative } from "@/lib/format";
import { DiscordEventControls } from "./discord-controls";

/** What this event looks like on the Discord server, with a resync button and the chat switch. */
export async function DiscordEventCard({ event }: { event: { id: string; title: string; startsAt: Date; status: string } }) {
  if (!discordEnabled) return null;
  const demo = await isDemoDeployment();
  if (!discordBotEnabled && !demo) return null;
  const [row, s] = await Promise.all([db.query.discordEventSync.findFirst({ where: eq(discordEventSync.eventId, event.id) }), getDiscordSettings()]);
  const draft = event.status === "draft";

  const items: { label: string; value: React.ReactNode }[] = [];
  if (!discordBotEnabled) {
    items.push({ label: "Post", value: row?.lastStateHash ? "Captured in the demo outbox" : draft ? "Goes out when you publish" : "Not yet" });
  } else {
    items.push({
      label: "Post",
      value: !s.eventsChannelId ? (
        <Link href="/admin/discord" className="font-semibold underline">Pick an events channel</Link>
      ) : row?.messageId && row.messageChannelId ? (
        <Ext href={messageUrl(row.messageChannelId, row.messageId)}>In the events channel</Ext>
      ) : draft ? "Goes out when you publish" : "Not posted yet",
    });
    if (s.scheduledEvents) items.push({ label: "Discord event", value: row?.scheduledEventId ? <Ext href={scheduledEventUrl(row.scheduledEventId)}>Scheduled</Ext> : draft ? "Created when you publish" : "None" });
    if (s.eventRoles) items.push({ label: "Ticket holders' role", value: row?.archivedAt ? "Removed after the event" : row?.roleId ? eventRoleName(event) : draft ? "Created when you publish" : "None" });
    if (row?.channelId) items.push({ label: "Chat", value: <Ext href={channelUrl(row.channelId)}>{row.archivedAt ? "Archived" : "Open"}</Ext> });
  }

  return (
    <section aria-labelledby="discord-h" className="flex flex-col gap-3 rounded-[18px] border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="discord-h" className="font-display text-lg font-extrabold">Discord</h2>
        {row?.updatedAt && <span className="text-xs text-muted-foreground">synced {relative(row.updatedAt)}</span>}
      </div>
      <dl className="space-y-1.5 text-[13px]">
        {items.map((i) => (
          <div key={i.label} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{i.label}</dt>
            <dd className="min-w-0 truncate text-right font-medium">{i.value}</dd>
          </div>
        ))}
      </dl>
      <DiscordEventControls
        eventId={event.id}
        wantsChannel={row?.wantsChannel ?? false}
        canChat={discordBotEnabled && Boolean(s.chatsCategoryId) && s.eventRoles && !row?.archivedAt}
        chatHint={!s.chatsCategoryId ? "Pick a chats category on the Discord page first." : !s.eventRoles ? "Turn on event roles on the Discord page first." : undefined}
        showChat={discordBotEnabled}
      />
    </section>
  );
}

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-accent-foreground hover:underline">
      {children} <ExternalLink className="size-3" aria-hidden />
    </a>
  );
}
