"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, ExternalLink, Loader2, Mail, X, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/event/status-badge";
import { peso } from "@/lib/format";
import { runAction } from "@/lib/run-action";
import { cn } from "@/lib/utils";
import { adminCancelBookingAction, approveAction, rejectAction, resendTicketsAction } from "@/app/admin/booking-actions";

export type ReviewRow = {
  id: string; status: string; userName: string; userEmail: string; totalCents: number; paymentRef: string | null;
  paymentProofUrl: string | null; submittedAt: string | null; createdAt: string; expiresAt: string | null; reviewNote: string | null;
  reviewedBy: string | null; reviewedAt: string | null; items: string; ticketCount: number;
  timing: string; reviewed: string | null; booked: string;
};

const REASONS = [
  { label: "Wrong amount", text: (r: ReviewRow) => `The amount received doesn't match ${peso(r.totalCents)}. Please send the difference and upload the new receipt.` },
  { label: "Unreadable receipt", text: () => "We can't read the receipt. Please upload a clearer screenshot that shows the amount and reference number." },
  { label: "Reference not found", text: () => "We couldn't find this reference number in our GCash/Maya history. Please double-check it and resubmit." },
  { label: "Duplicate", text: () => "This receipt was already used for another booking. Please upload the receipt for this payment." },
];

