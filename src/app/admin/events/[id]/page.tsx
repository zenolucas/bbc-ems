import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheck, ExternalLink, Pencil, ScanLine, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/event/status-badge";
import { eventStats, getEventById, tierAvailability } from "@/lib/events";
import { fmtRange, peso } from "@/lib/format";
import { EventStatusControls } from "./status-controls";

export default async function AdminEventPage({ params }: PageProps<"/admin/events/[id]">) {
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) notFound();
  const [avail, stats] = await Promise.all([tierAvailability(id), eventStats(id)]);
  const capacity = event.tiers.reduce((n, t) => n + t.quantity, 0);
  const held = event.tiers.reduce((n, t) => n + avail(t).held, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{event.title}</h1>
            <StatusBadge status={event.status} />
          </div>
          <p className="text-sm text-muted-foreground">{fmtRange(event.startsAt, event.endsAt)} · {event.venueName}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link href={`/events/${event.slug}`} target="_blank"><ExternalLink className="size-4" /> View</Link></Button>
          <Button asChild variant="outline"><Link href={`/admin/events/${id}/edit`}><Pencil className="size-4" /> Edit</Link></Button>
          <Button asChild><Link href={`/admin/scan/${id}`}><ScanLine className="size-4" /> Scan</Link></Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Reserved / capacity" value={`${held} / ${capacity}`} />
        <Stat label="Tickets issued" value={stats.issued} />
        <Stat label="Checked in" value={stats.used} />
        <Stat label="Awaiting review" value={stats.pendingReview} highlight={stats.pendingReview > 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Tiers</CardTitle></CardHeader>
          <CardContent className="divide-y">
            {event.tiers.map((t) => {
              const a = avail(t);
              return (
                <div key={t.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <div className="font-medium">{t.name}</div>
                    <div className="text-muted-foreground">{peso(t.priceCents)} · max {t.perOrderLimit}/order</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{a.held} / {t.quantity}</div>
                    <div className="text-xs text-muted-foreground">{a.remaining} left</div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Manage</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              <Button asChild variant="outline" className="justify-start"><Link href={`/admin/events/${id}/bookings`}><ClipboardCheck className="size-4" /> Review bookings{stats.pendingReview > 0 && <span className="ml-auto rounded-full bg-sun px-2 text-xs font-semibold text-deep-forest">{stats.pendingReview}</span>}</Link></Button>
              <Button asChild variant="outline" className="justify-start"><Link href={`/admin/events/${id}/attendees`}><Users className="size-4" /> Attendees &amp; manual check-in</Link></Button>
            </CardContent>
          </Card>
          <EventStatusControls id={id} status={event.status} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border bg-card p-4 ${highlight ? "border-sun" : ""}`}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
