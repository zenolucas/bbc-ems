import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, ExternalLink, MapPin } from "lucide-react";
import { db } from "@/db/client";
import { tickets } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Notice } from "@/components/ui/notice";
import { StatusBadge } from "@/components/event/status-badge";
import { TicketSvg } from "@/components/ticket/ticket-svg";
import { fmtDateTime, fmtRange } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { renderTicket } from "@/lib/tickets/render/server";
import { urlFor } from "@/lib/tickets/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ticket" };

export default async function TicketPage({ params }: PageProps<"/tickets/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/tickets/${id}`);
  const t = await db.query.tickets.findFirst({
    where: user.role === "admin" ? eq(tickets.id, id) : and(eq(tickets.id, id), eq(tickets.userId, user.id)),
    with: { event: true, tier: true },
  });
  if (!t) notFound();
  // Siblings on the same booking, for "2 of 3" and prev/next
  const siblings = await db.query.tickets.findMany({
    where: eq(tickets.bookingId, t.bookingId),
    columns: { id: true },
    orderBy: [asc(tickets.createdAt), asc(tickets.id)],
  });
  const idx = siblings.findIndex((s) => s.id === t.id);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;

  const input = {
    url: urlFor(t),
    shortCode: t.shortCode,
    holderName: t.holderName,
    tierName: t.tier.name,
    event: { title: t.event.title, startsAt: t.event.startsAt, endsAt: t.event.endsAt, venueName: t.event.venueName },
  };
  const light = renderTicket(t.event.ticketStyle, { ...input, theme: "light" });
  const dark = renderTicket(t.event.ticketStyle, { ...input, theme: "dark" });
  const label = `Ticket ${t.shortCode} for ${t.holderName}, ${t.tier.name}, ${t.event.title}`;
  const cancelled = t.event.status === "cancelled";

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link href={`/bookings/${t.bookingId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Booking</Link>
        <div className="flex items-center gap-2">
          {siblings.length > 1 && <span className="text-sm text-muted-foreground">{idx + 1} of {siblings.length}</span>}
          <StatusBadge status={cancelled ? "cancelled" : t.status} />
        </div>
      </div>

      {cancelled && <Notice tone="destructive" title="This event was cancelled">This ticket no longer scans at the door.</Notice>}
      {!cancelled && t.status === "used" && <Notice tone="info" title="Already checked in">Scanned {t.checkedInAt ? fmtDateTime(t.checkedInAt) : ""}. Enjoy the night!</Notice>}
      {t.status === "void" && <Notice tone="destructive" title="This ticket was voided">It won&apos;t scan at the door. Message the organisers if this is a mistake.</Notice>}

      <div className="dark:hidden"><TicketSvg svg={light.svg} label={label} /></div>
      <div className="hidden dark:block"><TicketSvg svg={dark.svg} label={label} /></div>

      {siblings.length > 1 && (
        <nav aria-label="Other tickets on this booking" className="flex items-center justify-between">
          {prev ? <Button asChild variant="ghost"><Link href={`/tickets/${prev.id}`}><ChevronLeft /> Previous</Link></Button> : <span />}
          {next ? <Button asChild variant="ghost"><Link href={`/tickets/${next.id}`}>Next <ChevronRight /></Link></Button> : <span />}
        </nav>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button asChild variant="outline"><a href={`/api/tickets/${t.id}/png`} download={`${t.shortCode}.png`}><Download className="size-4" /> Save image</a></Button>
        <CopyButton value={t.shortCode} label="ticket code">Copy code</CopyButton>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Turn your brightness up at the door. Each ticket scans once. No signal? Save the image now, or give the door crew the code <span className="font-mono">{t.shortCode}</span>.
      </p>

      <div className="rounded-2xl border bg-card p-4 text-sm">
        <p className="font-medium">{t.event.title}</p>
        <p className="text-muted-foreground">{fmtRange(t.event.startsAt, t.event.endsAt)}</p>
        <p className="mt-2 flex items-start gap-1.5">
          <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <span>
            {t.event.venueName}
            {t.event.venueAddress && <span className="text-muted-foreground"> · {t.event.venueAddress}</span>}
            {t.event.mapUrl && <> · <a href={t.event.mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">Map <ExternalLink className="size-3" /></a></>}
          </span>
        </p>
      </div>
    </div>
  );
}
