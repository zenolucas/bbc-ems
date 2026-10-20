import Link from "next/link";
import { Suspense } from "react";
import { desc, eq, gte, sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/db/client";
import { bookings, events, tickets } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FlashToast } from "@/components/ui/flash-toast";
import { PageHeader } from "@/components/admin/panel";
import { eventEndsAt, heldByTier, pendingReviewByEvent, publishChecklist, tierIsOnSale } from "@/lib/events";
import { requireAdmin } from "@/lib/session";
import { fmtDate, peso, relative } from "@/lib/format";
import { type EventRow, EventsTable } from "./events-table";

export const metadata = { title: "Events" };

export default async function AdminEventsPage() {
  await requireAdmin();
  const rows = await db.query.events.findMany({ orderBy: desc(events.startsAt), with: { tiers: true } });
  const now = new Date();
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1) - 8 * 3600e3);
  const [held, pending, money, came, [year]] = await Promise.all([
    heldByTier(rows.map((e) => e.id)),
    pendingReviewByEvent(),
    db
      .select({ eventId: bookings.eventId, cents: sql<number>`coalesce(sum(${bookings.totalCents}) filter (where ${bookings.status} = 'approved'), 0)::int` })
      .from(bookings)
      .groupBy(bookings.eventId),
    db.select({ eventId: tickets.eventId, n: sql<number>`count(*)::int` }).from(tickets).where(eq(tickets.status, "used")).groupBy(tickets.eventId),
    db.select({ cents: sql<number>`coalesce(sum(${bookings.totalCents}), 0)::int` }).from(bookings).where(sql`${bookings.status} = 'approved' and ${gte(bookings.reviewedAt, yearStart)}`),
  ]);
  const confirmed = new Map(money.map((m) => [m.eventId, m.cents]));
  const checkedIn = new Map(came.map((c) => [c.eventId, c.n]));

  const data: EventRow[] = rows.map((e) => {
    const cap = e.tiers.reduce((n, t) => n + t.quantity, 0);
    const sold = e.tiers.reduce((n, t) => n + (held.get(t.id) ?? 0), 0);
    const past = eventEndsAt(e) < now;
    const paid = e.tiers.some((t) => t.priceCents > 0);
    const checks = e.status === "draft" ? publishChecklist(e, e.tiers) : [];
    const missing = checks.find((c) => !c.ok);
    const nextSale = e.tiers.map((t) => t.salesStart).filter((d): d is Date => !!d && d > now).sort((a, b) => a.getTime() - b.getTime())[0];
    const onSale = e.tiers.some((t) => tierIsOnSale(t, now));
    const soon = !past && e.startsAt.getTime() - now.getTime() < 36 * 3600e3;
    return {
      id: e.id,
      slug: e.slug,
      title: e.title,
      cover: e.coverImageUrl,
      status: past && e.status === "published" ? "ended" : e.status,
      group: e.status === "draft" ? "drafts" : past || e.status === "ended" || e.status === "cancelled" ? "past" : "upcoming",
      // Precomputed here so the client list never renders a clock-dependent string
      venue: past && checkedIn.get(e.id) ? `${e.venueName} · ${checkedIn.get(e.id)} came` : e.venueName,
      warning: e.status === "published" && !past && paid && !e.gcashNumber && !e.gcashQrUrl ? "Paid tiers, no GCash details" : null,
      draftNote: missing ? `needs ${missing.label.toLowerCase().replace(/^at least /, "")}` : null,
      day: fmtDate(e.startsAt, "EEE, MMM d"),
      time: [fmtDate(e.startsAt, "h:mm a"), past ? null : !onSale && nextSale ? `sales open ${fmtDate(nextSale, "MMM d")}` : relative(e.startsAt)].filter(Boolean).join(" · "),
      soon,
      cap,
      sold,
      pending: pending.get(e.id) ?? 0,
      confirmed: e.status === "draft" ? "—" : paid ? peso(confirmed.get(e.id) ?? 0).replace("Free", "₱0") : "Free",
      past,
    };
  });
  const live = data.filter((d) => d.group === "upcoming").length;

  return (
    <div className="space-y-[18px]">
      <Suspense><FlashToast messages={{ deleted: "Event deleted" }} /></Suspense>
      <PageHeader
        title="Events"
        sub={`${rows.length} in total · ${live} live · ${peso(year.cents).replace("Free", "₱0")} confirmed this year`}
        actions={
          <Button asChild size="icon-lg" className="rounded-full lg:hidden" aria-label="New event">
            <Link href="/admin/events/new"><Plus className="size-5 stroke-[2.4]" /></Link>
          </Button>
        }
        className="flex-nowrap items-center"
      />
      {rows.length === 0 ? (
        <EmptyState title="No events yet" action={<Button asChild><Link href="/admin/events/new">Create the first event</Link></Button>}>Drafts stay hidden until you publish them.</EmptyState>
      ) : (
        <EventsTable rows={data} />
      )}
    </div>
  );
}
