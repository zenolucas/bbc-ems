import Link from "next/link";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { ArrowRight, Plus } from "lucide-react";
import { db } from "@/db/client";
import { bookings, events, tickets } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/event/status-badge";
import { fmtDateTime, relative } from "@/lib/format";

export const metadata = { title: "Admin" };

export default async function AdminHome() {
  const [upcoming, pending, counts] = await Promise.all([
    db.query.events.findMany({ where: gte(events.startsAt, new Date()), orderBy: asc(events.startsAt), limit: 5 }),
    db.query.bookings.findMany({
      where: eq(bookings.status, "under_review"),
      orderBy: desc(bookings.submittedAt),
      limit: 8,
      with: { event: true, user: true },
    }),
    db
      .select({
        tickets: sql<number>`(select count(*) from ${tickets})::int`,
        checkedIn: sql<number>`(select count(*) from ${tickets} where ${tickets.status} = 'used')::int`,
        pending: sql<number>`(select count(*) from ${bookings} where ${bookings.status} = 'under_review')::int`,
        published: sql<number>`(select count(*) from ${events} where ${events.status} = 'published')::int`,
      })
      .from(sql`(select 1) as one`)
      .where(and()),
  ]);
  const c = counts[0];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <Button asChild><Link href="/admin/events/new"><Plus className="size-4" /> New event</Link></Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Published events" value={c.published} />
        <Stat label="Tickets issued" value={c.tickets} />
        <Stat label="Checked in" value={c.checkedIn} />
        <Stat label="Awaiting review" value={c.pending} highlight={c.pending > 0} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Payments to review</CardTitle></CardHeader>
          <CardContent className="divide-y">
            {pending.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Queue is clear.</p>}
            {pending.map((b) => (
              <Link key={b.id} href={`/admin/events/${b.eventId}/bookings#${b.id}`} className="flex items-center justify-between gap-3 py-3 text-sm hover:bg-muted/40">
                <div className="min-w-0">
                  <div className="truncate font-medium">{b.user.name || b.user.email}</div>
                  <div className="truncate text-muted-foreground">{b.event.title} · ref {b.paymentRef ?? "—"}</div>
                </div>
                <div className="shrink-0 text-xs text-muted-foreground">{b.submittedAt ? relative(b.submittedAt) : ""}</div>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Upcoming</CardTitle></CardHeader>
          <CardContent className="divide-y">
            {upcoming.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nothing scheduled.</p>}
            {upcoming.map((e) => (
              <Link key={e.id} href={`/admin/events/${e.id}`} className="flex items-center justify-between gap-3 py-3 text-sm hover:bg-muted/40">
                <div className="min-w-0">
                  <div className="truncate font-medium">{e.title}</div>
                  <div className="text-muted-foreground">{fmtDateTime(e.startsAt)}</div>
                </div>
                <div className="flex items-center gap-2"><StatusBadge status={e.status} /><ArrowRight className="size-4 text-muted-foreground" /></div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border bg-card p-4 ${highlight ? "border-sun" : ""}`}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
