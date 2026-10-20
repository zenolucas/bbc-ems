import Link from "next/link";
import { asc, inArray, sql } from "drizzle-orm";
import { ScanLine } from "lucide-react";
import { db } from "@/db/client";
import { events, tickets } from "@/db/schema";
import { EmptyState } from "@/components/ui/empty-state";
import { fmtDateTime, relative } from "@/lib/format";
import { requireStaff } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Scanner" };

/** Published events that haven't been over for more than a day. */
function scannableEvents() {
  return db
    .select({
      id: events.id,
      title: events.title,
      startsAt: events.startsAt,
      venue: events.venueName,
      total: sql<number>`(select count(*) from ${tickets} where ${tickets.eventId} = ${events.id} and ${tickets.status} <> 'void')::int`,
      used: sql<number>`(select count(*) from ${tickets} where ${tickets.eventId} = ${events.id} and ${tickets.status} = 'used')::int`,
      live: sql<boolean>`${events.startsAt} <= now()`,
    })
    .from(events)
    .where(sql`${inArray(events.status, ["published", "ended"])} and coalesce(${events.endsAt}, ${events.startsAt} + interval '6 hours') > now() - interval '1 day'`)
    .orderBy(asc(events.startsAt));
}

export default async function ScanIndex() {
  await requireStaff();
  const rows = await scannableEvents();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Door scanner</h1>
        <p className="text-sm text-muted-foreground">Open the event on your phone while you still have signal. The guest list downloads so scanning keeps working offline.</p>
      </div>
      {rows.length === 0 ? (
        <EmptyState>No events to scan right now. Events show up here once they&apos;re published.</EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((e) => {
            const live = e.live;
            return (
              <Link key={e.id} href={`/admin/scan/${e.id}`} className="flex items-center gap-4 rounded-2xl border bg-card p-4 hover:bg-muted/40">
                <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><ScanLine className="size-6" aria-hidden /></div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{e.title}</div>
                  <div className="text-sm text-muted-foreground">{live ? <span className="font-medium text-forest dark:text-lime">Doors open · started {relative(e.startsAt)}</span> : `${fmtDateTime(e.startsAt)} · ${e.venue}`}</div>
                </div>
                <div className="text-right text-sm tabular-nums"><div className="font-semibold">{e.used}/{e.total}</div><div className="text-xs text-muted-foreground">checked in</div></div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
