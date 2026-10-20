"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/event/status-badge";
import { fmtTime } from "@/lib/format";
import { runAction } from "@/lib/run-action";
import { cn } from "@/lib/utils";
import { manualCheckinAction, undoCheckinAction } from "@/app/admin/attendee-actions";
import { resendTicketsAction, voidTicketAction } from "@/app/admin/booking-actions";

type Row = { id: string; code: string; holder: string; email: string; tier: string; status: string; checkedInAt: string | null; bookingId: string };
type StatusFilter = "all" | "valid" | "used" | "void";

const STATUS_LABEL: Record<StatusFilter, string> = { all: "All", valid: "Not in yet", used: "Checked in", void: "Voided" };

export function AttendeeTable({ eventId, rows, isAdmin, tiers }: { eventId: string; rows: Row[]; isAdmin: boolean; tiers: string[] }) {
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

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) =>
      (status === "all" || r.status === status) &&
      (tier === "all" || r.tier === tier) &&
      (!s || [r.holder, r.email, r.code, r.tier].some((v) => v.toLowerCase().includes(s.replace(/\s/g, "")) || v.toLowerCase().includes(s))),
    );
  }, [q, rows, status, tier]);

  const rowAction = (id: string, fn: () => Promise<boolean>) => {
    setBusyRow(id);
    void fn().then((ok) => { if (ok) router.refresh(); }).finally(() => setBusyRow(null));
  };

  return (
    <div className="space-y-4">
      <form
        className="flex gap-2 rounded-2xl border bg-card p-3"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const ok = await runAction(() => manualCheckinAction(eventId, code), { success: (r) => r.message });
            if (ok) { setCode(""); router.refresh(); }
          });
        }}
      >
        <label htmlFor="manual-code" className="sr-only">Ticket code</label>
        <Input id="manual-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Check in by code: BBC-XXXX-XXXX" className="font-mono" autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="go" />
        <Button type="submit" disabled={pending || !code}>{pending && <Loader2 className="animate-spin" />} Check in</Button>
      </form>

      <div className="space-y-2">
        <label htmlFor="attendee-search" className="sr-only">Search attendees</label>
        <Input id="attendee-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={isAdmin ? "Search name, email, code or tier" : "Search name, code or tier"} />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {(Object.keys(STATUS_LABEL) as StatusFilter[]).map((k) => (
            <button key={k} type="button" aria-pressed={status === k} onClick={() => setStatus(k)} className={cn("rounded-full border px-3 py-1", status === k ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>
              {STATUS_LABEL[k]} <span className="tabular-nums opacity-70">{counts[k]}</span>
            </button>
          ))}
          {tiers.length > 1 && (
            <select aria-label="Filter by tier" value={tier} onChange={(e) => setTier(e.target.value)} className="h-9 rounded-full border bg-background px-3 text-base md:text-sm">
              <option value="all">All tiers</option>
              {tiers.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState>{rows.length === 0 ? "No tickets issued yet." : "No attendees match those filters."}</EmptyState>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {list.map((r) => {
            const busy = busyRow === r.id;
            return (
              <li key={r.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.holder}</span>
                    <StatusBadge status={r.status} admin />
                    {r.checkedInAt && <span className="text-xs text-muted-foreground">at {fmtTime(r.checkedInAt)}</span>}
                  </div>
                  <div className="truncate text-sm text-muted-foreground">
                    <span className="font-mono">{r.code}</span> · {r.tier}
                    {r.email && <> · {r.email}</>}
                    {isAdmin && <> · <Link href={`/bookings/${r.bookingId}`} className="underline">booking</Link></>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {r.status === "valid" && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => rowAction(r.id, () => runAction(() => manualCheckinAction(eventId, r.code), { success: (x) => x.message }))}>
                      {busy && <Loader2 className="animate-spin" />} Check in
                    </Button>
                  )}
                  {r.status === "used" && (
                    <ConfirmDialog
                      title={`Undo check-in for ${r.holder}?`}
                      description="Their ticket will scan as valid again. Use this if someone was checked in by mistake."
                      confirmLabel="Undo check-in"
                      onConfirm={async () => { const ok = await runAction(() => undoCheckinAction(eventId, r.id), { success: "Check-in undone" }); if (ok) router.refresh(); }}
                      trigger={(open) => <Button size="sm" variant="ghost" disabled={busy} onClick={open}>Undo</Button>}
                    />
                  )}
                  {isAdmin && r.status !== "void" && (
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => rowAction(r.id, () => runAction(() => resendTicketsAction(r.bookingId), { success: "Tickets re-sent" }))}>Resend</Button>
                  )}
                  {isAdmin && r.status !== "void" && (
                    <ConfirmDialog
                      title={`Void ${r.code}?`}
                      description={`${r.holder}'s ticket will stop scanning. This can't be undone, and the member isn't emailed. To refund a whole booking, cancel it from the Bookings tab instead.`}
                      confirmLabel="Void ticket"
                      destructive
                      onConfirm={async () => { const ok = await runAction(() => voidTicketAction(r.id, eventId), { success: `${r.code} voided` }); if (ok) router.refresh(); }}
                      trigger={(open) => <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={open}>Void</Button>}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
