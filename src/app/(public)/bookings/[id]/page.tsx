import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, ChevronLeft, Clock, Download, RefreshCw } from "lucide-react";
import { CampIllustration } from "@/components/brand/skyline";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { CountdownRing, CountdownText } from "@/components/ui/countdown";
import { Notice } from "@/components/ui/notice";
import { TrailSteps, type TrailStepStatus } from "@/components/ui/trail-steps";
import { StatusBadge } from "@/components/event/status-badge";
import { icsHref } from "@/components/ticket/calendar";
import { ShareTicketButton } from "@/components/ticket/share-ticket";
import { effectiveStatus, getBookingForUser } from "@/lib/bookings";
import { discordLoginEnabled, env } from "@/lib/env";
import { eventEndsAt, tierAvailability } from "@/lib/events";
import { fmtDate, fmtTime, peso, relative } from "@/lib/format";
import { ExpireHoldButton } from "@/components/demo/expire-hold-button";
import { getDemoState } from "@/lib/demo/flag";
import { discordBotEnabled } from "@/lib/discord/client";
import { getDiscordAccount } from "@/lib/discord/members";
import { LinkDiscordButton } from "@/components/discord/discord-link";
import { DiscordIcon } from "@/components/brand/discord-icon";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { CancelButton } from "./cancel-button";
import { GuestNames } from "./guest-names";
import { PaymentForm } from "./payment-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Booking" };

type S = TrailStepStatus;
/** Where the booking sits on Pick → Pay → Ticket. Dead bookings dim the whole trail. */
const trail: Record<string, [S, S, S]> = {
  pending_payment: ["done", "current", "pending"],
  under_review: ["done", "done", "waiting"],
  rejected: ["done", "error", "pending"],
  approved: ["done", "done", "current"],
};

