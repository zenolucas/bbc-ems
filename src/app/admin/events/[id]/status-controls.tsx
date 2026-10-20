"use client";
import { CheckCircle2, Circle, CircleAlert, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Meter } from "@/components/admin/panel";
import { cancelEvent, deleteEvent, duplicateEvent, setEventStatus } from "@/app/admin/actions";
import type { PublishCheck } from "@/lib/events";
import { runAction } from "@/lib/run-action";

type Counts = { live: number; approved: number; tickets: number; paidOrSubmitted: number };

const pill = "h-9 rounded-full px-3.5 text-[13px]";

/** Publish/unpublish up top; duplicate, cancel and delete below the divider, as the danger zone. */
export function EventStatusControls({ id, status, isPast, checklist, counts, heldSeats }: { id: string; status: string; isPast: boolean; checklist: PublishCheck[]; counts: Counts; heldSeats: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const blockers = checklist.filter((c) => c.required && !c.ok);
  const green = checklist.filter((c) => c.ok).length;
  const set = (s: "draft" | "published" | "ended", success: string) =>
    runAction(() => setEventStatus(id, s), { success }).then((ok) => ok && router.refresh());
  const canDelete = counts.paidOrSubmitted === 0;

  return (
    <section aria-labelledby="status-h" className="flex flex-col gap-3 rounded-[18px] border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="status-h" className="font-display text-lg font-extrabold">Status</h2>
        {status === "draft" && <span className="text-xs text-muted-foreground tabular-nums">{green} of {checklist.length}</span>}
      </div>

      {status === "draft" && (
        <div className="space-y-3">
          <p className="text-[13px] leading-relaxed text-muted-foreground">Draft events are hidden. Check these before publishing:</p>
          <Meter value={(green / Math.max(1, checklist.length)) * 100} label="Publish checklist" />
          <ul className="space-y-1.5 text-[13px]">
            {checklist.map((c) => (
              <li key={c.label} className="flex items-center gap-2">
                {c.ok ? <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden /> : c.required ? <CircleAlert className="size-4 shrink-0 text-destructive" aria-hidden /> : <Circle className="size-4 shrink-0 text-warning-foreground" aria-hidden />}
                <span className={c.ok ? "" : c.required ? "text-destructive" : "text-muted-foreground"}>
                  {c.label}
                  {!c.required && !c.ok ? <span className="text-[11px]"> (recommended)</span> : ""}
                  <span className="sr-only">{c.ok ? ", done" : c.required ? ", required" : ", not done"}</span>
                </span>
              </li>
            ))}
          </ul>
          <Button className="h-10 w-full rounded-full" disabled={pending || blockers.length > 0} onClick={() => start(async () => { await set("published", "Published. It's live on the events page."); })}>
            Publish event
          </Button>
          {blockers.length > 0 && <p className="text-center text-xs text-muted-foreground">Fix the red items in Edit to enable publishing.</p>}
        </div>
      )}

      {status === "published" && (
        <>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {isPast ? "This event is over but still listed as published. Mark it ended to move it under Past events." : `Live on the events page. ${heldSeats ? `${heldSeats} ${heldSeats === 1 ? "seat is" : "seats are"} held. ` : ""}Unpublishing hides the page; existing tickets keep working.`}
          </p>
          <div className="flex flex-wrap gap-2">
            <ConfirmDialog
              title="Unpublish this event?"
              description={counts.live > 0 ? `It disappears from the events page. ${counts.live} existing booking${counts.live === 1 ? "" : "s"} and their tickets keep working.` : "It disappears from the events page until you publish it again."}
              confirmLabel="Unpublish"
              onConfirm={() => set("draft", "Unpublished").then(() => undefined)}
              trigger={(open) => <Button variant="outline" className={pill} onClick={open}>Unpublish</Button>}
            />
            <Button variant="outline" className={pill} disabled={pending || !isPast} title={isPast ? undefined : "Available once the event is over"} onClick={() => start(async () => { await set("ended", "Marked ended"); })}>Mark ended</Button>
          </div>
        </>
      )}

      {status === "ended" && <p className="text-[13px] text-muted-foreground">This event is over. Its page stays up under Past events.</p>}
      {status === "cancelled" && <p className="text-[13px] text-muted-foreground">Cancelled. Tickets were voided and attendees were emailed.</p>}

      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        <Button variant="outline" className={pill} disabled={pending} onClick={() => start(async () => { await runAction(() => duplicateEvent(id)); })}><Copy /> Duplicate</Button>
        {status !== "cancelled" && status !== "ended" && (
          <ConfirmDialog
            title="Cancel this event?"
            description={
              counts.live > 0
                ? `${counts.tickets} ticket${counts.tickets === 1 ? "" : "s"} will be voided and ${counts.live} booking${counts.live === 1 ? "" : "s"} emailed. This can't be undone.`
                : "Nobody has booked yet. The event page will show it as cancelled. This can't be undone."
            }
            confirmLabel="Cancel event"
            cancelLabel="Keep event"
            destructive
            onConfirm={async () => {
              const ok = await runAction(() => cancelEvent(id, message), { success: (r) => (r.notified ? `Event cancelled. Emailing ${r.notified} booking${r.notified === 1 ? "" : "s"}.` : "Event cancelled") });
              if (ok) router.refresh();
              return ok ? undefined : false;
            }}
            trigger={(open) => <Button variant="destructive" className={pill} onClick={open}>Cancel event</Button>}
          >
            {counts.live > 0 && (
              <div className="space-y-1.5">
                <label htmlFor="cancel-message" className="text-sm font-medium">Message to attendees (optional)</label>
                <Textarea id="cancel-message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. The venue flooded. Refunds go out by Friday to the GCash number you paid from." />
                {counts.paidOrSubmitted > 0 && <p className="text-xs text-muted-foreground">{counts.paidOrSubmitted} booking{counts.paidOrSubmitted === 1 ? " has" : "s have"} paid. Refunds aren&apos;t automatic; send them from GCash.</p>}
              </div>
            )}
          </ConfirmDialog>
        )}
        {canDelete ? (
          <ConfirmDialog
            title="Delete this event permanently?"
            description="The event, its tiers and any unpaid bookings are removed for good."
            confirmLabel="Delete forever"
            destructive
            onConfirm={async () => { await runAction(() => deleteEvent(id), { success: "Event deleted" }); }}
            trigger={(open) => <Button variant="ghost" className={`${pill} text-destructive`} onClick={open}>Delete</Button>}
          />
        ) : (
          <span className="text-xs text-muted-foreground">Delete is off while people have paid. Cancel instead so they&apos;re notified.</span>
        )}
      </div>
    </section>
  );
}