export function ReviewList({ eventId, bookings, filter }: { eventId: string; bookings: ReviewRow[]; filter: string }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = useState<ReviewRow | null>(null);
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<ReviewRow | null>(null);
  const [zoom, setZoom] = useState(false);
  const [rejectPending, startReject] = useTransition();

  const visible = bookings.filter((b) => !(filter === "review" && done.has(b.id)));
  if (visible.length === 0) {
    return (
      <EmptyState action={filter === "review" ? <Button asChild variant="outline"><Link href={`/admin/events/${eventId}/bookings?show=all`}>See all bookings</Link></Button> : undefined}>
        {filter === "review" ? "Queue is clear. Nothing waiting for review." : "No bookings here."}
      </EmptyState>
    );
  }

  async function approve(b: ReviewRow) {
    setBusyId(b.id);
    try {
      const r = await approveAction(b.id, eventId);
      if (!r.ok) { toast.error(r.error); return; }
      setDone((d) => new Set(d).add(b.id));
      if (r.emailSent) toast.success(`Approved. Tickets emailed to ${b.userEmail}.`);
      else toast.warning("Approved, but the email didn't send.", { action: { label: "Resend", onClick: () => void runAction(() => resendTicketsAction(b.id), { success: "Tickets re-sent" }) }, duration: 15000 });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <ul className="space-y-3">
        {visible.map((b) => {
          const actionable = ["under_review", "pending_payment", "rejected"].includes(b.status);
          const busy = busyId === b.id;
          return (
            <li key={b.id} id={b.id} className="grid grid-cols-[72px_1fr] gap-x-3 gap-y-4 rounded-2xl border bg-card p-4 sm:grid-cols-[120px_1fr_auto] sm:gap-4">
              <button
                type="button"
                className="relative aspect-[3/4] w-full self-start overflow-hidden rounded-lg border bg-muted disabled:cursor-default"
                disabled={!b.paymentProofUrl}
                aria-label={b.paymentProofUrl ? `View receipt from ${b.userName || b.userEmail}` : "No receipt uploaded"}
                onClick={() => { setZoom(false); setPreview(b); }}
              >
                {b.paymentProofUrl ? <Image src={b.paymentProofUrl} alt="" fill unoptimized className="object-cover" /> : <span className="absolute inset-0 grid place-items-center p-2 text-center text-xs text-muted-foreground">No receipt yet</span>}
              </button>
              <div className="min-w-0 space-y-1 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{b.userName || b.userEmail}</span>
                  <StatusBadge status={b.status} admin />
                </div>
                <div className="truncate text-muted-foreground">{b.userEmail}</div>
                <div>{b.items} · expected <span className="font-semibold">{peso(b.totalCents)}</span></div>
                <div>Ref: <span className="font-mono">{b.paymentRef ?? "—"}</span></div>
                <div className="text-muted-foreground">{b.timing}</div>
                {b.reviewNote && <div className="rounded bg-muted px-2 py-1 text-xs">Note: {b.reviewNote}</div>}
                {b.reviewed && <div className="text-xs text-muted-foreground">{b.reviewed}</div>}
                <div className="text-xs text-muted-foreground">Booked {b.booked} · <Link href={`/bookings/${b.id}`} className="underline">{b.id}</Link></div>
              </div>
              <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-1 sm:w-36 sm:flex-col">
                {actionable && (
                  <ConfirmDialog
                    title={`Approve ${b.userName || b.userEmail}?`}
                    description={`${b.items} · ${peso(b.totalCents)}${b.paymentRef ? ` · ref ${b.paymentRef}` : ""}. Tickets are issued and emailed right away.`}
                    confirmLabel="Approve and send tickets"
                    cancelLabel="Not yet"
                    onConfirm={() => approve(b)}
                    trigger={(open) => (
                      <Button size="sm" disabled={busy} onClick={open}>{busy ? <Loader2 className="animate-spin" /> : <Check />} Approve</Button>
                    )}
                  />
                )}
                {actionable && b.status !== "rejected" && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => { setNote(""); setRejecting(b); }}><X /> Reject</Button>
                )}
                {b.status === "approved" && (
                  <Button size="sm" variant="outline" onClick={() => void runAction(() => resendTicketsAction(b.id), { success: `Tickets re-sent to ${b.userEmail}` })}><Mail /> Resend tickets</Button>
                )}
                {(actionable || b.status === "approved") && (
                  <CancelBooking b={b} eventId={eventId} onDone={() => router.refresh()} />
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && !rejectPending && setRejecting(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reject payment from {rejecting?.userName || rejecting?.userEmail}</DialogTitle>
            <DialogDescription>They get an email with your note, and their seats stay held so they can resubmit.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {rejecting && REASONS.map((r) => (
              <Button key={r.label} type="button" size="sm" variant="outline" onClick={() => setNote(r.text(rejecting))}>{r.label}</Button>
            ))}
          </div>
          <label htmlFor="reject-note" className="sr-only">Note to the member</label>
          <Textarea id="reject-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should they fix?" rows={4} />
          <DialogFooter>
            <Button variant="outline" disabled={rejectPending} onClick={() => setRejecting(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={rejectPending || !note.trim()}
              onClick={() => startReject(async () => {
                if (!rejecting) return;
                const ok = await runAction(() => rejectAction(rejecting.id, eventId, note), { success: "Rejected. They've been emailed your note." });
                if (ok) { setDone((d) => new Set(d).add(rejecting.id)); setRejecting(null); router.refresh(); }
              })}
            >
              {rejectPending && <Loader2 className="animate-spin" />} Reject and email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader><DialogTitle>Receipt · {preview?.userName || preview?.userEmail}</DialogTitle></DialogHeader>
          {preview?.paymentProofUrl && (
            <div className="grid gap-4 md:grid-cols-[1fr_220px]">
              <div className={cn("relative h-[50dvh] overflow-auto rounded-lg bg-muted md:h-[75vh]", zoom && "cursor-zoom-out")} onClick={() => setZoom((z) => !z)}>
                {zoom ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview.paymentProofUrl} alt="Receipt, zoomed" className="max-w-none" style={{ width: "200%" }} />
                ) : (
                  <Image src={preview.paymentProofUrl} alt="Receipt" fill unoptimized className="cursor-zoom-in object-contain" />
                )}
              </div>
              <dl className="space-y-3 text-sm">
                <div><dt className="text-muted-foreground">Expected</dt><dd className="text-xl font-semibold">{peso(preview.totalCents)}</dd></div>
                <div><dt className="text-muted-foreground">Reference they entered</dt><dd className="font-mono text-base">{preview.paymentRef ?? "—"}</dd></div>
                <div><dt className="text-muted-foreground">Booking (should be in the note)</dt><dd className="font-mono">{preview.id}</dd></div>
                <div><dt className="text-muted-foreground">Items</dt><dd>{preview.items}</dd></div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => setZoom((z) => !z)}>{zoom ? <ZoomOut /> : <ZoomIn />} {zoom ? "Fit" : "Zoom"}</Button>
                  <Button asChild size="sm" variant="ghost"><a href={preview.paymentProofUrl} target="_blank" rel="noreferrer"><ExternalLink /> Open</a></Button>
                </div>
              </dl>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function CancelBooking({ b, eventId, onDone }: { b: ReviewRow; eventId: string; onDone: () => void }) {
  const [reason, setReason] = useState("");
  return (
    <ConfirmDialog
      title="Cancel this booking?"
      description={b.ticketCount > 0 ? `${b.ticketCount} ticket${b.ticketCount === 1 ? "" : "s"} will be voided and ${b.userEmail} emailed. Refunds aren't automatic.` : `The hold is released and ${b.userEmail} is emailed.`}
      confirmLabel="Cancel booking"
      cancelLabel="Keep it"
      destructive
      onConfirm={async () => {
        const ok = await runAction(() => adminCancelBookingAction(b.id, eventId, reason), { success: "Booking cancelled" });
        if (ok) onDone();
        return ok ? undefined : false;
      }}
      trigger={(open) => <Button size="sm" variant="ghost" className="text-destructive" onClick={open}>Cancel booking</Button>}
    >
      <label htmlFor={`cancel-${b.id}`} className="text-sm font-medium">Reason (sent to the member)</label>
      <Textarea id={`cancel-${b.id}`} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" />
    </ConfirmDialog>
  );
}