export default async function BookingPage({ params, searchParams }: PageProps<"/bookings/[id]">) {
  const { id } = await params;
  const { confirmed, reserved } = await searchParams;
  const user = await requireUser(`/bookings/${id}`);
  const [b, demo, discordAccount] = await Promise.all([
    getBookingForUser(id, user.id, user.role === "admin"),
    getDemoState(),
    discordLoginEnabled && discordBotEnabled ? getDiscordAccount(user.id) : null,
  ]);
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
  const steps = !eventCancelled && trail[status];
  const dead = !steps;
  const meta = `${fmtDate(ev.startsAt, "EEE, MMM d")} · ${fmtTime(ev.startsAt)} · ${ev.venueName}`;
  // Guests the booker renamed: each gets a "Send Mika their ticket" share
  const guests = isOwner && !eventCancelled ? b.tickets.filter((t) => t.status === "valid" && t.holderName !== b.tickets[0]?.holderName).slice(0, 3) : [];

  // An expired hold: say what's still there so "Book again" isn't a gamble
  let stillLeft: string | null = null;
  if (status === "expired" && !eventCancelled) {
    const avail = await tierAvailability(ev.id);
    const first = b.items[0];
    if (first) {
      const left = avail(first.tier).remaining;
      stillLeft = left > 0 ? `Still ${left} ${first.tier.name} ticket${left === 1 ? "" : "s"} left` : `${first.tier.name} has sold out since`;
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      {!isOwner && (
        <Notice tone="warn" title={`Viewing ${b.user.name || b.user.email}'s booking as admin`} actions={<Button asChild size="sm" variant="outline"><Link href={`/admin/events/${ev.id}/bookings`}>Back to review queue</Link></Button>} />
      )}

      <div className={cn("flex items-center gap-2", isOwner && "-mt-4")}>
        <Link href={isOwner ? "/me" : `/admin/events/${ev.id}/bookings`} aria-label={isOwner ? "Back to my tickets" : "Back to review queue"} className="-ml-2 grid size-11 place-items-center rounded-full hover:bg-muted">
          <ChevronLeft className="size-[22px]" />
        </Link>
        <span className="text-[15px] font-semibold">Booking</span>
        <StatusBadge status={eventCancelled && status === "approved" ? "cancelled" : status} className="ml-auto" />
      </div>

      <div className={cn("space-y-1.5", dead && "opacity-70")}>
        <h1 className="text-2xl leading-[1.05] font-extrabold tracking-tight">
          <Link href={`/events/${ev.slug}`} className="hover:underline">{ev.title}</Link>
        </h1>
        {status === "pending_payment" ? (
          <>
            <p className="text-[13px] text-muted-foreground">{meta}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              Booking ref <span className="rounded-lg bg-surface-2 px-2 py-0.5 font-mono text-xs text-foreground">{b.id}</span>
              <CopyButton value={b.id} label="booking reference" className="size-7 md:size-7" />
            </div>
          </>
        ) : (
          <p className="text-[13px] text-muted-foreground">{meta} · ref <span className="font-mono">{b.id}</span></p>
        )}
      </div>

      <TrailSteps
        className={cn("px-1 pt-1", dead && "opacity-50")}
        steps={["Pick", "Pay", "Ticket"].map((label, i) => ({ label, status: steps ? steps[i] : "pending" }))}
      />

      {/* ---- what's happening and what to do next ---- */}
      {eventCancelled ? (
        <Notice tone="destructive" title="This event has been cancelled">
          {status === "approved" || status === "under_review" ? "Your tickets no longer scan. If you paid, the organisers will contact you about a refund." : "Nothing more to do here."}
        </Notice>
      ) : status === "approved" ? (
        <Notice tone="success" title={<span className="font-display text-lg font-extrabold">{confirmed ? "You're in!" : "Confirmed"}</span>}>
          {ticketCount === 1 ? "Your ticket is below" : `Your ${ticketCount} tickets are below`} and in your email. Show the QR at the door; each one scans once.
        </Notice>
      ) : status === "pending_payment" ? (
        <div role="status" className="flex items-center gap-3.5 rounded-[20px] border border-l-4 border-l-info bg-card py-3.5 pr-4 pl-3.5">
          {b.expiresAt && <CountdownRing to={b.expiresAt.toISOString()} from={b.createdAt.toISOString()} />}
          <div className="min-w-0 space-y-0.5">
            <p className="text-[15px] font-semibold">{reserved ? "Tickets reserved. Now pay to keep them." : "Waiting for your payment"}</p>
            <p className="text-[13px] leading-snug text-muted-foreground">
              Send <span className="font-bold text-foreground">{peso(b.totalCents)}</span> and upload the receipt{b.expiresAt ? ` before ${fmtDate(b.expiresAt, "EEE, MMM d")} · ${fmtTime(b.expiresAt)}` : ""}. We&apos;ve emailed you this link too.
            </p>
          </div>
        </div>
      ) : status === "rejected" ? (
        <Notice tone="warn" title="We couldn't confirm your payment">
          <p className="leading-relaxed">
            {b.reviewNote ? <>Organiser note: <span className="text-foreground">&ldquo;{b.reviewNote}&rdquo;</span></> : "The organiser couldn't match your receipt to a payment."}
          </p>
          <p className="mt-1.5">Your tickets are still on hold; fix it below.</p>
        </Notice>
      ) : status === "under_review" ? (
        <Notice
          tone="info"
          title="Receipt received, waiting for an organiser"
          actions={<Button asChild size="sm" variant="outline" className="rounded-full"><Link href={`/bookings/${b.id}`}><RefreshCw /> Check again</Link></Button>}
        >
          Organisers check receipts by hand, usually within a day. We&apos;ll email the tickets the moment it&apos;s confirmed. Your seats are held until then.
        </Notice>
      ) : status === "expired" ? (
        <Notice
          tone="destructive"
          title="This reservation expired"
          actions={
            <>
              <Button asChild size="sm" className="h-9 rounded-full px-4"><Link href={`/events/${ev.slug}/book?q=${encodeURIComponent(rebookQuery)}`}>Book again</Link></Button>
              <Button asChild size="sm" variant="outline" className="h-9 rounded-full px-4"><Link href="/">Browse events</Link></Button>
            </>
          }
        >
          The {ev.bookingHoldHours}-hour hold ran out before a receipt was uploaded, so the seats were released. Nothing was charged.
        </Notice>
      ) : status === "cancelled" ? (
        <Notice tone="destructive" title="This booking was cancelled" actions={<Button asChild size="sm" variant="outline" className="rounded-full"><Link href="/">Browse events</Link></Button>}>
          Its tickets were released{b.reviewNote ? `. Note: ${b.reviewNote}` : "."}
        </Notice>
      ) : null}

      <div className={cn("rounded-[20px] border bg-card px-4 py-3 text-sm", dead && "opacity-60")}>
        <ul>
          {b.items.map((it) => (
            <li key={it.id} className="flex justify-between py-1"><span>{it.quantity} × {it.tier.name}</span><span>{peso(it.unitPriceCents * it.quantity)}</span></li>
          ))}
        </ul>
        <div className="mt-1 flex items-baseline justify-between border-t border-dashed pt-2 pb-0.5 font-display font-bold">
          <span className="text-base">Total</span>
          <span className={cn("text-lg", dead && "line-through")}>{peso(b.totalCents)}</span>
        </div>
      </div>

      {awaitingPayment && (
        <section className="space-y-3.5 rounded-[20px] border bg-card p-4" aria-labelledby="pay-heading">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <div className="flex items-center gap-2.5">
              <span className="grid size-7 place-items-center rounded-full bg-primary font-display text-sm font-extrabold text-primary-foreground" aria-hidden>1</span>
              <h2 id="pay-heading" className="text-[19px] font-extrabold">{status === "rejected" ? "Fix the payment" : "Pay via GCash or Maya"}</h2>
            </div>
            {status === "rejected" && b.expiresAt && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-warning-foreground">
                <Clock className="size-3.5" aria-hidden /> <CountdownText to={b.expiresAt.toISOString()} prefix="Resubmit within " done="Hold expired" refreshAtZero />
              </span>
            )}
          </div>
          {hasPaymentDetails ? (
            <div className={cn("grid gap-3.5", ev.gcashQrUrl && "grid-cols-[minmax(0,132px)_minmax(0,1fr)] sm:grid-cols-[180px_minmax(0,1fr)]")}>
              {ev.gcashQrUrl ? (
                <div className="space-y-2">
                  <div className="relative aspect-square w-full overflow-hidden rounded-xl border bg-white">
                    <Image src={ev.gcashQrUrl} alt={`GCash QR code for ${ev.gcashName ?? "the organiser"}`} fill unoptimized className="object-contain p-1.5" />
                  </div>
                  <Button asChild size="sm" variant="outline" className="w-full rounded-[10px] text-xs">
                    <a href={ev.gcashQrUrl} download={`gcash-${ev.slug}.png`}><Download /> Save QR</a>
                  </Button>
                </div>
              ) : null}
              <dl className="min-w-0 space-y-2.5 text-[13px]">
                <div>
                  <dt className="text-xs text-muted-foreground">Amount</dt>
                  <dd className="mt-0.5 flex items-center gap-2"><span className="font-display text-[26px] leading-tight font-extrabold">{peso(b.totalCents)}</span><CopyButton value={(b.totalCents / 100).toFixed(b.totalCents % 100 ? 2 : 0)} label="amount" /></dd>
                </div>
                {ev.gcashName && (
                  <div><dt className="text-xs text-muted-foreground">Account name</dt><dd className="mt-0.5 font-semibold">{ev.gcashName}</dd></div>
                )}
                {ev.gcashNumber && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Number</dt>
                    <dd className="mt-0.5 flex items-center gap-2"><span className="font-mono text-[15px] font-semibold">{ev.gcashNumber}</span><CopyButton value={ev.gcashNumber.replace(/\s/g, "")} label="number" /></dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-muted-foreground">Message / note</dt>
                  <dd className="mt-0.5 flex items-center gap-2"><span className="truncate rounded-lg bg-warning-soft px-2 py-0.5 font-mono font-semibold">{b.id}</span><CopyButton value={b.id} label="booking reference" /></dd>
                  <dd className="mt-1 text-[11px] text-muted-foreground">Paste this in the payment message so we can match it fast.</dd>
                </div>
              </dl>
            </div>
          ) : (
            <Notice tone="warn" title="Payment details aren't up yet">
              The organiser hasn&apos;t added GCash/Maya details. Your hold is safe; check back soon or message them on{" "}
              {env.discordInviteUrl ? <a href={env.discordInviteUrl} target="_blank" rel="noreferrer" className="font-semibold underline">Discord</a> : "Discord"}.
            </Notice>
          )}
          {ev.paymentInstructions && <p className="rounded-[10px] bg-surface-2 px-3 py-2.5 text-xs whitespace-pre-line text-muted-foreground">{ev.paymentInstructions}</p>}
        </section>
      )}

      {awaitingPayment && (
        <PaymentForm bookingId={b.id} defaultRef={b.paymentRef ?? ""} defaultProof={status === "rejected" ? null : b.paymentProofUrl} resubmit={status === "rejected"} demo={demo.enabled && isOwner} />
      )}

      {status === "under_review" && !eventCancelled && (
        <>
          <div className="flex items-center gap-3 rounded-[20px] border bg-card p-3">
            {b.paymentProofUrl && (
              <a href={b.paymentProofUrl} target="_blank" rel="noreferrer" className="relative h-[84px] w-16 shrink-0 overflow-hidden rounded-[10px] border bg-surface-2">
                <Image src={b.paymentProofUrl} alt="Your receipt screenshot" fill unoptimized className="object-cover object-top" />
              </a>
            )}
            <div className="min-w-0 space-y-0.5 text-xs text-muted-foreground">
              <p className="text-sm font-semibold text-foreground">Your receipt</p>
              {b.paymentRef && <p>Ref <span className="font-mono">{b.paymentRef}</span></p>}
              {b.submittedAt && <p>Sent {relative(b.submittedAt)}</p>}
              {b.paymentProofUrl && <a href={b.paymentProofUrl} target="_blank" rel="noreferrer" className="inline-block pt-0.5 font-semibold text-accent-foreground hover:underline">Open image ↗</a>}
            </div>
          </div>
          <p className="rounded-2xl bg-surface-2 px-4 py-3.5 text-[13px] leading-relaxed text-muted-foreground">
            Please don&apos;t head to the door with this page. Tickets aren&apos;t confirmed until an organiser approves the receipt.
          </p>
        </>
      )}

      {stillLeft && (
        <div className="flex flex-col items-center gap-2.5 rounded-[20px] border border-dashed bg-card px-4 py-6 text-center">
          <CampIllustration className="h-[72px] w-40" />
          <p className="font-display text-[17px] font-bold">{stillLeft}</p>
          <p className="text-[13px] text-muted-foreground">Book again and the same order is pre-filled.</p>
        </div>
      )}

      {b.status === "approved" && b.tickets.length > 0 && (
        <section className="space-y-2.5 pt-2" aria-labelledby="tickets-heading">
          <div className="flex items-end justify-between gap-2 px-1">
            <h2 id="tickets-heading" className="text-xl font-extrabold">{b.tickets.length > 1 ? "Who's coming?" : "Your ticket"}</h2>
            <p className="text-xs text-muted-foreground">{b.tickets.length > 1 ? "Tap a ticket for its QR" : "Tap it for the QR"}</p>
          </div>
          {allSameName && isOwner && !eventCancelled && (
            <p className="rounded-[14px] bg-info-soft px-3.5 py-3 text-[13px] leading-relaxed">
              <span className="font-semibold">Put a name on each ticket.</span>{" "}
              <span className="text-muted-foreground">
                {b.tickets.length === 2 ? "Both say" : "Every ticket says"} &ldquo;{liveTickets[0].holderName}&rdquo;. Add your guests&apos; names so the door knows who&apos;s who, then send each friend their QR.
              </span>
            </p>
          )}
          <GuestNames tickets={b.tickets.map((t) => ({ id: t.id, shortCode: t.shortCode, holderName: t.holderName, status: t.status, tierName: t.tier.name }))} canEdit={isOwner && !eventCancelled} />
          {!eventCancelled && (
            <div className="flex flex-wrap gap-2 pt-1.5">
              <Button asChild variant="outline" className="h-11 flex-1 rounded-full text-[13px] font-semibold md:h-11">
                <a href={icsHref(ev, `${env.appUrl}/events/${ev.slug}`)} download={`${ev.slug}.ics`}><CalendarPlus /> Add to calendar</a>
              </Button>
              {guests.map((t) => (
                <ShareTicketButton key={t.id} ticketId={t.id} code={t.shortCode} title={ev.title} className="h-11 flex-1 rounded-full text-[13px] font-semibold md:h-11">
                  Send {t.holderName.split(" ")[0]} their ticket
                </ShareTicketButton>
              ))}
            </div>
          )}
        </section>
      )}

      {isOwner && b.status === "approved" && !eventCancelled && discordLoginEnabled && discordBotEnabled && !discordAccount && eventEndsAt(ev) > new Date() && (
        <div className="flex flex-col gap-3 rounded-[20px] border bg-card p-4 sm:flex-row sm:items-center">
          <DiscordIcon className="size-7 shrink-0 text-[#5865F2]" />
          <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">On Discord?</span> Link it to get the {ev.title} role and meet the others going.
          </p>
          <LinkDiscordButton back={`/bookings/${b.id}`} className="h-10 shrink-0 rounded-full px-4 text-[13px] font-semibold md:h-10" />
        </div>
      )}

      {demo.enabled && awaitingPayment && <ExpireHoldButton bookingId={b.id} />}

      {isOwner && !eventCancelled && (status === "pending_payment" || status === "under_review" || status === "rejected") && (
        <div className="flex justify-center pt-4">
          <CancelButton bookingId={b.id} paid={status === "under_review"} />
        </div>
      )}
    </div>
  );
}
