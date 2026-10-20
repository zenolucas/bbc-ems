"use client";
import { CheckCircle2, Circle, CircleAlert, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Textarea } from "@/components/ui/textarea";
import { cancelEvent, deleteEvent, duplicateEvent, setEventStatus } from "@/app/admin/actions";
import type { PublishCheck } from "@/lib/events";
import { runAction } from "@/lib/run-action";

type Counts = { live: number; approved: number; tickets: number; paidOrSubmitted: number };

export function EventStatusControls({ id, status, isPast, checklist, counts }: { id: string; status: string; isPast: boolean; checklist: PublishCheck[]; counts: Counts }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const blockers = checklist.filter((c) => c.required && !c.ok);
  const set = (s: "draft" | "published" | "ended", success: string) =>
    runAction(() => setEventStatus(id, s), { success }).then((ok) => ok && router.refresh());

  return (
    <Card>
      <CardHeader><CardTitle>Status</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {status === "draft" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Draft events are hidden. Check these before publishing:</p>
            <ul className="space-y-1.5 text-sm">
              {checklist.map((c) => (
                <li key={c.label} className="flex items-center gap-2">
                  {c.ok ? <CheckCircle2 className="size-4 text-grass" aria-hidden /> : c.required ? <CircleAlert className="size-4 text-destructive" aria-hidden /> : <Circle className="size-4 text-muted-foreground" aria-hidden />}
                  <span className={c.ok ? "" : c.required ? "text-destructive" : "text-muted-foreground"}>{c.label}{!c.required && !c.ok ? " (recommended)" : ""}</span>
                </li>
              ))}
            </ul>
            <Button className="w-full" disabled={pending || blockers.length > 0} onClick={() => start(async () => { await set("published", "Published. It's live on the events page."); })}>
              Publish event
            </Button>
            {blockers.length > 0 && <p className="text-xs text-muted-foreground">Fix the red items in Edit to enable publishing.</p>}
          </div>
        )}

        {status === "published" && (
          <div className="flex flex-wrap gap-2">
            <ConfirmDialog
              title="Unpublish this event?"
              description={counts.live > 0 ? `It disappears from the events page. ${counts.live} existing booking${counts.live === 1 ? "" : "s"} and their tickets keep working.` : "It disappears from the events page until you publish it again."}
              confirmLabel="Unpublish"
              onConfirm={() => set("draft", "Unpublished").then(() => undefined)}
              trigger={(open) => <Button size="sm" variant="outline" onClick={open}>Unpublish</Button>}
            />
            {isPast && <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => { await set("ended", "Marked ended"); })}>Mark ended</Button>}
          </div>
        )}

        {status === "ended" && <p className="text-sm text-muted-foreground">This event is over. Its page stays up under Past events.</p>}
        {status === "cancelled" && <p className="text-sm text-muted-foreground">Cancelled. Tickets were voided and attendees were emailed.</p>}

        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => { await runAction(() => duplicateEvent(id)); })}><Copy /> Duplicate</Button>
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
              trigger={(open) => <Button size="sm" variant="outline" className="text-destructive" onClick={open}>Cancel event</Button>}
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
          <ConfirmDialog
            title="Delete this event permanently?"
            description={counts.paidOrSubmitted > 0 ? "People have paid for this event, so it can't be deleted. Cancel it instead so they're notified." : "The event, its tiers and any unpaid bookings are removed for good."}
            confirmLabel="Delete forever"
            destructive
            onConfirm={async () => {
              if (counts.paidOrSubmitted > 0) return;
              await runAction(() => deleteEvent(id), { success: "Event deleted" });
            }}
            trigger={(open) => <Button size="sm" variant="ghost" className="text-destructive" onClick={open}>Delete</Button>}
          />
        </div>
      </CardContent>
    </Card>
  );
}
