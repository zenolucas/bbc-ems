import Link from "next/link";
import { desc, inArray, sql } from "drizzle-orm";
import { ChevronRight } from "lucide-react";
import { db } from "@/db/client";
import { events } from "@/db/schema";
import { EmptyState } from "@/components/ui/empty-state";
import { eventEndsAt } from "@/lib/events";
import { fmtDate, relative } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Attendees" };

/** Guest lists live per event; this picks one. Happening and upcoming first, then the recent past. */
export default async function AttendeesIndex() {
  await requireAdmin();
  const rows = await db
    .select({
      id: events.id,
      title: events.title,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      venue: events.venueName,
      status: events.status,
      // Spelled out: drizzle drops table prefixes in single-table selects, which would bind these to tickets
      total: sql<number>`(select count(*) from tickets t where t.event_id = "events"."id" and t.status <> 'void')::int`,
      used: sql<number>`(select count(*) from tickets t where t.event_id = "events"."id" and t.status = 'used')::int`,
    })
    .from(events)
    .where(inArray(events.status, ["published", "ended", "cancelled"]))
    .orderBy(desc(events.startsAt));
  const now = new Date();
  const current = rows.filter((e) => eventEndsAt(e) >= now).reverse();
  const past = rows.filter((e) => eventEndsAt(e) < now).slice(0, 8);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[26px] leading-none font-extrabold tracking-tight lg:text-[32px]">Attendees</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Pick an event for its guest list, manual check-in and CSV.</p>
      </div>
      {rows.length === 0 ? (
        <EmptyState>No published events yet, so nobody holds a ticket.</EmptyState>
      ) : (
        <>
          <List title="Upcoming" rows={current} now={now} />
          <List title="Past" rows={past} now={now} muted />
        </>
      )}
    </div>
  );
}

type Row = { id: string; title: string; startsAt: Date; endsAt: Date | null; venue: string; status: string; total: number; used: number };

function List({ title, rows, now, muted }: { title: string; rows: Row[]; now: Date; muted?: boolean }) {
  if (rows.length === 0) return null;
  return (
    <section aria-label={title} className={cn("overflow-hidden rounded-[18px] border bg-card", muted && "opacity-85")}>
      <h2 className="px-4 pt-3.5 pb-2 font-display text-lg font-extrabold">{title}</h2>
      {rows.map((e) => {
        const live = e.startsAt <= now && eventEndsAt(e) >= now;
        const pct = e.total ? Math.round((e.used / e.total) * 100) : 0;
        return (
          <Link key={e.id} href={`/admin/events/${e.id}/attendees`} className="flex items-center gap-4 border-t px-4 py-3 hover:bg-surface-2/60">
            <span className="min-w-0 flex-1 space-y-2">
              <span className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className={cn("block truncate text-sm font-semibold", e.status === "cancelled" && "line-through")}>{e.title}</span>
                  <span className={cn("block truncate text-xs", live ? "font-semibold text-success-foreground" : "text-muted-foreground")}>
                    {live ? `Happening now · started ${relative(e.startsAt)}` : `${fmtDate(e.startsAt, "EEE, MMM d · h:mm a")} · ${e.venue}`}
                  </span>
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  <span className="font-display text-base font-extrabold">{e.used}<span className="text-xs font-semibold text-muted-foreground"> / {e.total}</span></span>
                  <span className="block text-[11px] text-muted-foreground">checked in</span>
                </span>
              </span>
              <span className="block h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden><span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        );
      })}
    </section>
  );
}
