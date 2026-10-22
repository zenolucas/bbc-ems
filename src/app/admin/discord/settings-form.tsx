"use client";
import { Loader2, RefreshCw, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { DiscordSettings } from "@/lib/discord/settings";
import { runAction } from "@/lib/run-action";
import { resyncAllDiscordAction, saveDiscordSettingsAction, sendTestPostAction } from "./actions";

type Opt = { id: string; name: string };
type Channel = Opt & { category: string | null };
type Role = Opt & { manageable: boolean };

const NONE = "none";
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Channel and role picks plus the feature switches. Nothing is saved until "Save". */
export function DiscordSettingsForm({ initial, channels, categories, roles }: { initial: DiscordSettings; channels: Channel[]; categories: Opt[]; roles: Role[] }) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [pending, start] = useTransition();
  const dirty = (Object.keys({ ...s, ...initial }) as (keyof DiscordSettings)[]).some((k) => s[k] !== initial[k]);
  const set = <K extends keyof DiscordSettings>(k: K, v: DiscordSettings[K]) => setS((p) => ({ ...p, [k]: v }));

  const channelOpts = channels.map((c) => ({ id: c.id, name: `#${c.name}${c.category ? ` · ${c.category}` : ""}` }));
  const roleOpts = roles.map((r) => ({ id: r.id, name: r.manageable ? r.name : `${r.name} (above the bot)` }));

  return (
    <section aria-labelledby="settings-h" className="overflow-hidden rounded-[18px] border bg-card">
      <h2 id="settings-h" className="px-4 pt-3.5 font-display text-lg font-extrabold sm:px-5">Channels and roles</h2>
      <Group title="Announcements">
        <Pick id="eventsChannelId" label="Events channel" hint="Each published event gets one post here, kept up to date: seats left, sold out, cancelled." value={s.eventsChannelId} options={channelOpts} onChange={(v) => set("eventsChannelId", v)} />
        <Toggle label="Discord events" hint="Also create a native Discord event, so people can tap Interested and get Discord's own reminder." checked={s.scheduledEvents} onChange={(v) => set("scheduledEvents", v)} />
        <Toggle label="Day-before reminder" hint="A short “tomorrow” post in the events channel for events that still have seats." checked={s.reminderPosts} onChange={(v) => set("reminderPosts", v)} />
      </Group>
      <Group title="Roles">
        <Pick id="organiserRoleId" label="Organisers" hint="Given to admins on this site." value={s.organiserRoleId} options={roleOpts} onChange={(v) => set("organiserRoleId", v)} />
        <Pick id="doorRoleId" label="Door crew" hint="Given to door crew on this site." value={s.doorRoleId} options={roleOpts} onChange={(v) => set("doorRoleId", v)} />
        <Pick id="camperRoleId" label="Campers" hint="Anyone who has had a confirmed booking." value={s.camperRoleId} options={roleOpts} onChange={(v) => set("camperRoleId", v)} />
        <Toggle label="Event roles" hint="A role per event for its ticket holders, removed a few days after it ends." checked={s.eventRoles} onChange={(v) => set("eventRoles", v)} />
        <Toggle label="Add to the server on link" hint="Members who link Discord join the server automatically if they aren't in it yet." checked={s.autoJoin} onChange={(v) => set("autoJoin", v)} />
      </Group>
      <Group title="Ticket holders' chats">
        <Pick id="chatsCategoryId" label="Chats category" hint="Turn on a chat per event from the event's page. It's private to ticket holders and crew." value={s.chatsCategoryId} options={categories} onChange={(v) => set("chatsCategoryId", v)} />
        <Pick id="archiveCategoryId" label="Archive category" hint="Where a chat moves a few days after the event. Only crew can still read it." value={s.archiveCategoryId} options={categories} onChange={(v) => set("archiveCategoryId", v)} />
      </Group>
      <div className="flex items-center justify-end gap-2 border-t px-4 py-3 sm:px-5">
        {dirty && <Button variant="ghost" className="rounded-full" disabled={pending} onClick={() => setS(initial)}>Undo</Button>}
        <Button
          className="rounded-full"
          disabled={!dirty || pending}
          onClick={() => start(async () => { if (await runAction(() => saveDiscordSettingsAction(s), { success: "Discord settings saved" })) router.refresh(); })}
        >
          {pending && <Loader2 className="animate-spin" />} Save
        </Button>
      </div>
    </section>
  );
}

export function DiscordActions({ canTestPost }: { canTestPost: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"test" | "resync" | null>(null);
  return (
    <section aria-labelledby="tools-h" className="divide-y overflow-hidden rounded-[18px] border bg-card">
      <h2 id="tools-h" className="sr-only">Tools</h2>
      <Row title="Send a test post" detail="Checks the bot can post in the events channel.">
        <Button
          variant="outline"
          className="rounded-full"
          disabled={!canTestPost || busy !== null}
          onClick={async () => {
            setBusy("test");
            await runAction(() => sendTestPostAction(), { success: "Posted. Check the channel." });
            setBusy(null);
          }}
        >
          {busy === "test" ? <Loader2 className="animate-spin" /> : <Send />} Test
        </Button>
      </Row>
      <Row title="Resync everything" detail="Posts or updates every upcoming event, then re-checks every linked member's roles. Use it after changing settings or connecting a new server.">
        <Button
          variant="outline"
          className="rounded-full"
          disabled={busy !== null}
          onClick={async () => {
            setBusy("resync");
            const ok = await runAction(() => resyncAllDiscordAction(), {
              success: (r) => `${plural(r.events, "event")} checked (${r.posted} posted, ${r.edited} updated), ${plural(r.synced, "member")} of ${r.members} synced`,
            });
            setBusy(null);
            if (ok) router.refresh();
          }}
        >
          {busy === "resync" ? <Loader2 className="animate-spin" /> : <RefreshCw />} Resync
        </Button>
      </Row>
    </section>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 border-t first:mt-0">
      <h3 className="px-4 pt-3 text-xs font-bold tracking-wide text-muted-foreground uppercase sm:px-5">{title}</h3>
      {children}
    </div>
  );
}

function Pick({ id, label, hint, value, options, onChange }: { id: string; label: string; hint: string; value?: string; options: Opt[]; onChange: (v: string | undefined) => void }) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
      <div className="min-w-0 flex-1">
        <Label htmlFor={id} className="text-sm font-semibold">{label}</Label>
        <p className="mt-0.5 text-xs leading-normal text-muted-foreground">{hint}</p>
      </div>
      <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? undefined : v)}>
        <SelectTrigger id={id} className="h-10 w-full rounded-xl sm:w-60"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>None</SelectItem>
          {options.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row title={label} detail={hint}>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </Row>
  );
}

function Row({ title, detail, children }: { title: string; detail: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 sm:px-5">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{title}</div>
        <p className="mt-0.5 text-xs leading-normal text-muted-foreground">{detail}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
