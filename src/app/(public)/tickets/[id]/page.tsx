import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { CalendarPlus, CheckCircle2, ChevronLeft, Download } from "lucide-react";
import { db } from "@/db/client";
import { tickets } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Notice } from "@/components/ui/notice";
import { StatusBadge } from "@/components/event/status-badge";
import { icsHref } from "@/components/ticket/calendar";
import { ShareTicketButton } from "@/components/ticket/share-ticket";
import { LargeQr } from "@/components/ticket/large-qr";
import { TicketWallet } from "@/components/ticket/ticket-wallet";
import { env } from "@/lib/env";
import { fmtDate, fmtDateTime, fmtTime } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { renderTicket } from "@/lib/tickets/render/server";
import { urlFor } from "@/lib/tickets/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ticket" };

const firstName = (n: string) => n.split(" ")[0] || n;

export default async function TicketPage({ params }: PageProps<"/tickets/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/tickets/${id}`);
  const t = await db.query.tickets.findFirst({
    where: user.role === "admin" ? eq(tickets.id, id) : and(eq(tickets.id, id), eq(tickets.userId, user.id)),
    with: { event: true, tier: true },
  });
  if (!t) notFound();
  // Siblings on the same booking, for "2 of 3", the dots and swiping
  const siblings = await db.query.tickets.findMany({
    where: eq(tickets.bookingId, t.bookingId),
    columns: { id: true, holderName: true, status: true },
    orderBy: [asc(tickets.createdAt), asc(tickets.id)],
  });
  const idx = siblings.findIndex((s) => s.id === t.id);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
  // "Mika's ticket", or "ticket 2" while every ticket still carries the booker's name
  const whose = (s: { holderName: string }, n: number) => (s.holderName === t.holderName ? `ticket ${n}` : `${firstName(s.holderName)}'s ticket`);
  const hint = next
    ? t.status === "used" && next.status === "valid"
      ? `${capital(whose(next, idx + 2))} is still valid →`
      : `Swipe for ${whose(next, idx + 2)} →`
    : prev
      ? `← Swipe back for ${whose(prev, idx)}`
      : null;

  // The wallet stage is always night, so it always shows the night ticket (dark modules on a light window, scannable)
  const ticket = renderTicket(t.event.ticketStyle, {
    url: urlFor(t),
    shortCode: t.shortCode,
    holderName: t.holderName,
    tierName: t.tier.name,
    event: { title: t.event.title, startsAt: t.event.startsAt, endsAt: t.event.endsAt, venueName: t.event.venueName },
    theme: "dark",
  });
  const label = `Ticket ${t.shortCode} for ${t.holderName}, ${t.tier.name}, ${t.event.title}`;
  const cancelled = t.event.status === "cancelled";
  const used = !cancelled && t.status === "used";
  const ev = t.event;

  return (
    // Night stage in both themes: full-bleed on phones, a wallet-sized panel on desktop
    <div data-flush-footer className="dark -mx-4 -mt-8 -mb-8 flex min-h-[calc(100dvh-4rem)] flex-col bg-background text-foreground sm:mx-auto sm:mt-0 sm:mb-0 sm:min-h-0 sm:max-w-md sm:overflow-hidden sm:rounded-[2rem] sm:shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
      <div className="flex h-14 shrink-0 items-center gap-1.5 px-2">
        <Link href={`/bookings/${t.bookingId}`} aria-label="Back to booking" className="grid size-11 place-items-center rounded-full hover:bg-muted">
          <ChevronLeft className="size-[22px]" />
        </Link>
        <h1 className="font-sans text-[15px] font-semibold tracking-normal">Your ticket</h1>
        <div className="mr-2 ml-auto flex items-center gap-2">
          {siblings.length > 1 && <span className="text-xs text-muted-foreground">{idx + 1} of {siblings.length}</span>}
          <StatusBadge status={cancelled ? "cancelled" : t.status} />
        </div>
      </div>

      <div className="space-y-2 px-4 empty:hidden">
        {cancelled && <Notice tone="destructive" title="This event was cancelled">This ticket no longer scans at the door.</Notice>}
        {used && (
          <div role="status" className="flex items-center gap-2.5 rounded-[14px] border border-l-4 border-l-info bg-card px-3.5 py-3 text-[13px] leading-snug">
            <CheckCircle2 className="size-5 shrink-0 text-info-foreground" aria-hidden />
            <p>
              <span className="font-semibold">Scanned{t.checkedInAt ? ` at ${fmtTime(t.checkedInAt)}` : ""}.</span>{" "}
              <span className="text-muted-foreground">Enjoy the night. This QR won&apos;t scan again.</span>
            </p>
          </div>
        )}
        {t.status === "void" && <Notice tone="destructive" title="This ticket was voided">It won&apos;t scan at the door. Message the organisers if this is a mistake.</Notice>}
      </div>

      {/* The stage: a soft lime glow behind the ticket */}
      <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-5 py-8">
        <div aria-hidden className="pointer-events-none absolute top-[46%] left-1/2 size-[420px] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(closest-side,rgba(140,198,62,0.28),rgba(60,197,232,0.08)_60%,transparent)]" />
        <TicketWallet
          key={t.id}
          svg={ticket.svg}
          label={label}
          width={ticket.width}
          height={ticket.height}
          used={used}
          prev={prev ? { href: `/tickets/${prev.id}`, name: firstName(prev.holderName) } : null}
          next={next ? { href: `/tickets/${next.id}`, name: firstName(next.holderName) } : null}
          index={idx}
          total={siblings.length}
          hint={hint}
        />
      </div>

      {/* Landscape styles leave the QR small on phones: give the door a big plain one too */}
      {!used && !cancelled && t.status === "valid" && ticket.width > ticket.height && (
        <LargeQr data={urlFor(t)} code={t.shortCode} className="mx-auto mb-4 w-full max-w-[280px] px-4 sm:hidden" />
      )}

      {!used && (
        <>
          <div className="flex gap-2 px-4 pb-2.5">
            <Button asChild variant="outline" className="h-11 flex-1 rounded-full text-[13px] font-semibold md:h-11">
              <a href={`/api/tickets/${t.id}/png`} download={`${t.shortCode}.png`}><Download /> Save image</a>
            </Button>
            <CopyButton value={t.shortCode} label="ticket code" className="h-11 flex-1 rounded-full text-[13px] font-semibold md:h-11">Copy code</CopyButton>
            <ShareTicketButton ticketId={t.id} code={t.shortCode} title={ev.title} className="size-11 rounded-full md:size-11" />
          </div>
          <p className="px-6 pb-2.5 text-center text-xs leading-relaxed text-muted-foreground">
            Turn brightness up at the door. Each ticket scans once. No signal? Save the image now, or give the crew the code <span className="font-mono">{t.shortCode}</span>.
          </p>
        </>
      )}

      <div className="mx-4 mb-[max(1.375rem,env(safe-area-inset-bottom))] flex items-center gap-3 rounded-2xl border bg-card px-3.5 py-3 text-[13px]">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{fmtDate(ev.startsAt, "EEE, MMM d")} · doors {fmtTime(ev.startsAt)}</p>
          <p className="flex min-w-0 text-muted-foreground">
            <span className="truncate">{ev.venueName}{ev.venueAddress ? `, ${ev.venueAddress}` : ""}</span>
            {ev.mapUrl && (
              <span className="shrink-0">
                &nbsp;·{" "}
                <a href={ev.mapUrl} target="_blank" rel="noreferrer" className="font-semibold text-accent-foreground hover:underline">Map ↗</a>
              </span>
            )}
          </p>
          {used && t.checkedInAt && <p className="sr-only">Checked in {fmtDateTime(t.checkedInAt)}</p>}
        </div>
        {used || cancelled ? (
          <Button asChild variant="secondary" className="h-9 shrink-0 rounded-full bg-surface-2 px-3 text-xs font-semibold md:h-9">
            <Link href={`/bookings/${t.bookingId}`}>Booking</Link>
          </Button>
        ) : (
          <Button asChild variant="secondary" className="h-9 shrink-0 rounded-full bg-surface-2 px-3 text-xs font-semibold md:h-9">
            <a href={icsHref(ev, `${env.appUrl}/events/${ev.slug}`)} download={`${ev.slug}.ics`}><CalendarPlus /> Calendar</a>
          </Button>
        )}
      </div>
    </div>
  );
}

function capital(s: string) {
  return s[0].toUpperCase() + s.slice(1);
}
