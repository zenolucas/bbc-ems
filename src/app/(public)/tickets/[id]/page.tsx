import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft, Download } from "lucide-react";
import { db } from "@/db/client";
import { tickets } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/event/status-badge";
import { TicketSvg } from "@/components/ticket/ticket-svg";
import { fmtDateTime } from "@/lib/format";
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
  const input = {
    url: urlFor(t),
    shortCode: t.shortCode,
    holderName: t.holderName,
    tierName: t.tier.name,
    event: { title: t.event.title, startsAt: t.event.startsAt, endsAt: t.event.endsAt, venueName: t.event.venueName },
  };
  const light = renderTicket(t.event.ticketStyle, { ...input, theme: "light" });
  const dark = renderTicket(t.event.ticketStyle, { ...input, theme: "dark" });

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/me" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> My tickets</Link>
        <StatusBadge status={t.status} />
      </div>
      {t.status === "used" && <div className="rounded-lg border bg-muted px-4 py-2 text-sm">Checked in {t.checkedInAt ? fmtDateTime(t.checkedInAt) : ""}.</div>}
      {t.status === "void" && <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">This ticket has been voided.</div>}
      <div className="dark:hidden"><TicketSvg svg={light.svg} /></div>
      <div className="hidden dark:block"><TicketSvg svg={dark.svg} /></div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button asChild variant="outline"><a href={`/api/tickets/${t.id}/png`} download={`${t.shortCode}.png`}><Download className="size-4" /> Save PNG</a></Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">Turn your brightness up at the door. Each ticket scans once.</p>
    </div>
  );
}
