"use client";
import Image from "next/image";
import { useState, useTransition } from "react";
import { Check, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/event/status-badge";
import { fmtDateTime, peso, relative } from "@/lib/format";
import { approveAction, rejectAction } from "@/app/admin/booking-actions";

export type ReviewRow = {
  id: string; status: string; userName: string; userEmail: string; totalCents: number; paymentRef: string | null;
  paymentProofUrl: string | null; submittedAt: string | null; createdAt: string; expiresAt: string | null; reviewNote: string | null; items: string;
};

export function ReviewList({ eventId, bookings }: { eventId: string; bookings: ReviewRow[] }) {
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState<ReviewRow | null>(null);
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  if (bookings.length === 0) return <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">Nothing to review.</div>;

  return (
    <>
      <div className="space-y-3">
        {bookings.map((b) => (
          <div key={b.id} id={b.id} className="grid gap-4 rounded-2xl border bg-card p-4 sm:grid-cols-[120px_1fr_auto]">
            <button type="button" className="relative aspect-[3/4] overflow-hidden rounded-lg border bg-muted disabled:cursor-default" disabled={!b.paymentProofUrl} onClick={() => b.paymentProofUrl && setPreview(b.paymentProofUrl)}>
              {b.paymentProofUrl ? <Image src={b.paymentProofUrl} alt="Receipt" fill unoptimized className="object-cover" /> : <span className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">No receipt</span>}
            </button>
            <div className="min-w-0 space-y-1 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{b.userName || b.userEmail}</span>
                <StatusBadge status={b.status} />
              </div>
              <div className="text-muted-foreground">{b.userEmail}</div>
              <div>{b.items} · <span className="font-semibold">{peso(b.totalCents)}</span></div>
              <div>Ref: <span className="font-mono">{b.paymentRef ?? "—"}</span></div>
              <div className="text-muted-foreground">
                {b.submittedAt ? `Submitted ${relative(b.submittedAt)}` : `Reserved ${relative(b.createdAt)}`}
                {b.status === "pending_payment" && b.expiresAt && ` · hold expires ${relative(b.expiresAt)}`}
              </div>
              {b.reviewNote && <div className="rounded bg-muted px-2 py-1 text-xs">Note: {b.reviewNote}</div>}
              <div className="text-xs text-muted-foreground">{fmtDateTime(b.createdAt)} · {b.id}</div>
            </div>
            {["under_review", "pending_payment", "rejected"].includes(b.status) && (
              <div className="flex gap-2 sm:flex-col">
                <Button size="sm" disabled={pending} onClick={() => start(async () => { const r = await approveAction(b.id, eventId); if (r?.error) toast.error(r.error); else toast.success("Approved, tickets issued"); })}><Check className="size-4" /> Approve</Button>
                {b.status !== "rejected" && <Button size="sm" variant="outline" disabled={pending} onClick={() => { setNote(""); setRejecting(b); }}><X className="size-4" /> Reject</Button>}
                {b.paymentProofUrl && <Button asChild size="sm" variant="ghost"><a href={b.paymentProofUrl} target="_blank"><ExternalLink className="size-4" /> Open</a></Button>}
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject payment</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">The attendee gets an email with your note and can resubmit.</p>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Amount received was ₱250, tier costs ₱350. Please send the balance and upload the new receipt." rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="destructive" disabled={pending} onClick={() => start(async () => { if (!rejecting) return; const r = await rejectAction(rejecting.id, eventId, note); if (r?.error) toast.error(r.error); else toast.success("Rejected"); setRejecting(null); })}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Receipt</DialogTitle></DialogHeader>
          {preview && <div className="relative h-[70vh] w-full"><Image src={preview} alt="Receipt" fill unoptimized className="object-contain" /></div>}
        </DialogContent>
      </Dialog>
    </>
  );
}
