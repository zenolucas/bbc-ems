import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/event/status-badge";
import { TicketCard } from "@/components/ticket/ticket-card";
import { getBookingForUser } from "@/lib/bookings";
import { fmtDateTime, fmtRange, peso, relative } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { PaymentForm } from "./payment-form";
import { CancelButton } from "./cancel-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Booking" };

export default async function BookingPage({ params, searchParams }: PageProps<"/bookings/[id]">) {
  const { id } = await params;
  const { confirmed } = await searchParams;
  const user = await requireUser(`/bookings/${id}`);
  const b = await getBookingForUser(id, user.id, user.role === "admin");
  if (!b) notFound();
  const expired = b.status === "expired" || (b.status === "pending_payment" && b.expiresAt && b.expiresAt < new Date());
  const ev = b.event;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Booking {b.id}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{ev.title}</h1>
          <p className="text-sm text-muted-foreground">{fmtRange(ev.startsAt, ev.endsAt)} · {ev.venueName}</p>
        </div>
        <StatusBadge status={expired ? "expired" : b.status} />
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <ul className="divide-y text-sm">
          {b.items.map((it) => (
            <li key={it.id} className="flex justify-between py-2"><span>{it.quantity} × {it.tier.name}</span><span>{peso(it.unitPriceCents * it.quantity)}</span></li>
          ))}
          <li className="flex justify-between py-2 font-semibold"><span>Total</span><span>{peso(b.totalCents)}</span></li>
        </ul>
      </div>

      {confirmed && b.status === "approved" && (
        <div className="flex items-start gap-3 rounded-xl border border-grass/40 bg-fog/60 p-4 dark:bg-slate">
          <CheckCircle2 className="mt-0.5 size-5 text-grass" />
          <div><p className="font-medium">You&apos;re in!</p><p className="text-sm text-muted-foreground">Your tickets are below and under My tickets.</p></div>
        </div>
      )}

      {expired && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <XCircle className="mt-0.5 size-5 text-destructive" />
          <div><p className="font-medium">This reservation expired</p><p className="text-sm text-muted-foreground">The hold lapsed before payment was submitted. You can book again if tickets remain.</p>
            <Button asChild size="sm" className="mt-3"><Link href={`/events/${ev.slug}/book`}>Book again</Link></Button></div>
        </div>
      )}

      {!expired && (b.status === "pending_payment" || b.status === "rejected") && (
        <section className="space-y-4 rounded-2xl border bg-card p-5">
          <div>
            <h2 className="text-lg font-semibold">{b.status === "rejected" ? "Resubmit payment" : "Pay via GCash or Maya"}</h2>
            {b.status === "pending_payment" && b.expiresAt && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Clock className="size-4" /> Hold expires {relative(b.expiresAt)} ({fmtDateTime(b.expiresAt)})</p>
            )}
            {b.status === "rejected" && b.reviewNote && <p className="mt-2 rounded-lg bg-muted p-3 text-sm">Organiser note: {b.reviewNote}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            {ev.gcashQrUrl ? (
              <div className="relative aspect-square overflow-hidden rounded-xl border bg-white"><Image src={ev.gcashQrUrl} alt="Payment QR" fill unoptimized className="object-contain" /></div>
            ) : (
              <div className="grid aspect-square place-items-center rounded-xl border border-dashed text-center text-xs text-muted-foreground">No QR provided</div>
            )}
            <div className="space-y-1 text-sm">
              <p className="text-2xl font-semibold">{peso(b.totalCents)}</p>
              {ev.gcashName && <p><span className="text-muted-foreground">Account name:</span> {ev.gcashName}</p>}
              {ev.gcashNumber && <p><span className="text-muted-foreground">Number:</span> <span className="font-mono">{ev.gcashNumber}</span></p>}
              {ev.paymentInstructions && <p className="text-muted-foreground">{ev.paymentInstructions}</p>}
              {!ev.gcashName && !ev.gcashNumber && !ev.gcashQrUrl && <p className="text-muted-foreground">The organiser hasn&apos;t added payment details yet. Check back soon or message them on Discord.</p>}
            </div>
          </div>
          <PaymentForm bookingId={b.id} defaultRef={b.paymentRef ?? ""} />
          <CancelButton bookingId={b.id} />
        </section>
      )}

      {b.status === "under_review" && (
        <div className="flex items-start gap-3 rounded-xl border border-sky/40 bg-accent p-4">
          <Clock className="mt-0.5 size-5 text-sky-deep dark:text-sky" />
          <div>
            <p className="font-medium">Payment submitted, waiting for an organiser</p>
            <p className="text-sm text-muted-foreground">Reference {b.paymentRef}. You&apos;ll get an email once it&apos;s confirmed; tickets appear here automatically.</p>
            {b.paymentProofUrl && <a href={b.paymentProofUrl} target="_blank" className="mt-2 inline-block text-sm underline">View uploaded receipt</a>}
          </div>
        </div>
      )}

      {b.status === "approved" && b.tickets.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Your tickets</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {b.tickets.map((t) => <TicketCard key={t.id} ticket={{ id: t.id, shortCode: t.shortCode, holderName: t.holderName, status: t.status, tierName: t.tier.name }} />)}
          </div>
        </section>
      )}
    </div>
  );
}
