import Link from "next/link";
import { asc, gte, inArray, sql } from "drizzle-orm";
import { ScanLine } from "lucide-react";
import { db } from "@/db/client";
import { events, tickets } from "@/db/schema";
import { fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Scanner" };

function recentEvents() {
  const since = new Date(Date.now() - 2 * 86400e3);
  return db
    .select({
      id: events.id,
      title: events.title,
      startsAt: events.startsAt,
      venue: events.venueName,
      issued: sql<number>`(select count(*) from ${tickets} where ${tickets.eventId} = ${events.id})::int`,
      used: sql<number>`(select count(*) from ${tickets} where ${tickets.eventId} = ${events.id} and ${tickets.status} = 'used')::int`,
    })
    .from(events)
    .where(sql`${inArray(events.status, ["published", "ended"])} and ${gte(events.startsAt, since)}`)
    .orderBy(asc(events.startsAt));
}

export default async function ScanIndex() {
  const rows = await recentEvents();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Door scanner</h1>
        <p className="text-sm text-muted-foreground">Open an event on your phone before you lose signal. The ticket list downloads for offline checking.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.length === 0 && <p className="text-muted-foreground">No upcoming events.</p>}
        {rows.map((e) => (
          <Link key={e.id} href={`/admin/scan/${e.id}`} className="flex items-center gap-4 rounded-2xl border bg-card p-4 hover:bg-muted/40">
            <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><ScanLine className="size-6" /></div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{e.title}</div>
              <div className="text-sm text-muted-foreground">{fmtDateTime(e.startsAt)} · {e.venue}</div>
            </div>
            <div className="text-right text-sm tabular-nums"><div className="font-semibold">{e.used}/{e.issued}</div><div className="text-xs text-muted-foreground">in</div></div>
          </Link>
        ))}
      </div>
    </div>
  );
}
