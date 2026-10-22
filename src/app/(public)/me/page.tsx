import Link from "next/link";
import { Check, ChevronDown, ChevronRight, Clock, QrCode } from "lucide-react";
import { Skyline } from "@/components/brand/skyline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CountdownText } from "@/components/ui/countdown";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, bookingStatusCopy } from "@/components/event/status-badge";
import { TicketCard } from "@/components/ticket/ticket-card";
import { effectiveStatus, listUserBookings } from "@/lib/bookings";
import { getDiscordAccount } from "@/lib/discord/members";
import { discordLoginEnabled } from "@/lib/env";
import { fmtDate, fmtLeft, fmtTime, peso } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "My tickets" };

type B = Awaited<ReturnType<typeof listUserBookings>>[number];

const firstName = (n: string) => n.split(" ")[0] || n;

export default async function MePage() {
  const user = await requireUser("/me");
  const [all, discord] = await Promise.all([listUserBookings(user.id), discordLoginEnabled ? getDiscordAccount(user.id) : null]);
  const { today, upcoming, past, now } = splitBookings(all);
  const needsAction = [...today, ...upcoming].filter((b) => ["pending_payment", "rejected"].includes(effectiveStatus(b)));
  const passes = today.filter(hasLiveTickets);
  const comingUp = [...today.filter((b) => !hasLiveTickets(b)), ...upcoming];
  const first = needsAction[0];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-[30px] leading-none font-extrabold tracking-tight">Your passes</h1>
        <p className="truncate text-[13px] text-muted-foreground">
          {user.email} · <Link href="/me/profile" className="font-semibold text-accent-foreground hover:underline">Name on tickets</Link>
          {discordLoginEnabled && !discord && <> · <Link href="/me/profile#discord-h" className="font-semibold text-accent-foreground hover:underline">Link Discord</Link></>}
        </p>
      </div>

      {first && (
        <div role="status" className="flex items-center gap-3 rounded-[14px] bg-warning-soft px-3.5 py-3">
          <Clock className="size-5 shrink-0 text-warning-foreground" aria-hidden />
          <p className="min-w-0 flex-1 text-[13px] leading-snug text-warning-foreground">
            <span className="font-bold">{needsAction.length === 1 ? "1 booking needs" : `${needsAction.length} bookings need`} your attention.</span>{" "}
            {effectiveStatus(first) === "rejected"
              ? `The ${first.event.title} payment needs fixing${first.expiresAt ? ` within ${fmtLeft(first.expiresAt.getTime() - now)}` : ""}.`
              : `The ${first.event.title} hold ends${first.expiresAt ? ` in ${fmtLeft(first.expiresAt.getTime() - now)}` : " soon"}.`}
          </p>
          <Button asChild variant="sun" size="sm" className="h-[34px] shrink-0 rounded-full px-3 text-xs font-semibold md:h-[34px]">
            <Link href={`/bookings/${first.id}`}>{effectiveStatus(first) === "rejected" ? "Fix payment" : "Pay now"}</Link>
          </Button>
        </div>
      )}

      {passes.length > 0 && (
        <section className="space-y-2.5" aria-labelledby="tonight-heading">
          <h2 id="tonight-heading" className="px-1 text-xl font-extrabold">{passes.some((b) => dayWord(b.event.startsAt, now) === "Tonight") ? "Tonight" : "Today"}</h2>
          {passes.map((b) => <TonightPass key={b.id} b={b} me={user.name} now={now} />)}
        </section>
      )}

      {passes.length === 0 && comingUp.length === 0 && (
        <EmptyState title="No passes yet" action={<Button asChild size="lg"><Link href="/">Browse events</Link></Button>}>No upcoming tickets yet.</EmptyState>
      )}

      {comingUp.length > 0 && (
        <section className="space-y-2.5" aria-labelledby="upcoming-heading">
          <h2 id="upcoming-heading" className="px-1 text-xl font-extrabold">Coming up</h2>
          {comingUp.map((b) => <BookingBlock key={b.id} b={b} now={now} />)}
        </section>
      )}

      {past.length > 0 && (
        <details className="group space-y-2.5">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-xl px-1 text-muted-foreground [&::-webkit-details-marker]:hidden">
            <h2 className="text-lg font-bold text-muted-foreground">Past &amp; inactive · {past.length}</h2>
            <ChevronDown className="size-5 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
          </summary>
          <div className="space-y-2.5">
            {past.map((b) => <PastRow key={b.id} b={b} />)}
          </div>
        </details>
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
    now,
    today: live.filter(isToday),
    upcoming: live.filter((b) => !isToday(b)),
    past: all.filter((b) => isPast(b) || inactive(b)),
  };
}

function hasLiveTickets(b: B) {
  return b.status === "approved" && b.event.status !== "cancelled" && b.tickets.some((t) => t.status !== "void");
}

/** Same calendar day in Manila and in the evening: "Tonight". Otherwise "Today" or "Tomorrow". */
function dayWord(d: Date, now: number) {
  const day = (x: Date) => fmtDate(x, "yyyy-MM-dd");
  if (day(d) === day(new Date(now))) return Number(fmtDate(d, "H")) >= 17 ? "Tonight" : "Today";
  if (day(d) === day(new Date(now + 864e5))) return "Tomorrow";
  return fmtDate(d, "EEE, MMM d");
}

/** The event within 18 hours, as a night pass with the QR one tap away. */
function TonightPass({ b, me, now }: { b: B; me: string; now: number }) {
  const ev = b.event;
  const live = b.tickets.filter((t) => t.status !== "void");
  const mine = live.find((t) => t.holderName === me && t.status === "valid") ?? live.find((t) => t.status === "valid") ?? live[0];
  const others = live.filter((t) => t.id !== mine.id);
  const started = ev.startsAt.getTime() <= now;
  const tiers = [...new Set(live.map((t) => t.tier.name))].join(", ");
  return (
    // Always night: the pass is the one thing you open under the stars
    <div className="dark relative overflow-hidden rounded-3xl bg-[linear-gradient(#0b161a,#132f3a)] text-foreground shadow-[0_16px_40px_rgba(11,61,46,0.25)] ring-1 ring-white/10">
      {/* Ridges kept low behind the buttons; the top of the scene fades into the card's sky */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[150px] [mask-image:linear-gradient(to_bottom,transparent,black_45%)]">
        <Skyline variant="night" size="card" seed={ev.slug} className="absolute inset-0" />
      </div>
      <div className="relative flex flex-col gap-2.5 px-[18px] pt-[18px] pb-4">
        <div className="flex items-center justify-between gap-2">
          <span className="bbc-eyebrow text-star">
            {started ? "Happening now" : <CountdownText to={ev.startsAt.toISOString()} prefix="Doors in " done="Doors open" />}
          </span>
          <StatusBadge status="approved" />
        </div>
        <Link href={`/events/${ev.slug}`} className="max-w-[300px] font-display text-[26px] leading-[1.02] font-extrabold tracking-tight text-white hover:underline">{ev.title}</Link>
        <p className="text-[13px] text-[#cfe0d6]">
          {dayWord(ev.startsAt, now)} {fmtTime(ev.startsAt)} · {ev.venueName}
          {ev.mapUrl && (
            <>
              {" · "}
              <a href={ev.mapUrl} target="_blank" rel="noreferrer" className="font-semibold text-accent-foreground hover:underline">Map ↗</a>
            </>
          )}
        </p>
        <div className="mt-2 flex gap-2">
          <Button asChild variant="sun" size="lg" className="h-[50px] min-w-0 flex-1 text-[15px] font-semibold sm:max-w-80 md:h-[50px]">
            <Link href={`/tickets/${mine.id}`}><QrCode className="size-5" /> {mine.status === "used" ? "My ticket" : "Show my QR"}</Link>
          </Button>
          {others.slice(0, 2).map((t, i) => (
            <Button key={t.id} asChild variant="glass" size="lg" className="h-[50px] max-w-[38%] px-4 text-[13px] font-semibold md:h-[50px]">
              <Link href={`/tickets/${t.id}`} aria-label={`Open ${t.holderName}'s ticket`}>
                <span className="truncate">{t.holderName === mine.holderName ? `Ticket ${i + 2}` : `${firstName(t.holderName)}'s`}</span>
              </Link>
            </Button>
          ))}
        </div>
        <p className="text-center text-[11px] text-muted-foreground">
          {live.length} ticket{live.length === 1 ? "" : "s"} · {tiers} · {live.map((t) => t.shortCode).join(", ")}
          {others.length > 2 && <> · <Link href={`/bookings/${b.id}`} className="underline">all tickets</Link></>}
        </p>
      </div>
    </div>
  );
}

function BookingBlock({ b, now }: { b: B; now: number }) {
  const status = b.event.status === "cancelled" ? "cancelled" : effectiveStatus(b);
  const showTickets = b.status === "approved" && b.tickets.length > 0 && b.event.status !== "cancelled";
  const owing = status === "pending_payment" || status === "rejected";
  return (
    <section
      aria-label={b.event.title}
      className={cn("space-y-2.5 rounded-[20px] border bg-card p-3.5", status === "pending_payment" && "border-warning", status === "rejected" && "border-destructive/50")}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <Link href={`/events/${b.event.slug}`} className="font-display text-[17px] leading-tight font-bold tracking-tight hover:underline">{b.event.title}</Link>
          <p className="mt-0.5 text-xs text-muted-foreground">{fmtDate(b.event.startsAt, "EEE, MMM d")} · {fmtTime(b.event.startsAt)} · {b.event.venueName}</p>
        </div>
        <StatusBadge status={status} className="shrink-0" />
      </div>
      {showTickets ? (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {b.tickets.map((t) => <TicketCard key={t.id} ticket={{ id: t.id, shortCode: t.shortCode, holderName: t.holderName, status: t.status, tierName: t.tier.name }} />)}
          </div>
          {b.tickets.length > 1 && (
            <div className="flex justify-end">
              <Link href={`/bookings/${b.id}`} className="inline-flex min-h-9 items-center gap-0.5 rounded-full px-2 text-xs font-semibold text-muted-foreground hover:text-foreground">Manage guests <ChevronRight className="size-3.5" /></Link>
            </div>
          )}
        </>
      ) : owing ? (
        <div className="flex items-center justify-between gap-2.5 text-[13px]">
          <div className="min-w-0 text-muted-foreground">
            {b.items.map((i) => `${i.quantity} × ${i.tier.name}`).join(", ")} · <span className="font-semibold text-foreground">{peso(b.totalCents)}</span>
            <br />
            <span className="text-xs">
              {status === "rejected" ? "Fix it" : "Hold ends"}
              {b.expiresAt ? ` ${status === "rejected" ? "within" : "in"} ${fmtLeft(b.expiresAt.getTime() - now)}` : " soon"}
            </span>
          </div>
          <Button asChild className="h-10 shrink-0 rounded-full px-4 text-[13px] font-semibold md:h-10">
            <Link href={`/bookings/${b.id}`}>{status === "pending_payment" ? "Pay now" : "Fix payment"}</Link>
          </Button>
        </div>
      ) : (
        <div className="flex items-end justify-between gap-2.5">
          <p className="min-w-0 text-[13px] text-muted-foreground">
            {b.items.map((i) => `${i.quantity} × ${i.tier.name}`).join(", ")} · {peso(b.totalCents)}
            {bookingStatusCopy(status) ? ` · ${bookingStatusCopy(status)}` : ""}
          </p>
          <Link href={`/bookings/${b.id}`} className="inline-flex min-h-9 shrink-0 items-center gap-0.5 rounded-full px-2 text-xs font-semibold text-muted-foreground hover:text-foreground">Details <ChevronRight className="size-3.5" /></Link>
        </div>
      )}
    </section>
  );
}

function PastRow({ b }: { b: B }) {
  const status = b.event.status === "cancelled" ? "cancelled" : effectiveStatus(b);
  const n = b.tickets.length || b.items.reduce((s, i) => s + i.quantity, 0);
  const went = b.tickets.some((t) => t.status === "used");
  const why = b.event.status === "cancelled" ? "event cancelled" : status === "expired" ? "hold expired" : status === "cancelled" ? "cancelled" : went ? "checked in" : null;
  return (
    <Link href={`/bookings/${b.id}`} className="flex items-center justify-between gap-2.5 rounded-[20px] border bg-card px-3.5 py-3 opacity-70 transition-opacity hover:opacity-100">
      <div className="min-w-0">
        <p className="truncate font-display text-[15px] font-bold tracking-tight">{b.event.title}</p>
        <p className="text-xs text-muted-foreground">{fmtDate(b.event.startsAt, "MMM d")} · {n} ticket{n === 1 ? "" : "s"}{why ? ` · ${why}` : ""}</p>
      </div>
      {went ? (
        <Badge variant="muted" className="h-auto shrink-0 gap-1.5 px-2.5 py-1 font-semibold"><Check className="size-3 stroke-[2.5]" aria-hidden />Went</Badge>
      ) : (
        <StatusBadge status={status} className="shrink-0" />
      )}
    </Link>
  );
}
