import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { ClipboardCheck, Download, ScanLine, UsersRound } from "lucide-react";
import { db } from "@/db/client";
import { bookingItems, bookings } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { FlashToast } from "@/components/ui/flash-toast";
import { Notice } from "@/components/ui/notice";
import { Meter } from "@/components/admin/panel";
import { Stat } from "@/components/admin/stat";
import { eventEndsAt, eventStats, getEventById, publishChecklist, tierAvailability } from "@/lib/events";
import { peso, relative } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";
import { EventStatusControls } from "./status-controls";

const STYLE_NAMES: Record<string, string> = { summit: "Summit", "night-sky": "Night Sky", "trail-pass": "Trail Pass", "ridge-line": "Ridge Line", "campfire-stamp": "Campfire Stamp" };

export default async function AdminEventPage({ params }: PageProps<"/admin/events/[id]">) {
  const { id } = await params;
  await requireAdmin();
  const event = await getEventById(id);
  if (!event) notFound();
  const now = new Date();
  const [avail, stats, [counts], unpaidByTier] = await Promise.all([
    tierAvailability(id),
    eventStats(id),
    db
      .select({
        live: sql<number>`count(*) filter (where ${bookings.status} in ('approved','under_review','pending_payment','rejected'))::int`,
        approved: sql<number>`count(*) filter (where ${bookings.status} = 'approved')::int`,
        paidOrSubmitted: sql<number>`count(*) filter (where ${bookings.status} in ('approved','under_review') and ${bookings.totalCents} > 0)::int`,
        revenue: sql<number>`coalesce(sum(${bookings.totalCents}) filter (where ${bookings.status} = 'approved'), 0)::int`,
        waiting: sql<number>`coalesce(sum(${bookings.totalCents}) filter (where ${bookings.status} = 'under_review'), 0)::int`,
        oldest: sql<Date | null>`min(${bookings.submittedAt}) filter (where ${bookings.status} = 'under_review')`,
        unpaid: sql<number>`count(*) filter (where ${bookings.status} = 'pending_payment')::int`,
      })
      .from(bookings)
      .where(and(eq(bookings.eventId, id), inArray(bookings.status, ["approved", "under_review", "pending_payment", "rejected"]))),
    // Seats inside "reserved" that nobody has paid for yet, per tier
    db
      .select({ tierId: bookingItems.tierId, n: sql<number>`sum(${bookingItems.quantity})::int` })
      .from(bookingItems)
      .innerJoin(bookings, eq(bookings.id, bookingItems.bookingId))
      .where(and(eq(bookings.eventId, id), inArray(bookings.status, ["pending_payment", "rejected"]), gt(bookings.expiresAt, now)))
      .groupBy(bookingItems.tierId),
  ]);
  const onHold = new Map(unpaidByTier.map((r) => [r.tierId, r.n]));
  const capacity = event.tiers.reduce((n, t) => n + t.quantity, 0);
  const held = event.tiers.reduce((n, t) => n + avail(t).held, 0);
  const isPast = eventEndsAt(event) < now;
  const started = event.startsAt <= now;
  const checklist = publishChecklist(event, event.tiers);
  const paidTiers = event.tiers.some((t) => t.priceCents > 0);
  const noPayment = paidTiers && !event.gcashNumber && !event.gcashQrUrl;
  const approvedTickets = Math.max(1, counts.approved);
  const s = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

  return (
    <div className="space-y-[18px]">
      <Suspense><FlashToast messages={{ saved: "Changes saved", created: "Draft created. Check the list below, then publish." }} /></Suspense>

      {stats.pendingReview > 0 && (
        <Notice tone="warn" title={`${s(stats.pendingReview, "payment")} waiting for review`} actions={<Button asChild size="sm" className="h-9 rounded-full px-4"><Link href={`/admin/events/${id}/bookings`}>Review now</Link></Button>}>
          Members can&apos;t get their tickets until you approve.{counts.oldest ? ` Oldest receipt was sent ${relative(counts.oldest)}.` : ""}
        </Notice>
      )}
      {noPayment && event.status === "published" && (
        <Notice tone="destructive" title="Paid tiers but no payment details" actions={<Button asChild size="sm" variant="outline" className="h-9 rounded-full px-4"><Link href={`/admin/events/${id}/edit#payment`}>Add GCash details</Link></Button>}>
          People can reserve but have nowhere to send money.
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3.5">
        <Stat
          label="Reserved / capacity"
          value={<>{held}<span className="text-sm font-semibold text-muted-foreground"> / {capacity}</span></>}
          progress={capacity ? (held / capacity) * 100 : 0}
          hint={counts.unpaid > 0 ? `${s(counts.unpaid, "unpaid hold")} inside this number` : "All reserved seats are paid or free"}
        />
        <Stat label="Tickets issued" value={stats.issued} hint={paidTiers ? `${peso(counts.revenue).replace("Free", "₱0")} confirmed${counts.approved ? ` · avg ${peso(Math.round(counts.revenue / approvedTickets)).replace("Free", "₱0")} a booking` : ""}` : "Free event"} />
        <Stat
          label="Checked in"
          value={started || stats.used ? stats.used : <span className="text-muted-foreground">—</span>}
          hint={started || stats.used ? (stats.issued ? `${Math.round((stats.used / stats.issued) * 100)}% of issued` : undefined) : `Doors open ${relative(event.startsAt)}`}
        />
        <Stat label="Awaiting review" value={stats.pendingReview} highlight={stats.pendingReview > 0} hint={stats.pendingReview ? `${peso(counts.waiting)} waiting on you` : "Queue is clear"} />
      </div>

      <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-2">
        <div className="flex flex-col gap-[18px]">
          <section aria-labelledby="qa" className="rounded-[18px] border bg-card p-4">
            <h2 id="qa" className="mb-3 font-display text-lg font-extrabold">Quick actions</h2>
            <div className="grid grid-cols-2 gap-2">
              <QuickAction href={`/admin/events/${id}/bookings`} icon={<ClipboardCheck />} label="Bookings" count={stats.pendingReview} />
              <QuickAction href={`/admin/events/${id}/attendees`} icon={<UsersRound />} label="Attendees" />
              <QuickAction href={`/admin/scan/${id}`} icon={<ScanLine />} label="Door scanner" />
              <QuickAction href={`/api/admin/events/${id}/attendees.csv`} icon={<Download />} label="Attendees CSV" download />
            </div>
          </section>
          <EventStatusControls
            id={id}
            status={event.status}
            isPast={isPast}
            checklist={checklist}
            counts={{ live: counts.live, approved: counts.approved, tickets: stats.issued, paidOrSubmitted: counts.paidOrSubmitted }}
            heldSeats={held}
          />
        </div>

        <section aria-labelledby="tiers" className="flex flex-col rounded-[18px] border bg-card p-4">
          <div className="flex items-center justify-between pb-2">
            <h2 id="tiers" className="font-display text-lg font-extrabold">Tiers</h2>
            <Link href={`/admin/events/${id}/edit#tiers`} className="text-[13px] font-semibold text-accent-foreground hover:underline">Edit tiers</Link>
          </div>
          {event.tiers.map((t) => {
            const a = avail(t);
            const hold = onHold.get(t.id) ?? 0;
            const low = a.remaining > 0 && a.remaining <= Math.max(10, t.quantity * 0.1);
            return (
              <div key={t.id} className="flex flex-col gap-2 border-t py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{t.name} <span className="ml-1.5 text-xs font-semibold text-muted-foreground">{peso(t.priceCents)} · max {t.perOrderLimit}</span></div>
                    {t.description && <div className="truncate text-xs text-muted-foreground">{t.description}</div>}
                  </div>
                  <div className="shrink-0 text-right tabular-nums">
                    <div className="font-display text-base font-extrabold">{a.held}<span className="text-xs font-semibold text-muted-foreground"> / {t.quantity}</span></div>
                    <div className={cn("text-[11px] font-semibold", a.remaining === 0 ? (t.priceCents ? "text-destructive" : "text-muted-foreground") : low ? "text-warning-foreground" : "text-muted-foreground")}>
                      {a.remaining === 0 ? (t.priceCents ? "Sold out" : "All claimed") : `${a.remaining} left`}{hold ? ` · ${hold} on hold` : ""}
                    </div>
                  </div>
                </div>
                <Meter value={t.quantity ? (a.held / t.quantity) * 100 : 0} label={`${t.name} reserved`} />
              </div>
            );
          })}
          <div className="mt-2 rounded-xl bg-surface-2 px-3.5 py-3 text-[13px] leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Payment:</span>{" "}
            {paidTiers
              ? noPayment
                ? "No GCash number or QR yet."
                : [event.gcashName ? `GCash · ${event.gcashName}` : "GCash", event.gcashNumber, event.gcashQrUrl ? "QR uploaded" : null, `${event.bookingHoldHours}-hour holds`].filter(Boolean).join(" · ") + "."
              : "All tiers are free, so there's nothing to pay."}{" "}
            Ticket style: <span className="font-semibold text-foreground">{STYLE_NAMES[event.ticketStyle] ?? event.ticketStyle}</span>.
          </div>
        </section>
      </div>
    </div>
  );
}

function QuickAction({ href, icon, label, count = 0, download }: { href: string; icon: React.ReactNode; label: string; count?: number; download?: boolean }) {
  const cls = "flex h-11 items-center gap-2 rounded-xl bg-surface-2 px-3.5 text-[13px] font-semibold transition-colors hover:bg-surface-3 [&_svg]:size-4 [&_svg]:shrink-0";
  const inner = (
    <>
      {icon}
      <span className="truncate">{label}</span>
      {count > 0 && <span className="ml-auto rounded-full bg-sun px-[7px] py-px text-[11px] font-bold text-deep-forest tabular-nums dark:bg-star">{count}</span>}
    </>
  );
  return download ? <a href={href} className={cls}>{inner}</a> : <Link href={href} className={cls}>{inner}</Link>;
}
