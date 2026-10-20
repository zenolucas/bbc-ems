import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, bookingStatusCopy } from "@/components/event/status-badge";
import { TicketCard } from "@/components/ticket/ticket-card";
import { effectiveStatus, listUserBookings } from "@/lib/bookings";
import { fmtDateTime, peso, relative } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "My tickets" };

type B = Awaited<ReturnType<typeof listUserBookings>>[number];

export default async function MePage() {
  const user = await requireUser("/me");
  const all = await listUserBookings(user.id);
  const { today, upcoming, past } = splitBookings(all);
  const needsAction = [...today, ...upcoming].filter((b) => ["pending_payment", "rejected"].includes(effectiveStatus(b)));

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My tickets</h1>
        <p className="text-sm text-muted-foreground">Signed in as {user.email} · <Link href="/me/profile" className="underline">Profile</Link></p>
      </div>

      {needsAction.length > 0 && (
        <p role="status" className="rounded-xl border border-sun/60 bg-sun/15 px-4 py-3 text-sm">
          <span className="font-medium">{needsAction.length === 1 ? "1 booking needs" : `${needsAction.length} bookings need`} your attention.</span> Finish paying before the hold runs out.
        </p>
      )}

      {today.length > 0 && (
        <section className="space-y-4" aria-labelledby="today-heading">
          <h2 id="today-heading" className="text-lg font-semibold">Today</h2>
          {today.map((b) => <BookingBlock key={b.id} b={b} highlight />)}
        </section>
      )}

      {today.length === 0 && upcoming.length === 0 && (
        <EmptyState action={<Button asChild><Link href="/">Browse events</Link></Button>}>No upcoming tickets yet.</EmptyState>
      )}

      {upcoming.length > 0 && (
        <section className="space-y-4" aria-labelledby="upcoming-heading">
          {today.length > 0 && <h2 id="upcoming-heading" className="text-lg font-semibold">Coming up</h2>}
          {upcoming.map((b) => <BookingBlock key={b.id} b={b} />)}
        </section>
      )}

      {past.length > 0 && (
        <section className="space-y-4 pt-4" aria-labelledby="past-heading">
          <h2 id="past-heading" className="text-lg font-semibold text-muted-foreground">Past &amp; inactive</h2>
          {past.map((b) => <BookingBlock key={b.id} b={b} muted />)}
        </section>
      )}
    </div>
  );
}

function splitBookings(all: B[]) {
  const now = Date.now();
  const endOf = (b: B) => (b.event.endsAt ?? new Date(b.event.startsAt.getTime() + 6 * 3600e3)).getTime();
  const isPast = (b: B) => endOf(b) < now;
  const inactive = (b: B) => ["cancelled", "expired"].includes(effectiveStatus(b)) || b.event.status === "cancelled";
  const live = all.filter((b) => !isPast(b) && !inactive(b)).sort((a, b) => a.event.startsAt.getTime() - b.event.startsAt.getTime());
  // "Today" means it starts within the next 18 hours or is already on
  const isToday = (b: B) => b.event.startsAt.getTime() - now < 18 * 3600e3;
  return {
    today: live.filter(isToday),
    upcoming: live.filter((b) => !isToday(b)),
    past: all.filter((b) => isPast(b) || inactive(b)),
  };
}

function BookingBlock({ b, muted, highlight }: { b: B; muted?: boolean; highlight?: boolean }) {
  const status = b.event.status === "cancelled" ? "cancelled" : effectiveStatus(b);
  const showTickets = b.status === "approved" && b.tickets.length > 0 && b.event.status !== "cancelled";
  return (
    <section className={`rounded-2xl border bg-card p-4 ${muted ? "opacity-70" : ""} ${highlight ? "border-primary/50 shadow-sm" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/events/${b.event.slug}`} className="font-semibold hover:underline">{b.event.title}</Link>
          <p className="text-sm text-muted-foreground">
            {fmtDateTime(b.event.startsAt)} · {b.event.venueName}
            {highlight && <span className="font-medium text-foreground"> · starts {relative(b.event.startsAt)}</span>}
          </p>
        </div>
        <StatusBadge status={status} />
      </div>
      {showTickets ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {b.tickets.map((t) => <TicketCard key={t.id} ticket={{ id: t.id, shortCode: t.shortCode, holderName: t.holderName, status: t.status, tierName: t.tier.name }} />)}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          {b.items.map((i) => `${i.quantity} × ${i.tier.name}`).join(", ")} · {peso(b.totalCents)}
          {b.event.status === "cancelled" ? " · event cancelled" : bookingStatusCopy(status) ? ` · ${bookingStatusCopy(status)}` : ""}
        </p>
      )}
      <div className="mt-3 flex justify-end">
        <Button asChild size="sm" variant={["pending_payment", "rejected"].includes(status) ? "default" : "ghost"}>
          <Link href={`/bookings/${b.id}`}>
            {status === "pending_payment" ? "Pay now" : status === "rejected" ? "Fix payment" : showTickets && b.tickets.length > 1 ? "Manage guests" : "Booking details"}
            <ChevronRight />
          </Link>
        </Button>
      </div>
    </section>
  );
}
