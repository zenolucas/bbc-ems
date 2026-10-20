"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Download, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/event/status-badge";
import { FilterPills } from "@/components/admin/filter-pills";
import { Meter } from "@/components/admin/panel";
import { fmtTime } from "@/lib/format";
import { runAction } from "@/lib/run-action";
import { cn } from "@/lib/utils";
import { manualCheckinAction, undoCheckinAction } from "@/app/admin/attendee-actions";
import { resendTicketsAction, voidTicketAction } from "@/app/admin/booking-actions";

type Row = { id: string; code: string; holder: string; email: string; tier: string; status: string; checkedInAt: string | null; bookingId: string };
type StatusFilter = "all" | "valid" | "used" | "void";
type Progress = { used: number; live: number; doorLine: string; csv: string | null };

const STATUS_LABEL: Record<StatusFilter, string> = { all: "All", valid: "Not in yet", used: "Checked in", void: "Voided" };
const ghost = "h-8 rounded-full px-2.5 text-xs font-semibold text-muted-foreground";

/** Wraps each case-insensitive hit of `q` in a <mark> so a search shows why a row matched. */
function Hit({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const lower = text.toLowerCase();
  const parts: React.ReactNode[] = [];
  let i = 0;
  for (let at = lower.indexOf(q); at !== -1; at = lower.indexOf(q, i)) {
    if (at > i) parts.push(text.slice(i, at));
    parts.push(<mark key={at} className="rounded-[3px] bg-warning-soft text-inherit">{text.slice(at, at + q.length)}</mark>);
    i = at + q.length;
  }
  parts.push(text.slice(i));
  return <>{parts}</>;
}

export function AttendeeTable({ eventId, rows, isAdmin, tiers, progress }: { eventId: string; rows: Row[]; isAdmin: boolean; tiers: string[]; progress: Progress }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [tier, setTier] = useState<string>("all");
  const [code, setCode] = useState("");
  const [pending, start] = useTransition();
  const [busyRow, setBusyRow] = useState<string | null>(null);

  const counts = useMemo(() => ({
    all: rows.length,
    valid: rows.filter((r) => r.status === "valid").length,
    used: rows.filter((r) => r.status === "used").length,
    void: rows.filter((r) => r.status === "void").length,
  }), [rows]);

  const s = q.trim().toLowerCase();
  const list = useMemo(() => rows.filter((r) =>
    (status === "all" || r.status === status) &&
    (tier === "all" || r.tier === tier) &&
    (!s || [r.holder, r.email, r.code, r.tier].some((v) => v.toLowerCase().includes(s.replace(/\s/g, "")) || v.toLowerCase().includes(s))),
  ), [s, rows, status, tier]);

  const rowAction = (id: string, fn: () => Promise<boolean>) => {
    setBusyRow(id);
    void fn().then((ok) => { if (ok) router.refresh(); }).finally(() => setBusyRow(null));
  };

  function actions(r: Row, busy: boolean) {
    if (r.status === "void") return <span className="text-xs text-muted-foreground">no actions</span>;
    return (
      <>
        {r.status === "valid" && (
          <Button size="sm" variant="outline" className="h-8 rounded-full px-3 text-xs" disabled={busy} onClick={() => rowAction(r.id, () => runAction(() => manualCheckinAction(eventId, r.code), { success: (x) => x.message }))}>
            {busy && <Loader2 className="animate-spin" />} Check in
          </Button>
        )}
        {r.status === "used" && (
          <ConfirmDialog
            title={`Undo check-in for ${r.holder}?`}
            description="Their ticket will scan as valid again. Use this if someone was checked in by mistake."
            confirmLabel="Undo check-in"
            onConfirm={async () => { const ok = await runAction(() => undoCheckinAction(eventId, r.id), { success: "Check-in undone" }); if (ok) router.refresh(); }}
            trigger={(open) => <Button size="sm" variant="ghost" className={ghost} disabled={busy} onClick={open}>Undo</Button>}
          />
        )}
        {isAdmin && (
          <Button size="sm" variant="ghost" className={ghost} disabled={busy} onClick={() => rowAction(r.id, () => runAction(() => resendTicketsAction(r.bookingId), { success: "Tickets re-sent" }))}>Resend</Button>
        )}
        {isAdmin && (
          <ConfirmDialog
            title={`Void ${r.code}?`}
            description={`${r.holder}'s ticket will stop scanning. This can't be undone, and the member isn't emailed. To refund a whole booking, cancel it from the Bookings tab instead.`}
            confirmLabel="Void ticket"
            destructive
            onConfirm={async () => { const ok = await runAction(() => voidTicketAction(r.id, eventId), { success: `${r.code} voided` }); if (ok) router.refresh(); }}
            trigger={(open) => <Button size="sm" variant="ghost" className={cn(ghost, "text-destructive")} disabled={busy} onClick={open}>Void</Button>}
          />
        )}
      </>
    );
  }

  const when = (r: Row) => (r.status === "used" && r.checkedInAt ? fmtTime(r.checkedInAt) : r.status === "valid" ? "not in yet" : null);

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-stretch gap-3">
        <form
          className="flex min-w-0 flex-[1_1_320px] gap-2 rounded-2xl border bg-card p-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const ok = await runAction(() => manualCheckinAction(eventId, code), { success: (r) => r.message });
              if (ok) { setCode(""); router.refresh(); }
            });
          }}
        >
          <label htmlFor="manual-code" className="sr-only">Ticket code</label>
          <input
            id="manual-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Check in by code: BBC-XXXX-XXXX"
            className="h-11 min-w-0 flex-1 rounded-xl border bg-background px-3.5 font-mono text-base tracking-[0.06em] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-[15px]"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
          />
          <Button type="submit" className="h-11 rounded-full px-[18px]" disabled={pending || !code}>{pending && <Loader2 className="animate-spin" />} Check in</Button>
        </form>
        <div className="flex min-w-0 flex-[1_1_320px] items-center gap-2.5 rounded-2xl border bg-card px-3.5 py-2.5">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2 text-[13px]">
              <span className="whitespace-nowrap"><span className="font-display text-xl font-extrabold tabular-nums">{progress.used}</span> <span className="text-muted-foreground">of {progress.live} in</span></span>
              <span className="truncate text-xs text-muted-foreground">{progress.doorLine}</span>
            </div>
            <Meter value={progress.live ? (progress.used / progress.live) * 100 : 0} label="Checked in" />
          </div>
          {progress.csv && <Button asChild variant="outline" className="h-[38px] shrink-0 rounded-full px-3.5 text-[13px]"><a href={progress.csv}><Download /> CSV</a></Button>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <FilterPills label="Status" value={status} onChange={setStatus} options={(Object.keys(STATUS_LABEL) as StatusFilter[]).map((k) => ({ value: k, label: STATUS_LABEL[k], count: counts[k] }))} />
        {tiers.length > 1 && (
          <>
            <label htmlFor="tier-filter" className="sr-only">Filter by tier</label>
            <select id="tier-filter" value={tier} onChange={(e) => setTier(e.target.value)} className="h-10 rounded-full border bg-card px-3.5 text-base font-semibold text-foreground md:text-[13px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              <option value="all">All tiers</option>
              {tiers.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </>
        )}
        <div className="hidden flex-1 md:block" />
        <div className="relative flex w-full items-center md:w-60">
          <Search className="pointer-events-none absolute left-3.5 size-4 text-muted-foreground" aria-hidden />
          <label htmlFor="attendee-search" className="sr-only">Search attendees</label>
          <input id="attendee-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={isAdmin ? "Name, email, code or tier" : "Name, code or tier"} className="h-10 w-full rounded-full border bg-card pr-3.5 pl-9 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-[13px]" />
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState>{rows.length === 0 ? "No tickets issued yet." : "No attendees match those filters."}</EmptyState>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-[18px] border bg-card md:block">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
                  <th className="border-b px-3.5 py-3 font-bold">Guest</th>
                  <th className="border-b px-3.5 py-3 font-bold">Code</th>
                  <th className="border-b px-3.5 py-3 font-bold">Tier</th>
                  <th className="border-b px-3.5 py-3 font-bold">Status</th>
                  {isAdmin && <th className="border-b px-3.5 py-3 font-bold">Booking</th>}
                  <th className="border-b px-3.5 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className={cn("border-b last:border-b-0", r.status === "void" && "opacity-65")}>
                    <td className="px-3.5 py-3">
                      <div className={cn("font-semibold", r.status === "void" && "line-through")}><Hit text={r.holder} q={s} /></div>
                      {r.email && <div className="text-xs text-muted-foreground"><Hit text={r.email} q={s} /></div>}
                    </td>
                    <td className="px-3.5 py-3 font-mono text-[13px] tracking-[0.04em] whitespace-nowrap"><Hit text={r.code} q={s} /></td>
                    <td className="px-3.5 py-3"><Hit text={r.tier} q={s} /></td>
                    <td className="px-3.5 py-3 whitespace-nowrap"><StatusBadge status={r.status} admin /> {when(r) && <span className="text-xs text-muted-foreground">{when(r)}</span>}</td>
                    {isAdmin && <td className="px-3.5 py-3"><Link href={`/bookings/${r.bookingId}`} className="font-mono text-xs text-accent-foreground hover:underline">{r.bookingId}</Link></td>}
                    <td className="px-3.5 py-3 text-right whitespace-nowrap">{actions(r, busyRow === r.id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="overflow-hidden rounded-[18px] border bg-card md:hidden">
            {list.map((r) => (
              <li key={r.id} className={cn("space-y-2 border-t px-3.5 py-3 first:border-t-0", r.status === "void" && "opacity-65")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className={cn("truncate font-semibold", r.status === "void" && "line-through")}><Hit text={r.holder} q={s} /></div>
                    <div className="truncate text-xs text-muted-foreground"><span className="font-mono"><Hit text={r.code} q={s} /></span> · <Hit text={r.tier} q={s} /></div>
                    {r.email && <div className="truncate text-xs text-muted-foreground"><Hit text={r.email} q={s} /></div>}
                  </div>
                  <div className="shrink-0 text-right">
                    <StatusBadge status={r.status} admin />
                    {r.status === "used" && r.checkedInAt && <div className="mt-1 text-[11px] text-muted-foreground">at {fmtTime(r.checkedInAt)}</div>}
                  </div>
                </div>
                <div className="-ml-2.5 flex flex-wrap items-center gap-1">
                  {actions(r, busyRow === r.id)}
                  {isAdmin && <Link href={`/bookings/${r.bookingId}`} className="ml-auto font-mono text-[11px] text-accent-foreground hover:underline">{r.bookingId}</Link>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="text-xs text-muted-foreground">
        {s ? `${list.length} of ${rows.length} match “${q.trim()}”. ` : ""}
        {isAdmin ? "Door crew see this page without emails or booking links. " : ""}Undo is for mistakes at the door; Void stops a ticket for good and doesn&apos;t email anyone.
      </p>
    </div>
  );
}
