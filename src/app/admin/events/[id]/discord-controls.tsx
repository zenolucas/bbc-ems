"use client";
import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setEventChatAction, syncEventDiscordAction } from "@/app/admin/discord/actions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { runAction } from "@/lib/run-action";

const SAID: Record<string, string> = {
  posted: "Posted to Discord",
  edited: "Discord post updated",
  deleted: "Discord post removed",
  unchanged: "Discord is up to date",
  off: "Synced",
  failed: "Discord didn't accept the post. Check the bot's permissions on the Discord page.",
};

export function DiscordEventControls({ eventId, wantsChannel, canChat, chatHint, showChat }: { eventId: string; wantsChannel: boolean; canChat: boolean; chatHint?: string; showChat: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [syncing, setSyncing] = useState(false);
  return (
    <div className="space-y-3 border-t pt-3">
      {showChat && (
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Ticket holders&apos; chat</div>
            <p className="text-xs leading-normal text-muted-foreground">{chatHint ?? "A private channel for people with tickets and crew. Members need to link Discord to get in."}</p>
          </div>
          <Switch
            checked={wantsChannel}
            disabled={pending || (!canChat && !wantsChannel)}
            aria-label="Ticket holders' chat"
            onCheckedChange={(on) => start(async () => { if (await runAction(() => setEventChatAction(eventId, on), { success: on ? "Chat on. It opens once the event is published." : "Chat off. An existing channel stays as it is." })) router.refresh(); })}
          />
        </div>
      )}
      <Button
        variant="outline"
        size="sm"
        className="h-9 w-full rounded-full"
        disabled={syncing}
        onClick={async () => {
          setSyncing(true);
          const ok = await runAction(() => syncEventDiscordAction(eventId), { success: (r) => SAID[r.announcement] ?? "Synced" });
          setSyncing(false);
          if (ok) router.refresh();
        }}
      >
        {syncing ? <Loader2 className="animate-spin" /> : <RefreshCw />} Sync with Discord now
      </Button>
    </div>
  );
}
