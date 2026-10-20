import Link from "next/link";
import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import { ArrowRight, CircleAlert, Plus } from "lucide-react";
import { db } from "@/db/client";
import { bookings, events, ticketTiers } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Stat } from "@/components/admin/stat";
import { StatusBadge } from "@/components/event/status-badge";
import { eventEndsAt, heldByTier } from "@/lib/events";
import { requireAdmin } from "@/lib/session";
import { fmtDateTime, relative } from "@/lib/format";

export const metadata = { title: "Admin" };

export default async function AdminHome() {
  await requireAdmin();
  const now = new Date();
  const [live, queue] = await Promise.all([
    // Published events that haven't ended yet, including ones happening right now
    db.query.events.findMany({
      where: and(eq(events.status, "published"), gte(sql`coalesce(${events.endsAt}, ${events.startsAt} + interval '6 hours')`, now)),
      orderBy: asc(events.startsAt),
      with: { tiers: { orderBy: asc(ticketTiers.sortOrder) } },
    }),
    db
      .select({ eventId: bookings.eventId, title: events.title, n: sql<number>`count(*)::int`, oldest: sql<Date>`min(${bookings.submittedAt})` })
      .from(bookings)
      .innerJoin(events, eq(events.id, bookings.eventId))
      .where(eq(bookings.status, "under_review"))
      .groupBy(bookings.eventId, events.title)
      .orderBy(sql`min(${bookings.submittedAt}) asc`),
  ]);
  const drafts = await db.query.events.findMany({ where: and(eq(events.status, "draft"), gte(events.startsAt, now)), orderBy: asc(events.startsAt), limit: 5 });
  const held = await heldByTier(live.map((e) => e.id));
  const unpaid = live.length
    ? await db
        .select({ n: sql<number>`count(*)::int` })
        .from(bookings)
        .where(and(inArray(bookings.eventId, live.map((e) => e.id)), eq(bookings.status, "pending_payment"), gte(bookings.expiresAt, now)))
    : [{ n: 0 }];

  const totalPending = queue.reduce((n, q) => n + q.n, 0);
  const missingPayment = live.filter((e) => e.tiers.some((t) => t.priceCents > 0) && !e.gcashNumber && !e.gcashQrUrl);
  const soon = live.filter((e) => e.startsAt.getTime() - now.getTime() < 48 * 3600e3);
  const attention = queue.length + missingPayment.length + soon.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <Button asChild><Link href="/admin/events/new"><Plus className="size-4" /> New event</Link></Button>
      </div>

      <Card className={attention ? "border-sun" : ""}>
        <CardHeader><CardTitle>Needs attention</CardTitle></CardHeader>
        <CardContent className="divide-y">
          {attention === 0 && <p className="py-4 text-sm text-muted-foreground">All clear. No payments to review and nothing starting in the next two days.</p>}
          {queue.map((q) => (
            <Link key={q.eventId} href={`/admin/events/${q.eventId}/bookings`} className="flex items-center justify-between gap-3 py-3 text-sm hover:bg-muted/40">
              <div className="min-w-0">
                <div className="font-medium">{q.n} payment{q.n === 1 ? "" : "s"} to review · {q.title}</div>
                <div className="text-muted-foreground">Oldest submitted {q.oldest ? relative(q.oldest) : "recently"}</div>
              </div>
              <span className="flex shrink-0 items-center gap-1 font-medium text-primary">Review <ArrowRight className="size-4" /></span>
            </Link>
          ))}
          {missingPayment.map((e) => (
            <Link key={`pay-${e.id}`} href={`/admin/events/${e.id}/edit#payment`} className="flex items-center justify-between gap-3 py-3 text-sm hover:bg-muted/40">
              <div className="flex min-w-0 items-center gap-2"><CircleAlert className="size-4 shrink-0 text-destructive" aria-hidden /><span className="truncate"><span className="font-medium">{e.title}</span> has paid tiers but no GCash details</span></div>
              <span className="flex shrink-0 items-center gap-1 font-medium text-primary">Fix <ArrowRight className="size-4" /></span>
            </Link>
          ))}
          {soon.map((e) => (
            <Link key={`soon-${e.id}`} href={`/admin/scan/${e.id}`} className="flex items-center justify-between gap-3 py-3 text-sm hover:bg-muted/40">
              <div className="min-w-0"><span className="font-medium">{e.title}</span> <span className="text-muted-foreground">{e.startsAt < now ? "is happening now" : `starts ${relative(e.startsAt)}`}</span></div>
              <span className="flex shrink-0 items-center gap-1 font-medium text-primary">Open scanner <ArrowRight className="size-4" /></span>
            </Link>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Live events" value={live.length} />
        <Stat label="Awaiting review" value={totalPending} highlight={totalPending > 0} />
        <Stat label="Unpaid holds" value={unpaid[0].n} hint="Expire automatically" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Upcoming events</CardTitle></CardHeader>
          <CardContent className="divide-y">
            {live.length === 0 && <EmptyState action={<Button asChild size="sm"><Link href="/admin/events/new">Create an event</Link></Button>}>Nothing published.</EmptyState>}
            {live.map((e) => {
              const cap = e.tiers.reduce((n, t) => n + t.quantity, 0);
              const sold = e.tiers.reduce((n, t) => n + (held.get(t.id) ?? 0), 0);
              const pct = cap ? Math.round((sold / cap) * 100) : 0;
              const happening = e.startsAt < now && eventEndsAt(e) > now;
              return (
                <Link key={e.id} href={`/admin/events/${e.id}`} className="block space-y-2 py-3 text-sm hover:bg-muted/40">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{e.title}</div>
                      <div className="text-muted-foreground">{happening ? <span className="font-medium text-forest dark:text-lime">Happening now</span> : fmtDateTime(e.startsAt)}</div>
                    </div>
                    <div className="shrink-0 text-right tabular-nums"><div className="font-medium">{sold} / {cap}</div><div className="text-xs text-muted-foreground">reserved</div></div>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, pct)}%` }} /></div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Drafts</CardTitle></CardHeader>
          <CardContent className="divide-y">
            {drafts.length === 0 && <p className="py-4 text-sm text-muted-foreground">No drafts.</p>}
            {drafts.map((e) => (
              <Link key={e.id} href={`/admin/events/${e.id}`} className="flex items-center justify-between gap-3 py-3 text-sm hover:bg-muted/40">
                <div className="min-w-0"><div className="truncate font-medium">{e.title}</div><div className="text-muted-foreground">{fmtDateTime(e.startsAt)}</div></div>
                <StatusBadge status={e.status} admin />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
