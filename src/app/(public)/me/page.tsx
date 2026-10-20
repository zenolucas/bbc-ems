import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/event/status-badge";
import { TicketCard } from "@/components/ticket/ticket-card";
import { listUserBookings } from "@/lib/bookings";
import { fmtDateTime, peso } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "My tickets" };

export default async function MePage() {
  const user = await requireUser("/me");
  const all = await listUserBookings(user.id);
  const { upcoming, past } = splitBookings(all);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My tickets</h1>
          <p className="text-sm text-muted-foreground">Signed in as {user.email} · <Link href="/me/profile" className="underline">edit name</Link></p>
        </div>
      </div>
      {upcoming.length === 0 && (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="text-muted-foreground">No upcoming tickets yet.</p>
          <Button asChild className="mt-4"><Link href="/">Browse events</Link></Button>
        </div>
      )}
      {upcoming.map((b) => <BookingBlock key={b.id} b={b} />)}
      {past.length > 0 && (
        <section className="space-y-4 pt-4">
          <h2 className="text-lg font-semibold text-muted-foreground">Past &amp; inactive</h2>
          {past.map((b) => <BookingBlock key={b.id} b={b} muted />)}
        </section>
      )}
    </div>
  );
}

function splitBookings(all: Awaited<ReturnType<typeof listUserBookings>>) {
  const now = Date.now();
  const isPast = (b: (typeof all)[number]) => (b.event.endsAt ?? new Date(b.event.startsAt.getTime() + 6 * 3600e3)).getTime() < now;
  const inactive = (b: (typeof all)[number]) => ["cancelled", "expired"].includes(b.status);
  return {
    upcoming: all.filter((b) => !isPast(b) && !inactive(b)),
    past: all.filter((b) => isPast(b) || inactive(b)),
  };
}

function BookingBlock({ b, muted }: { b: Awaited<ReturnType<typeof listUserBookings>>[number]; muted?: boolean }) {
  return (
    <section className={`rounded-2xl border bg-card p-4 ${muted ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href={`/events/${b.event.slug}`} className="font-semibold hover:underline">{b.event.title}</Link>
          <p className="text-sm text-muted-foreground">{fmtDateTime(b.event.startsAt)} · {b.event.venueName}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={b.status} />
          <Button asChild size="sm" variant="outline"><Link href={`/bookings/${b.id}`}>Details</Link></Button>
        </div>
      </div>
      {b.status === "approved" && b.tickets.length > 0 ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {b.tickets.map((t) => <TicketCard key={t.id} ticket={{ id: t.id, shortCode: t.shortCode, holderName: t.holderName, status: t.status, tierName: t.tier.name }} />)}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          {b.items.map((i) => `${i.quantity} × ${i.tier.name}`).join(", ")} · {peso(b.totalCents)}
          {b.status === "pending_payment" && " · payment needed"}
          {b.status === "under_review" && " · waiting for confirmation"}
        </p>
      )}
    </section>
  );
}
