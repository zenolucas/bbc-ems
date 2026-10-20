import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Countdown } from "@/components/ui/countdown";
import { Notice } from "@/components/ui/notice";
import { StatusBadge } from "@/components/event/status-badge";
import { effectiveStatus, getBookingForUser } from "@/lib/bookings";
import { fmtDateTime, fmtRange, peso } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { CancelButton } from "./cancel-button";
import { GuestNames } from "./guest-names";
import { PaymentForm } from "./payment-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Booking" };

export default async function BookingPage({ params, searchParams }: PageProps<"/bookings/[id]">) {
  const { id } = await params;
  const { confirmed, reserved } = await searchParams;
  const user = await requireUser(`/bookings/${id}`);
  const b = await getBookingForUser(id, user.id, user.role === "admin");
  if (!b) notFound();
  const ev = b.event;
  const status = effectiveStatus(b);
  const isOwner = b.userId === user.id;
  const eventCancelled = ev.status === "cancelled";
  const hasPaymentDetails = Boolean(ev.gcashName || ev.gcashNumber || ev.gcashQrUrl);
  const awaitingPayment = !eventCancelled && (status === "pending_payment" || status === "rejected");
  const ticketCount = b.items.reduce((n, i) => n + i.quantity, 0);
  const rebookQuery = b.items.map((i) => `${i.tierId}:${i.quantity}`).join(",");
  const liveTickets = b.tickets.filter((t) => t.status !== "void");
  const allSameName = liveTickets.length > 1 && liveTickets.every((t) => t.holderName === liveTickets[0].holderName && t.status === "valid");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {isOwner ? (
        <Link href="/me" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> My tickets</Link>
      ) : (
        <Notice tone="warn" title={`Viewing ${b.user.name || b.user.email}'s booking as admin`} actions={<Button asChild size="sm" variant="outline"><Link href={`/admin/events/${ev.id}/bookings`}>Back to review queue</Link></Button>} />
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/events/${ev.slug}`} className="text-2xl font-semibold tracking-tight hover:underline">{ev.title}</Link>
          <p className="text-sm text-muted-foreground">{fmtRange(ev.startsAt, ev.endsAt)} · {ev.venueName}</p>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            Booking ref <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-foreground">{b.id}</span>
            <CopyButton value={b.id} label="booking reference" />
          </div>
        </div>
        <StatusBadge status={eventCancelled && status === "approved" ? "cancelled" : status} />
      </div>

      {/* ---- what's happening and what to do next ---- */}
      {eventCancelled ? (
        <Notice tone="destructive" title="This event has been cancelled">
          {status === "approved" || status === "under_review" ? "Your tickets no longer scan. If you paid, the organisers will contact you about a refund." : "Nothing more to do here."}
        </Notice>
      ) : status === "approved" ? (
        <Notice tone="success" title={confirmed ? "You're in!" : "Confirmed"}>
          {ticketCount === 1 ? "Your ticket is below" : `Your ${ticketCount} tickets are below`} and in your email. Show the QR at the door; each one scans once.
        </Notice>
      ) : status === "pending_payment" ? (
        <Notice tone="info" title={reserved ? "Tickets reserved. Now pay to keep them." : "Waiting for your payment"}>
          Send {peso(b.totalCents)} using the details below, then upload the receipt. We&apos;ve emailed you this link too.
        </Notice>
      ) : status === "rejected" ? (
        <Notice tone="warn" title="We couldn't confirm your payment">
          {b.reviewNote ? <>Organiser note: <span className="text-foreground">{b.reviewNote}</span></> : "The organiser couldn't match your receipt to a payment."} Your tickets are still on hold; fix it below.
        </Notice>
      ) : status === "under_review" ? (
        <Notice
          tone="info"
          title="Receipt received, waiting for an organiser"
          actions={
            <>
              <Button asChild size="sm" variant="outline"><Link href={`/bookings/${b.id}`}><RefreshCw /> Check again</Link></Button>
              {b.paymentProofUrl && <Button asChild size="sm" variant="ghost"><a href={b.paymentProofUrl} target="_blank" rel="noreferrer"><ExternalLink /> Your receipt</a></Button>}
            </>
          }
        >
          Reference {b.paymentRef}. Organisers check receipts by hand, usually within a day. We&apos;ll email you the tickets as soon as it&apos;s confirmed. Your seats are held until then.
        </Notice>
      ) : status === "expired" ? (
        <Notice tone="destructive" title="This reservation expired" actions={<Button asChild size="sm"><Link href={`/events/${ev.slug}/book?q=${encodeURIComponent(rebookQuery)}`}>Book again</Link></Button>}>
          The hold ran out before a receipt was uploaded, so the tickets were released. You can book again if any remain.
        </Notice>
      ) : status === "cancelled" ? (
        <Notice tone="destructive" title="This booking was cancelled" actions={<Button asChild size="sm" variant="outline"><Link href="/">Browse events</Link></Button>}>
          Its tickets were released{b.reviewNote ? `. Note: ${b.reviewNote}` : "."}
        </Notice>
      ) : null}

      <div className="rounded-2xl border bg-card p-4">
        <ul className="divide-y text-sm">
          {b.items.map((it) => (
            <li key={it.id} className="flex justify-between py-2"><span>{it.quantity} × {it.tier.name}</span><span>{peso(it.unitPriceCents * it.quantity)}</span></li>
          ))}
          <li className="flex justify-between py-2 font-semibold"><span>Total</span><span>{peso(b.totalCents)}</span></li>
        </ul>
      </div>

      {awaitingPayment && (
        <section className="space-y-4 rounded-2xl border bg-card p-5" aria-labelledby="pay-heading">
          <div className="space-y-1">
            <h2 id="pay-heading" className="text-lg font-semibold">{status === "rejected" ? "1. Fix the payment" : "1. Pay via GCash or Maya"}</h2>
            {b.expiresAt && <Countdown to={b.expiresAt.toISOString()} prefix={status === "rejected" ? "Resubmit within" : "Hold expires"} absolute={fmtDateTime(b.expiresAt)} />}
          </div>
          {hasPaymentDetails ? (
            <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
              {ev.gcashQrUrl ? (
                <div className="space-y-2">
                  <div className="relative mx-auto aspect-square w-full max-w-[240px] overflow-hidden rounded-xl border bg-white">
                    <Image src={ev.gcashQrUrl} alt={`GCash QR code for ${ev.gcashName ?? "the organiser"}`} fill unoptimized className="object-contain" />
                  </div>
                  <Button asChild size="sm" variant="outline" className="w-full">
                    <a href={ev.gcashQrUrl} download={`gcash-${ev.slug}.png`}><Download /> Save QR to upload in GCash</a>
                  </Button>
                </div>
              ) : null}
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Amount</dt>
                  <dd className="flex items-center gap-2"><span className="text-2xl font-semibold">{peso(b.totalCents)}</span><CopyButton value={(b.totalCents / 100).toFixed(b.totalCents % 100 ? 2 : 0)} label="amount" /></dd>
                </div>
                {ev.gcashName && (
                  <div><dt className="text-muted-foreground">Account name</dt><dd className="font-medium">{ev.gcashName}</dd></div>
                )}
                {ev.gcashNumber && (
                  <div>
                    <dt className="text-muted-foreground">Number</dt>
                    <dd className="flex items-center gap-2"><span className="font-mono text-base">{ev.gcashNumber}</span><CopyButton value={ev.gcashNumber.replace(/\s/g, "")} label="number" /></dd>
                  </div>
                )}
                <div>
                  <dt className="text-muted-foreground">Message / note</dt>
                  <dd className="flex items-center gap-2"><span className="font-mono">{b.id}</span><CopyButton value={b.id} label="booking reference" /></dd>
                  <dd className="text-xs text-muted-foreground">Paste this in the payment message so we can match it quickly.</dd>
                </div>
                {ev.paymentInstructions && <p className="whitespace-pre-line text-muted-foreground">{ev.paymentInstructions}</p>}
              </dl>
            </div>
          ) : (
            <Notice tone="warn" title="Payment details aren't up yet">
              The organiser hasn&apos;t added GCash/Maya details. Your hold is safe; check back soon or message them on Discord.
            </Notice>
          )}
          <PaymentForm bookingId={b.id} defaultRef={b.paymentRef ?? ""} defaultProof={status === "rejected" ? null : b.paymentProofUrl} resubmit={status === "rejected"} />
        </section>
      )}

      {b.status === "approved" && b.tickets.length > 0 && (
        <section className="space-y-3" aria-labelledby="tickets-heading">
          <div className="flex items-end justify-between gap-2">
            <h2 id="tickets-heading" className="text-lg font-semibold">{b.tickets.length > 1 ? "Who's coming?" : "Your ticket"}</h2>
            {b.tickets.length > 1 && <p className="text-xs text-muted-foreground">Tap a ticket to show its QR</p>}
          </div>
          {allSameName && isOwner && !eventCancelled && (
            <Notice tone="info" title="Put a name on each ticket">
              Every ticket says &ldquo;{liveTickets[0].holderName}&rdquo;. Add your guests&apos; names so the door crew knows who&apos;s who, then send each friend their QR.
            </Notice>
          )}
          <GuestNames tickets={b.tickets.map((t) => ({ id: t.id, shortCode: t.shortCode, holderName: t.holderName, status: t.status, tierName: t.tier.name }))} canEdit={isOwner && !eventCancelled} />
        </section>
      )}

      {isOwner && !eventCancelled && (status === "pending_payment" || status === "under_review" || status === "rejected") && (
        <div className="flex justify-center border-t pt-4">
          <CancelButton bookingId={b.id} paid={status === "under_review"} />
        </div>
      )}
    </div>
  );
}
