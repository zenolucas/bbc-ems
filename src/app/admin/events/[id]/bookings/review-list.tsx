"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
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
  reviewedBy: string | null; reviewedAt: string | null; items: string; itemNotes: string; ticketCount: number;
  timing: string; age: string; stale: boolean; timeline: string; history: string; refCheck: { ok: boolean; text: string } | null;
  reviewed: string | null; booked: string;
};

const REASONS = [
  { label: "Wrong amount", short: "Wrong amount", text: (r: ReviewRow) => `The amount received doesn't match ${peso(r.totalCents)}. Please send the difference and upload the new receipt.` },
  { label: "Unreadable receipt", short: "Unreadable", text: () => "We can't read the receipt. Please upload a clearer screenshot that shows the amount and reference number." },
  { label: "Reference not found", short: "Ref not found", text: () => "We couldn't find this reference number in our GCash/Maya history. Please double-check it and resubmit." },
  { label: "Duplicate", short: "Duplicate", text: () => "This receipt was already used for another booking. Please upload the receipt for this payment." },
];

function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

const actionable = (b: ReviewRow) => ["under_review", "pending_payment", "rejected"].includes(b.status);
const who = (b: ReviewRow) => b.userName || b.userEmail;

/**
 * The review queue. From lg up it's a split view: receipts oldest-first on the
 * left, the selected one large on the right, driven from the keyboard
 * (J/K move, A approve, R reject, Z zoom). On phones each booking is a card
 * with the receipt first. Approve, reject, cancel and resend are the same
 * server actions either way.
 */
