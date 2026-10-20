import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { and, eq, inArray, sql } from "drizzle-orm";
import { ClipboardCheck, ScanLine, Users } from "lucide-react";
import { db } from "@/db/client";
import { bookings } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FlashToast } from "@/components/ui/flash-toast";
import { Notice } from "@/components/ui/notice";
import { Stat } from "@/components/admin/stat";
import { eventStats, getEventById, publishChecklist, tierAvailability } from "@/lib/events";
import { peso } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { EventStatusControls } from "./status-controls";

export default async function AdminEventPage({ params }: PageProps<"/admin/events/[id]">) {
  const { id } = await params;
  await requireAdmin();
  const event = await getEventById(id);
  if (!event) notFound();
  const [avail, stats, [counts]] = await Promise.all([
    tierAvailability(id),
    eventStats(id),
    db
      .select({
        live: sql<number>`count(*) filter (where ${bookings.status} in ('approved','under_review','pending_payment','rejected'))::int`,
        approved: sql<number>`count(*) filter (where ${bookings.status} = 'approved')::int`,
        paidOrSubmitted: sql<number>`count(*) filter (where ${bookings.status} in ('approved','under_review') and ${bookings.totalCents} > 0)::int`,
        revenue: sql<number>`coalesce(sum(${bookings.totalCents}) filter (where ${bookings.status} = 'approved'), 0)::int`,
        unpaid: sql<number>`count(*) filter (where ${bookings.status} = 'pending_payment')::int`,
      })
      .from(bookings)
      .where(and(eq(bookings.eventId, id), inArray(bookings.status, ["approved", "under_review", "pending_payment", "rejected"]))),
  ]);
  const capacity = event.tiers.reduce((n, t) => n + t.quantity, 0);
  const held = event.tiers.reduce((n, t) => n + avail(t).held, 0);
  const isPast = (event.endsAt ?? new Date(event.startsAt.getTime() + 6 * 3600e3)) < new Date();
  const checklist = publishChecklist(event, event.tiers);
  const paidTiers = event.tiers.some((t) => t.priceCents > 0);
  const noPayment = paidTiers && !event.gcashNumber && !event.gcashQrUrl;

  return (
    <div className="space-y-6">
      <Suspense><FlashToast messages={{ saved: "Changes saved", created: "Draft created. Check the list below, then publish." }} /></Suspense>

      {stats.pendingReview > 0 && (
        <Notice tone="warn" title={`${stats.pendingReview} payment${stats.pendingReview === 1 ? "" : "s"} waiting for review`} actions={<Button asChild size="sm"><Link href={`/admin/events/${id}/bookings`}>Review now</Link></Button>}>
          Members can&apos;t get their tickets until you approve.
        </Notice>
      )}
      {noPayment && event.status === "published" && (
        <Notice tone="destructive" title="Paid tiers but no payment details" actions={<Button asChild size="sm" variant="outline"><Link href={`/admin/events/${id}/edit#payment`}>Add GCash details</Link></Button>}>
          People can reserve but have nowhere to send money.
        </Notice>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Reserved / capacity" value={`${held} / ${capacity}`} hint={counts.unpaid > 0 ? `${counts.unpaid} unpaid hold${counts.unpaid === 1 ? "" : "s"}` : undefined} />
        <Stat label="Tickets issued" value={stats.issued} hint={paidTiers ? `${peso(counts.revenue)} confirmed` : undefined} />
        <Stat label="Checked in" value={stats.used} hint={stats.issued ? `${Math.round((stats.used / stats.issued) * 100)}% of issued` : undefined} />
        <Stat label="Awaiting review" value={stats.pendingReview} highlight={stats.pendingReview > 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Quick actions</CardTitle></CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <Button asChild variant="outline" className="justify-start"><Link href={`/admin/events/${id}/bookings`}><ClipboardCheck /> Bookings{stats.pendingReview > 0 && <span className="ml-auto rounded-full bg-sun px-2 text-xs font-semibold text-deep-forest">{stats.pendingReview}</span>}</Link></Button>
              <Button asChild variant="outline" className="justify-start"><Link href={`/admin/events/${id}/attendees`}><Users /> Attendees</Link></Button>
              <Button asChild variant="outline" className="justify-start"><Link href={`/admin/scan/${id}`}><ScanLine /> Door scanner</Link></Button>
            </CardContent>
          </Card>
          <EventStatusControls id={id} status={event.status} isPast={isPast} checklist={checklist} counts={{ live: counts.live, approved: counts.approved, tickets: stats.issued, paidOrSubmitted: counts.paidOrSubmitted }} />
        </div>
        <Card>
          <CardHeader><CardTitle>Tiers</CardTitle></CardHeader>
          <CardContent className="divide-y">
            {event.tiers.map((t) => {
              const a = avail(t);
              const pct = t.quantity ? Math.min(100, Math.round((a.held / t.quantity) * 100)) : 0;
              return (
                <div key={t.id} className="space-y-2 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{t.name}</div>
                      <div className="text-muted-foreground">{peso(t.priceCents)} · max {t.perOrderLimit}/order</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium tabular-nums">{a.held} / {t.quantity}</div>
                      <div className="text-xs text-muted-foreground">{a.remaining === 0 ? "Sold out" : `${a.remaining} left`}</div>
                    </div>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${t.name} sold`}>
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
