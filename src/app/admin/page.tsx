import Link from "next/link";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { ChevronRight, CircleAlert, ClipboardCheck, Plus, ScanLine, type LucideIcon } from "lucide-react";
import { db } from "@/db/client";
import { bookings, events, ticketTiers, tickets, users } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Meter, PageHeader, Panel, panelRowLink } from "@/components/admin/panel";
import { Sparkline } from "@/components/admin/sparkline";
import { Stat } from "@/components/admin/stat";
import { StatusBadge } from "@/components/event/status-badge";
import { eventEndsAt, heldByTier, publishChecklist, ticketsPerDay, tierIsOnSale } from "@/lib/events";
import { requireAdmin } from "@/lib/session";
import { fmtDate, peso, relative } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Admin" };

export default async function AdminHome() {
  const me = await requireAdmin();
  const now = new Date();
  const [live, queue, drafts, doorCrew, sold, recent] = await Promise.all([
    // Published events that haven't ended yet, including ones happening right now
    db.query.events.findMany({
      where: and(eq(events.status, "published"), gte(sql`coalesce(${events.endsAt}, ${events.startsAt} + interval '6 hours')`, now)),
      orderBy: asc(events.startsAt),
      with: { tiers: { orderBy: asc(ticketTiers.sortOrder) } },
    }),
    db
      .select({ eventId: bookings.eventId, title: events.title, n: sql<number>`count(*)::int`, cents: sql<number>`sum(${bookings.totalCents})::int`, oldest: sql<Date>`min(${bookings.submittedAt})` })
      .from(bookings)
      .innerJoin(events, eq(events.id, bookings.eventId))
      .where(eq(bookings.status, "under_review"))
      .groupBy(bookings.eventId, events.title)
      .orderBy(sql`min(${bookings.submittedAt}) asc`),
    db.query.events.findMany({ where: and(eq(events.status, "draft"), gte(events.startsAt, now)), orderBy: asc(events.startsAt), limit: 5, with: { tiers: true } }),
    db.select({ n: sql<number>`count(*)::int` }).from(users).where(eq(users.role, "staff")),
    ticketsPerDay(14),
    db
      .select({ id: bookings.id, status: bookings.status, totalCents: bookings.totalCents, updatedAt: bookings.updatedAt, submittedAt: bookings.submittedAt, reviewedAt: bookings.reviewedAt, name: users.name, email: users.email, event: events.title, eventId: events.id })
      .from(bookings)
      .innerJoin(users, eq(users.id, bookings.userId))
      .innerJoin(events, eq(events.id, bookings.eventId))
      .orderBy(desc(bookings.updatedAt))
      .limit(5),
  ]);
  const liveIds = live.map((e) => e.id);
  const [held, perEvent, [holds]] = await Promise.all([
    heldByTier(liveIds),
    liveIds.length
      ? db
          .select({
            eventId: bookings.eventId,
            confirmed: sql<number>`coalesce(sum(${bookings.totalCents}) filter (where ${bookings.status} = 'approved'), 0)::int`,
          })
          .from(bookings)
          .where(inArray(bookings.eventId, liveIds))
          .groupBy(bookings.eventId)
      : Promise.resolve([]),
    db
      .select({
        n: sql<number>`count(*)::int`,
        soon: sql<number>`count(*) filter (where ${bookings.expiresAt} < ${new Date(now.getTime() + 12 * 3600e3)})::int`,
      })
      .from(bookings)
      .where(and(eq(bookings.status, "pending_payment"), gte(bookings.expiresAt, now))),
  ]);
  const issued = liveIds.length
    ? new Map((await db.select({ eventId: tickets.eventId, n: sql<number>`count(*)::int` }).from(tickets).where(and(inArray(tickets.eventId, liveIds), sql`${tickets.status} <> 'void'`)).groupBy(tickets.eventId)).map((r) => [r.eventId, r.n]))
    : new Map<string, number>();
  const confirmed = new Map(perEvent.map((r) => [r.eventId, r.confirmed]));

  const totalPending = queue.reduce((n, q) => n + q.n, 0);
  const missingPayment = live.filter((e) => e.tiers.some((t) => t.priceCents > 0) && !e.gcashNumber && !e.gcashQrUrl);
  const soon = live.filter((e) => e.startsAt.getTime() - now.getTime() < 48 * 3600e3);
  const attention = queue.length + missingPayment.length + soon.length;
  const oldest = queue.reduce<Date | null>((d, q) => (q.oldest && (!d || q.oldest < d) ? q.oldest : d), null);

  const hour = Number(fmtDate(now, "H"));
  const greeting = hour < 5 ? "Up late" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const first = (me.name || me.email.split("@")[0]).split(/\s+/)[0];
  const delta = sold.previous ? Math.round(((sold.total - sold.previous) / sold.previous) * 100) : null;

  return (
    <div className="space-y-[22px]">
      <PageHeader
        title={`${greeting}, ${first.charAt(0).toUpperCase()}${first.slice(1)}.`}
        sub={[fmtDate(now, "EEE, MMM d"), `${live.length} live event${live.length === 1 ? "" : "s"}`, totalPending ? `${totalPending} receipt${totalPending === 1 ? "" : "s"} waiting for you` : "no receipts waiting"].join(" · ")}
        actions={
          <Button asChild size="icon-lg" className="rounded-full lg:hidden" aria-label="New event">
            <Link href="/admin/events/new"><Plus className="size-5 stroke-[2.4]" /></Link>
          </Button>
        }
        className="flex-nowrap items-center"
      />

      <section aria-labelledby="attn" className={cn("overflow-hidden rounded-[18px] border bg-card", attention > 0 && "border-warning")}>
        <div className="flex items-center justify-between px-4 py-3.5">
          <h2 id="attn" className="flex items-center gap-2 font-display text-base font-extrabold lg:text-lg">
            <span className={cn("size-2 rounded-full", attention ? "bg-warning" : "bg-success")} aria-hidden />
            Needs attention
          </h2>
          <span className="text-xs text-muted-foreground">{attention === 0 ? "all clear" : `${attention} item${attention === 1 ? "" : "s"}`}</span>
        </div>
        {attention === 0 && <p className="border-t px-4 py-4 text-sm text-muted-foreground">All clear. No payments to review and nothing starting in the next two days.</p>}
        {queue.map((q) => (
          <AttentionRow
            key={q.eventId}
            href={`/admin/events/${q.eventId}/bookings`}
            tone="warn"
            icon={ClipboardCheck}
            title={`${q.n} payment${q.n === 1 ? "" : "s"} to review · ${q.title}`}
            detail={`Oldest receipt sent ${q.oldest ? relative(q.oldest) : "recently"} · ${peso(q.cents)} waiting`}
            action="Review"
            primary
          />
        ))}
        {missingPayment.map((e) => (
          <AttentionRow
            key={`pay-${e.id}`}
            href={`/admin/events/${e.id}/edit#payment`}
            tone="bad"
            icon={CircleAlert}
            title={`${e.title} has paid tiers but no GCash details`}
            detail="People can reserve but have nowhere to send money."
            action="Add details"
          />
        ))}
        {soon.map((e) => {
          const happening = e.startsAt < now;
          return (
            <AttentionRow
              key={`soon-${e.id}`}
              href={`/admin/scan/${e.id}`}
              tone="ok"
              icon={ScanLine}
              title={`${e.title} ${happening ? "is happening now" : `starts ${relative(e.startsAt)}, ${fmtDate(e.startsAt, "h:mm a")}`}`}
              detail={`${issued.get(e.id) ?? 0} tickets issued · ${doorCrew[0].n} door crew ${doorCrew[0].n === 1 ? "has" : "have"} access · open the scanner while you still have signal`}
              action="Open scanner"
            />
          );
        })}
      </section>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3.5">
        <Stat label="Live events" value={live.length} hint={drafts.length ? `${drafts.length} draft${drafts.length === 1 ? "" : "s"} waiting to publish` : "No drafts waiting"} />
        <Stat label="Awaiting review" value={totalPending} highlight={totalPending > 0} hint={oldest ? `oldest ${relative(oldest)} · first come, first served` : "Queue is clear"} />
        <Stat label="Unpaid holds" value={holds.n} hint={holds.soon ? `expire on their own · ${holds.soon} within 12h` : "expire on their own"} />
        <Stat
          label="Sold · 14 days"
          value={sold.total}
          aside={delta !== null && (
            <span className={cn("text-xs font-semibold tabular-nums", delta >= 0 ? "text-success-foreground" : "text-muted-foreground")}>
              {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}%<span className="sr-only"> on the 14 days before</span>
            </span>
          )}
        >
          <Sparkline points={sold.series.map((d) => ({ label: fmtDate(`${d.day}T12:00:00+08:00`, "MMM d"), n: d.n }))} unit={["ticket", "tickets"]} label="Tickets issued per day over the last 14 days" />
        </Stat>
      </div>

      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Panel id="live" title="Live events" link={{ href: "/admin/events", label: "All events" }}>
          {live.length === 0 && (
            <div className="border-t p-4">
              <EmptyState action={<Button asChild size="sm"><Link href="/admin/events/new">Create an event</Link></Button>}>Nothing published.</EmptyState>
            </div>
          )}
          {live.map((e) => {
            const cap = e.tiers.reduce((n, t) => n + t.quantity, 0);
            const res = e.tiers.reduce((n, t) => n + (held.get(t.id) ?? 0), 0);
            const happening = e.startsAt < now && eventEndsAt(e) > now;
            const paid = e.tiers.some((t) => t.priceCents > 0);
            const onSale = e.tiers.some((t) => tierIsOnSale(t, now));
            const nextSale = e.tiers.map((t) => t.salesStart).filter((d): d is Date => !!d && d > now).sort((a, b) => a.getTime() - b.getTime())[0];
            return (
              <Link key={e.id} href={`/admin/events/${e.id}`} className={cn(panelRowLink, "flex-col items-stretch gap-2.5")}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{e.title}</div>
                    <div className={cn("truncate text-xs", happening || e.startsAt.getTime() - now.getTime() < 36 * 3600e3 ? "font-semibold text-success-foreground" : "text-muted-foreground")}>
                      {happening ? "Happening now" : `${fmtDate(e.startsAt, "EEE, MMM d · h:mm a")} · ${relative(e.startsAt)}`}
                      {!onSale && nextSale ? ` · sales open ${fmtDate(nextSale, "MMM d")}` : ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-right tabular-nums">
                    <div className="font-display text-base font-extrabold lg:text-lg">{res}<span className="text-xs font-semibold text-muted-foreground"> / {cap}</span></div>
                    <div className="text-[11px] text-muted-foreground">{!onSale && nextSale ? "not on sale yet" : `reserved · ${paid ? `${peso(confirmed.get(e.id) ?? 0).replace("Free", "₱0")} confirmed` : "free"}`}</div>
                  </div>
                </div>
                <Meter value={cap ? (res / cap) * 100 : 0} />
              </Link>
            );
          })}
        </Panel>

        <div className="flex flex-col gap-[18px]">
          <Panel id="drafts" title="Drafts">
            {drafts.length === 0 && <p className="border-t px-4 py-4 text-sm text-muted-foreground">No drafts.</p>}
            {drafts.map((e) => {
              const checks = publishChecklist(e, e.tiers);
              const green = checks.filter((c) => c.ok).length;
              const missing = checks.find((c) => !c.ok);
              return (
                <Link key={e.id} href={`/admin/events/${e.id}`} className={panelRowLink}>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{e.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{fmtDate(e.startsAt, "EEE, MMM d")} · {green} of {checks.length} checks green{missing ? ` · needs ${missing.label.toLowerCase().replace(/^at least /, "")}` : ""}</div>
                  </div>
                  <StatusBadge status={e.status} admin />
                </Link>
              );
            })}
          </Panel>
          <Panel id="recent" title="Recent">
            {recent.length === 0 && <p className="border-t px-4 py-4 text-sm text-muted-foreground">No bookings yet.</p>}
            {recent.map((b) => {
              const a = activity(b);
              return (
                <Link key={b.id} href={`/admin/events/${b.eventId}/bookings?show=all#${b.id}`} className={panelRowLink}>
                  <span className={cn("size-2 shrink-0 rounded-full", a.dot)} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-[13px]">
                    <span className="font-semibold">{b.name || b.email.split("@")[0]}</span> <span className="text-muted-foreground">{a.text} · {b.event}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{ago(a.at, now)}</span>
                </Link>
              );
            })}
          </Panel>
        </div>
      </div>
    </div>
  );
}

const TONES = {
  warn: "bg-warning-soft text-warning-foreground",
  bad: "bg-destructive-soft text-destructive",
  ok: "bg-success-soft text-primary dark:text-success-foreground",
};

/** A priority-inbox row: tone-tinted icon tile, what and why, and the one thing to do about it. */
function AttentionRow({ href, tone, icon: Icon, title, detail, action, primary }: { href: string; tone: keyof typeof TONES; icon: LucideIcon; title: string; detail: string; action: string; primary?: boolean }) {
  return (
    <Link href={href} className={panelRowLink}>
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-[10px] lg:size-10 lg:rounded-xl", TONES[tone])}><Icon className="size-[18px] lg:size-5" aria-hidden /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold lg:text-sm lg:whitespace-normal">{title}</span>
        <span className="block truncate text-xs text-muted-foreground lg:whitespace-normal">{detail}</span>
      </span>
      <span className={cn("hidden h-[34px] shrink-0 items-center rounded-full border px-3.5 text-[13px] font-semibold sm:inline-flex", primary ? "border-transparent bg-primary text-primary-foreground" : "bg-card")}>{action}</span>
      <ChevronRight className="size-[18px] shrink-0 text-muted-foreground sm:hidden" aria-hidden />
    </Link>
  );
}

type Recent = { status: string; totalCents: number; updatedAt: Date; submittedAt: Date | null; reviewedAt: Date | null };

/** One line of the activity feed, from a booking's latest state. */
function activity(b: Recent): { text: string; dot: string; at: Date } {
  switch (b.status) {
    case "approved":
      return { text: b.totalCents ? `paid ${peso(b.totalCents)}` : "booked free tickets", dot: "bg-success", at: b.reviewedAt ?? b.updatedAt };
    case "under_review":
      return { text: "sent a receipt", dot: "bg-warning", at: b.submittedAt ?? b.updatedAt };
    case "pending_payment":
      return { text: `reserved ${peso(b.totalCents)}, not paid yet`, dot: "bg-muted-foreground", at: b.updatedAt };
    case "rejected":
      return { text: "receipt rejected", dot: "bg-destructive", at: b.reviewedAt ?? b.updatedAt };
    case "expired":
      return { text: "hold expired · seats released", dot: "bg-muted-foreground", at: b.updatedAt };
    default:
      return { text: "booking cancelled", dot: "bg-muted-foreground", at: b.updatedAt };
  }
}

/** Feed-sized ages: "8 min", "2 h", "3 d". */
function ago(d: Date, now: Date) {
  const m = Math.max(0, Math.round((now.getTime() - d.getTime()) / 60000));
  if (m < 1) return "now";
  if (m < 60) return `${m} min`;
  if (m < 48 * 60) return `${Math.round(m / 60)} h`;
  return `${Math.round(m / 1440)} d`;
}