export function ReviewList({ eventId, bookings, filter }: { eventId: string; bookings: ReviewRow[]; filter: string }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [approving, setApproving] = useState<ReviewRow | null>(null);
  const [rejecting, setRejecting] = useState<ReviewRow | null>(null);
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<ReviewRow | null>(null);
  const [zoom, setZoom] = useState(false);
  const [paneZoom, setPaneZoom] = useState(false);
  const [rejectPending, startReject] = useTransition();
  const [picked, setPicked] = useState<string | null>(null);
  const queueRef = useRef<HTMLDivElement>(null);

  // A link like …/bookings?show=all#<id> (from ⌘K or the dashboard feed) opens that booking
  const hash = useSyncExternalStore(subscribeHash, () => decodeURIComponent(window.location.hash.slice(1)), () => "");
  const visible = bookings.filter((b) => !(filter === "review" && done.has(b.id)));
  const selected = visible.find((b) => b.id === picked) ?? visible.find((b) => b.id === hash) ?? visible[0] ?? null;
  const index = selected ? visible.indexOf(selected) : -1;

  function select(i: number) {
    const b = visible[Math.max(0, Math.min(visible.length - 1, i))];
    if (!b) return;
    setPicked(b.id);
    setPaneZoom(false);
    queueRef.current?.querySelector(`[data-id="${CSS.escape(b.id)}"]`)?.scrollIntoView({ block: "nearest" });
  }

  function openReject(b: ReviewRow, text = "") {
    setNote(text);
    setRejecting(b);
  }

  // Keys only drive the split view, and never while typing or while a dialog is up
  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keys.current = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || !window.matchMedia("(min-width: 1024px)").matches) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable], [role=dialog], [role=menu]") || approving || rejecting || preview) return;
      const k = e.key.toLowerCase();
      if (k === "j" || e.key === "ArrowDown") { e.preventDefault(); select(index + 1); }
      else if (k === "k" || e.key === "ArrowUp") { e.preventDefault(); select(index - 1); }
      else if (k === "a" && selected && actionable(selected)) { e.preventDefault(); setApproving(selected); }
      else if (k === "r" && selected && actionable(selected) && selected.status !== "rejected") { e.preventDefault(); openReject(selected); }
      else if (k === "z" && selected?.paymentProofUrl) { e.preventDefault(); setPaneZoom((z) => !z); }
    };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keys.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (visible.length === 0) {
    return (
      <EmptyState
        title={filter === "review" ? "Queue is clear" : undefined}
        action={filter === "review" ? <Button asChild variant="outline" className="rounded-full"><Link href={`/admin/events/${eventId}/bookings?show=all`}>See all bookings</Link></Button> : undefined}
      >
        {filter === "review" ? "Nothing waiting for review." : "No bookings here."}
      </EmptyState>
    );
  }

  async function approve(b: ReviewRow) {
    setBusyId(b.id);
    try {
      const r = await approveAction(b.id, eventId);
      if (!r.ok) { toast.error(r.error); return; }
      setDone((d) => new Set(d).add(b.id));
      // Move on to the next receipt so the queue keeps flowing
      if (filter === "review" && selected?.id === b.id) setPicked(visible[index + 1]?.id ?? visible[index - 1]?.id ?? null);
      if (r.emailSent) toast.success(`Approved. Tickets emailed to ${b.userEmail}.`);
      else toast.warning("Approved, but the email didn't send.", { action: { label: "Resend", onClick: () => void runAction(() => resendTicketsAction(b.id), { success: "Tickets re-sent" }) }, duration: 15000 });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      {/* lg and up: split view */}
      <div className="hidden items-stretch gap-4 lg:flex">
        <section aria-label={filter === "review" ? "Receipts waiting" : "Bookings"} className="flex max-h-[calc(100dvh-260px)] min-h-[420px] w-[300px] shrink-0 flex-col overflow-hidden rounded-[18px] border bg-card xl:w-[360px]">
          <div className="flex justify-between px-3.5 py-3 text-xs text-muted-foreground">
            <span>{filter === "review" ? "Oldest first · first come, first served" : filter === "unpaid" ? "Oldest first" : "Newest first"}</span>
            <span className="tabular-nums">{visible.length}</span>
          </div>
          <div ref={queueRef} role="listbox" aria-label="Bookings" className="flex-1 overflow-y-auto">
            {visible.map((b) => {
              const on = b.id === selected?.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  role="option"
                  aria-selected={on}
                  data-id={b.id}
                  onClick={() => select(visible.indexOf(b))}
                  className={cn("flex w-full items-start gap-2.5 border-t px-3.5 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset", on ? "bg-surface-2" : "hover:bg-surface-2/50")}
                >
                  <ReceiptThumb url={b.paymentProofUrl} />
                  <span className="min-w-0 flex-1">
                    <span className="flex justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{who(b)}</span>
                      <span className="shrink-0 font-display text-sm font-extrabold">{peso(b.totalCents)}</span>
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{b.items} · ref <span className="font-mono">{b.paymentRef ?? "—"}</span></span>
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn("truncate text-xs", b.status === "under_review" && b.stale ? "font-semibold text-warning-foreground" : "text-muted-foreground")}>{b.age}</span>
                      {filter !== "review" && <StatusBadge status={b.status} admin className="py-0.5" />}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {selected && (
          <section aria-label="Selected booking" aria-live="polite" className="flex min-w-0 flex-1 flex-wrap overflow-hidden rounded-[18px] border bg-card">
            <div className="relative min-h-[420px] min-w-0 flex-[1_1_220px] bg-surface-2">
              {selected.paymentProofUrl ? (
                paneZoom ? (
                  <div className="absolute inset-0 cursor-zoom-out overflow-auto" onClick={() => setPaneZoom(false)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selected.paymentProofUrl} alt={`Receipt from ${who(selected)}, zoomed`} className="max-w-none" style={{ width: "220%" }} />
                  </div>
                ) : (
                  <button type="button" className="absolute inset-5 cursor-zoom-in" onClick={() => setPaneZoom(true)} aria-label="Zoom receipt">
                    <Image src={selected.paymentProofUrl} alt={`Receipt from ${who(selected)}`} fill unoptimized className="object-contain drop-shadow-sm" />
                  </button>
                )
              ) : (
                <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted-foreground">No receipt uploaded{selected.paymentRef ? ", reference only" : ""}.</div>
              )}
              {selected.paymentProofUrl && (
                <div className="absolute top-3 right-3 flex gap-1.5">
                  <Button type="button" variant="outline" size="icon" className="size-9 rounded-full bg-card" aria-label={paneZoom ? "Fit receipt" : "Zoom receipt"} aria-pressed={paneZoom} onClick={() => setPaneZoom((z) => !z)}>
                    {paneZoom ? <ZoomOut /> : <ZoomIn />}
                  </Button>
                  <Button asChild variant="outline" size="icon" className="size-9 rounded-full bg-card">
                    <a href={selected.paymentProofUrl} target="_blank" rel="noreferrer" aria-label="Open receipt in a new tab"><ExternalLink /></a>
                  </Button>
                </div>
              )}
            </div>
            <Details b={selected} eventId={eventId} busy={busyId === selected.id} onApprove={() => setApproving(selected)} onReject={(text) => openReject(selected, text)} onDone={() => router.refresh()} />
          </section>
        )}
      </div>

      {/* phones and tablets: receipt-first cards */}
      <ul className="space-y-3 lg:hidden">
        {visible.map((b) => {
          const busy = busyId === b.id;
          return (
            <li key={b.id} id={b.id} className="scroll-mt-20 overflow-hidden rounded-[18px] border bg-card">
              <button
                type="button"
                className="relative block h-56 w-full bg-surface-2 disabled:cursor-default sm:h-64"
                disabled={!b.paymentProofUrl}
                aria-label={b.paymentProofUrl ? `View receipt from ${who(b)}` : "No receipt uploaded"}
                onClick={() => { setZoom(false); setPreview(b); }}
              >
                {b.paymentProofUrl ? <Image src={b.paymentProofUrl} alt="" fill unoptimized className="object-contain p-3" /> : <span className="absolute inset-0 grid place-items-center p-2 text-center text-xs text-muted-foreground">No receipt yet</span>}
                {b.paymentProofUrl && <span className="absolute right-3 bottom-3 grid size-9 place-items-center rounded-full border bg-card text-foreground" aria-hidden><ZoomIn className="size-4" /></span>}
              </button>
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-display text-lg font-extrabold">{who(b)}</div>
                    <div className="truncate text-[13px] text-muted-foreground">{b.userEmail}</div>
                  </div>
                  <StatusBadge status={b.status} admin className="shrink-0" />
                </div>
                <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3.5 gap-y-1.5 text-[13px]">
                  <dt className="text-muted-foreground">Expected</dt><dd className="font-display text-lg font-extrabold">{peso(b.totalCents)}</dd>
                  <dt className="text-muted-foreground">Reference</dt><dd className="font-mono break-all">{b.paymentRef ?? "—"}</dd>
                  <dt className="text-muted-foreground">Items</dt><dd>{b.items}</dd>
                  <dt className="text-muted-foreground">Timing</dt><dd className="text-muted-foreground">{b.timing}</dd>
                </dl>
                {b.reviewNote && <div className="rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs">Note: {b.reviewNote}</div>}
                {b.reviewed && <div className="text-xs text-muted-foreground">{b.reviewed}</div>}
                <div className="text-xs text-muted-foreground">Booked {b.booked} · <Link href={`/bookings/${b.id}`} className="font-mono underline">{b.id}</Link></div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {actionable(b) && (
                    <Button className="h-11 flex-1 rounded-full" disabled={busy} onClick={() => setApproving(b)}>{busy ? <Loader2 className="animate-spin" /> : <Check />} Approve</Button>
                  )}
                  {actionable(b) && b.status !== "rejected" && (
                    <Button variant="outline" className="h-11 flex-1 rounded-full" disabled={busy} onClick={() => openReject(b)}><X /> Reject</Button>
                  )}
                  {b.status === "approved" && (
                    <Button variant="outline" className="h-11 rounded-full" onClick={() => void runAction(() => resendTicketsAction(b.id), { success: `Tickets re-sent to ${b.userEmail}` })}><Mail /> Resend tickets</Button>
                  )}
                  {(actionable(b) || b.status === "approved") && <CancelBooking b={b} eventId={eventId} onDone={() => router.refresh()} className="h-11" />}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <Dialog open={!!approving} onOpenChange={(o) => !o && setApproving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve {approving && who(approving)}?</DialogTitle>
            <DialogDescription>{approving && `${approving.items} · ${peso(approving.totalCents)}${approving.paymentRef ? ` · ref ${approving.paymentRef}` : ""}. Tickets are issued and emailed right away.`}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproving(null)}>Not yet</Button>
            <Button autoFocus onClick={() => { const b = approving; setApproving(null); if (b) void approve(b); }}>
              <Check /> Approve and send tickets
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && !rejectPending && setRejecting(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reject payment from {rejecting && who(rejecting)}</DialogTitle>
            <DialogDescription>They get an email with your note, and their seats stay held so they can resubmit.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {rejecting && REASONS.map((r) => (
              <Button key={r.label} type="button" size="sm" variant="outline" className="rounded-full" onClick={() => setNote(r.text(rejecting))}>{r.label}</Button>
            ))}
          </div>
          <label htmlFor="reject-note" className="sr-only">Note to the member</label>
          <Textarea id="reject-note" autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should they fix?" rows={4} />
          <DialogFooter>
            <Button variant="outline" disabled={rejectPending} onClick={() => setRejecting(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={rejectPending || !note.trim()}
              onClick={() => startReject(async () => {
                if (!rejecting) return;
                const ok = await runAction(() => rejectAction(rejecting.id, eventId, note), { success: "Rejected. They've been emailed your note." });
                if (ok) {
                  setDone((d) => new Set(d).add(rejecting.id));
                  if (filter === "review" && selected?.id === rejecting.id) setPicked(visible[index + 1]?.id ?? visible[index - 1]?.id ?? null);
                  setRejecting(null);
                  router.refresh();
                }
              })}
            >
              {rejectPending && <Loader2 className="animate-spin" />} Reject and email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-h-[95vh] sm:max-w-4xl">
          <DialogHeader><DialogTitle>Receipt · {preview && who(preview)}</DialogTitle></DialogHeader>
          {preview?.paymentProofUrl && (
            <div className="grid gap-4 md:grid-cols-[1fr_220px]">
              <div className={cn("relative h-[60vh] overflow-auto rounded-lg bg-muted md:h-[75vh]", zoom && "cursor-zoom-out")} onClick={() => setZoom((z) => !z)}>
                {zoom ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview.paymentProofUrl} alt="Receipt, zoomed" className="max-w-none" style={{ width: "200%" }} />
                ) : (
                  <Image src={preview.paymentProofUrl} alt="Receipt" fill unoptimized className="cursor-zoom-in object-contain" />
                )}
              </div>
              <dl className="space-y-3 text-sm">
                <div><dt className="text-muted-foreground">Expected</dt><dd className="font-display text-xl font-extrabold">{peso(preview.totalCents)}</dd></div>
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

/** The selected booking's facts, with the checks an organiser makes against the receipt. */
function Details({ b, eventId, busy, onApprove, onReject, onDone }: { b: ReviewRow; eventId: string; busy: boolean; onApprove: () => void; onReject: (text?: string) => void; onDone: () => void }) {
  const can = actionable(b);
  return (
    <div className="flex min-w-0 flex-[1.1_1_300px] flex-col gap-3.5 px-5 py-[18px]">
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <div className="truncate font-display text-xl font-extrabold">{who(b)}</div>
          <div className="truncate text-[13px] text-muted-foreground">{b.userEmail} · {b.history}</div>
        </div>
        <StatusBadge status={b.status} admin className="shrink-0" />
      </div>
      <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3.5 gap-y-2 text-[13px]">
        <dt className="text-muted-foreground">Expected</dt>
        <dd><span className="font-display text-[22px] font-extrabold">{peso(b.totalCents)}</span> <span className="block text-xs font-semibold text-muted-foreground">check the receipt shows this</span></dd>
        <dt className="text-muted-foreground">Reference</dt>
        <dd>
          <span className="font-mono text-sm break-all">{b.paymentRef ?? "—"}</span>
          {b.refCheck && <span className={cn("block text-xs font-semibold", b.refCheck.ok ? "text-success-foreground" : "text-destructive")}>{b.refCheck.text}</span>}
        </dd>
        <dt className="text-muted-foreground">Note</dt>
        <dd><span className="font-mono">{b.id}</span> <span className="block text-xs font-semibold text-muted-foreground">should be in the GCash note</span></dd>
        <dt className="text-muted-foreground">Items</dt>
        <dd>{b.items}{b.itemNotes ? ` · ${b.itemNotes.toLowerCase()}` : ""}</dd>
        <dt className="text-muted-foreground">Timeline</dt>
        <dd className="text-muted-foreground">{b.timeline}</dd>
        {b.reviewNote && <><dt className="text-muted-foreground">Last note</dt><dd>{b.reviewNote}</dd></>}
        {b.reviewed && <><dt className="text-muted-foreground">Reviewed</dt><dd className="text-muted-foreground">{b.reviewed.replace(/^Reviewed by /, "by ")}</dd></>}
      </dl>
      <Link href={`/bookings/${b.id}`} className="w-fit text-xs font-semibold text-accent-foreground hover:underline">Open the member&apos;s booking page</Link>
      <div className="mt-auto flex flex-col gap-2">
        {can && (
          <Button className="h-[46px] rounded-full text-sm" disabled={busy} onClick={onApprove}>
            {busy ? <Loader2 className="animate-spin" /> : <Check />} Approve and send tickets <KeyHint inverse>A</KeyHint>
          </Button>
        )}
        <div className="flex flex-wrap gap-2">
          {can && b.status !== "rejected" && (
            <Button variant="outline" className="h-10 flex-1 rounded-full text-[13px]" disabled={busy} onClick={() => onReject()}>Reject with a note <KeyHint>R</KeyHint></Button>
          )}
          {b.status === "approved" && (
            <Button variant="outline" className="h-10 flex-1 rounded-full text-[13px]" onClick={() => void runAction(() => resendTicketsAction(b.id), { success: `Tickets re-sent to ${b.userEmail}` })}><Mail /> Resend tickets</Button>
          )}
          {(can || b.status === "approved") && <CancelBooking b={b} eventId={eventId} onDone={onDone} className="h-10" />}
        </div>
        {can && b.status !== "rejected" && (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>Quick reasons:</span>
            {REASONS.map((r) => (
              <button key={r.label} type="button" onClick={() => onReject(r.text(b))} className="rounded-full border bg-card px-2 py-[3px] hover:border-foreground/30 hover:text-foreground">{r.short}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KeyHint({ children, inverse }: { children: React.ReactNode; inverse?: boolean }) {
  return <kbd aria-hidden className={cn("ml-1 rounded-[5px] border px-[5px] py-px font-mono text-[10px]", inverse ? "border-transparent bg-white/20 text-primary-foreground dark:bg-black/15" : "bg-card text-muted-foreground")}>{children}</kbd>;
}

/** Tiny stand-in for the receipt so the queue scans by shape before you read it. */
function ReceiptThumb({ url }: { url: string | null }) {
  if (!url) return <span className="grid h-[58px] w-11 shrink-0 place-items-center rounded-lg border border-dashed bg-surface-2 text-center text-[9px] text-muted-foreground">no image</span>;
  return <span className="relative h-[58px] w-11 shrink-0 overflow-hidden rounded-lg border bg-surface-2"><Image src={url} alt="" fill unoptimized sizes="44px" className="object-cover object-top" /></span>;
}

function CancelBooking({ b, eventId, onDone, className }: { b: ReviewRow; eventId: string; onDone: () => void; className?: string }) {
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
      trigger={(open) => <Button variant="ghost" className={cn("rounded-full px-3.5 text-[13px] text-muted-foreground hover:text-destructive", className)} onClick={open}>Cancel booking</Button>}
    >
      <label htmlFor={`cancel-${b.id}`} className="text-sm font-medium">Reason (sent to the member)</label>
      <Textarea id={`cancel-${b.id}`} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" />
    </ConfirmDialog>
  );
}
