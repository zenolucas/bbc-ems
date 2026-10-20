import Link from "next/link";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { Check, ChevronRight, Info, ScanLine } from "lucide-react";
import { db } from "@/db/client";
import { events, tickets } from "@/db/schema";
import { DeviceStatus } from "@/components/scanner/device-status";
import { EmptyState } from "@/components/ui/empty-state";
import { fmtDateTime, relative } from "@/lib/format";
import { requireStaff } from "@/lib/session";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Scanner" };

/** Published events that haven't been over for more than a day. */
function scannableEvents() {
  const endsAt = sql`coalesce(${events.endsAt}, ${events.startsAt} + interval '6 hours')`;
  // A join rather than correlated subqueries: drizzle leaves columns unqualified in
  // single-table selects, so a subquery's "id" would bind to the ticket, not the event.
  return db
    .select({
      id: events.id,
      title: events.title,
      startsAt: events.startsAt,
      venue: events.venueName,
      total: sql<number>`(count(${tickets.id}) filter (where ${tickets.status} <> 'void'))::int`,
      used: sql<number>`(count(${tickets.id}) filter (where ${tickets.status} = 'used'))::int`,
      live: sql<boolean>`${events.startsAt} <= now()`,
      ended: sql<boolean>`${endsAt} < now()`,
      endsAt: sql<Date>`${endsAt}`.mapWith(events.startsAt),
    })
    .from(events)
    .leftJoin(tickets, eq(tickets.eventId, events.id))
    .where(sql`${inArray(events.status, ["published", "ended"])} and ${endsAt} > now() - interval '1 day'`)
    .groupBy(events.id)
    .orderBy(asc(events.startsAt));
}

type Row = Awaited<ReturnType<typeof scannableEvents>>[number];

export default async function ScanIndex() {
  const user = await requireStaff();
  const rows = await scannableEvents();
  // Doors that are open get the big card; with none open, the next event does.
  const open = rows.filter((e) => e.live && !e.ended);
  const featured = open.length ? open : rows.filter((e) => !e.live).slice(0, 1);
  const rest = rows.filter((e) => !featured.includes(e));

  return (
    // Door crew work in the dark: this page is always Starlit Night, whatever the site theme.
    <div className="dark mx-auto max-w-2xl rounded-3xl bg-background p-4 text-foreground sm:p-6">
      <div className="flex flex-col gap-3.5">
        <div>
          <h1 className="font-display text-[28px] font-extrabold leading-none tracking-tight">Which door are you on?</h1>
          <p className="mt-2 text-[13px] leading-normal text-muted-foreground">
            Open the event while you still have signal. The guest list downloads to this phone, so scanning keeps working when the Wi-Fi dies.
          </p>
        </div>

        {rows.length === 0 ? (
          <EmptyState title="No events to scan right now">Events show up here once they&apos;re published.</EmptyState>
        ) : (
          <>
            {featured.map((e) => <FeaturedEvent key={e.id} e={e} />)}
            {rest.map((e) => <EventRow key={e.id} e={e} />)}
          </>
        )}

        <div className="mt-2 flex items-start gap-3 rounded-2xl bg-surface-2 p-3.5 text-xs leading-normal text-muted-foreground">
          <Info className="mt-px size-[18px] shrink-0 text-info" aria-hidden />
          <span>
            <span className="font-semibold text-foreground">Events show up here once they&apos;re published</span> and stay for a day after they end so late scans can sync.
            {user.role === "admin" && " Need the attendee list instead? It's under each event."}
          </span>
        </div>
      </div>
    </div>
  );
}

function FeaturedEvent({ e }: { e: Row }) {
  const pct = e.total ? Math.round((e.used / e.total) * 100) : 0;
  return (
    <Link
      href={`/admin/scan/${e.id}`}
      className={cn(
        "group flex flex-col gap-3 rounded-[22px] border bg-card p-4 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
        e.live ? "border-primary shadow-[0_0_0_4px_rgb(140_198_62/0.12)]" : "hover:border-primary/60",
      )}
    >
      <div className="flex items-center gap-2.5 text-xs font-bold">
        {e.live ? (
          <>
            <span
              aria-hidden
              className="relative size-2.5 shrink-0 rounded-full bg-primary after:absolute after:-inset-1 after:animate-pulse-ring after:rounded-full after:border-2 after:border-lime after:opacity-60 after:content-[''] motion-reduce:after:opacity-30"
            />
            <span className="text-success-foreground">Doors open · started {relative(e.startsAt)}</span>
          </>
        ) : (
          <>
            <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-star" />
            <span className="text-warning-foreground">Next up · doors {relative(e.startsAt)}</span>
          </>
        )}
      </div>
      <div>
        <div className="font-display text-[22px] font-extrabold leading-[1.05] tracking-tight">{e.title}</div>
        <div className="mt-1 text-[13px] text-muted-foreground">{e.live ? e.venue : `${fmtDateTime(e.startsAt)} · ${e.venue}`}</div>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label="Checked in" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <span className="font-display text-base font-extrabold tabular-nums">
          {e.used}<span className="text-xs font-semibold text-muted-foreground"> / {e.total} in</span>
        </span>
      </div>
      <div className="flex items-center justify-between gap-2.5 text-xs text-muted-foreground">
        <span className="min-w-0"><DeviceStatus eventId={e.id} variant="card" /></span>
        <span className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground group-hover:bg-primary/85">
          <ScanLine className="size-4" aria-hidden /> Scan
        </span>
      </div>
    </Link>
  );
}

function EventRow({ e }: { e: Row }) {
  return (
    <Link
      href={`/admin/scan/${e.id}`}
      className={cn(
        "flex items-center gap-3.5 rounded-[18px] border bg-card px-4 py-3.5 outline-none transition-colors hover:bg-surface-2/60 focus-visible:ring-3 focus-visible:ring-ring/50",
        e.ended && "opacity-70",
      )}
    >
      <div className={cn("grid size-[46px] shrink-0 place-items-center rounded-xl bg-surface-2", e.ended ? "text-success-foreground" : "text-muted-foreground")}>
        {e.ended ? <Check className="size-5" strokeWidth={2.4} aria-hidden /> : <ScanLine className="size-[22px]" aria-hidden />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-display text-base font-bold leading-tight tracking-tight">{e.title}</div>
        {e.ended ? (
          <div className="mt-0.5 text-xs text-muted-foreground">
            Ended {relative(e.endsAt)} · {e.used} / {e.total} in · <DeviceStatus eventId={e.id} ended variant="inline" />
          </div>
        ) : (
          <>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {e.live ? <span className="font-semibold text-success-foreground">Doors open · started {relative(e.startsAt)}</span> : fmtDateTime(e.startsAt)} · {e.venue}
            </div>
            <div className="text-xs text-muted-foreground">
              {e.total} ticket{e.total === 1 ? "" : "s"} · <DeviceStatus eventId={e.id} variant="inline" />
            </div>
          </>
        )}
      </div>
      <ChevronRight className="size-[18px] shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
