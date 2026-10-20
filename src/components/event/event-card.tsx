import Image from "next/image";
import Link from "next/link";
import { CalendarDays, ChevronRight, MapPin } from "lucide-react";
import { Skyline } from "@/components/brand/skyline";
import { Stamp } from "@/components/brand/stamp";
import { Badge } from "@/components/ui/badge";
import type { Event, TicketTier } from "@/db/schema";
import { fmtDate, fmtTime, peso } from "@/lib/format";
import { seeded } from "@/lib/seeded";
import { cn } from "@/lib/utils";

export type Availability = "sold-out" | "few-left" | "available" | "not-on-sale";
export type CardEvent = Event & { tiers: TicketTier[]; availability?: Availability; remaining?: number; capacity?: number };

/** What a card has to say about an event, in priority order. */
export type CardState = "past" | "cancelled" | "sold-out" | "not-on-sale" | "few-left" | "open";

export function cardState(event: CardEvent, past?: boolean): CardState {
  if (past) return "past";
  if (event.status === "cancelled") return "cancelled";
  if (event.availability === "sold-out") return "sold-out";
  if (event.availability === "not-on-sale") return "not-on-sale";
  if (event.availability === "few-left") return "few-left";
  return "open";
}

/**
 * The poster, or a skyline seeded by the slug so every poster-less event gets its
 * own sky (and half of them face the other way). Pass a distinct `seed` when the
 * same event is drawn twice on a page (phone row + desktop card): the moon's mask
 * id comes from the seed, and a duplicate id inside a hidden copy breaks it.
 */
export function EventPoster({
  event,
  seed = event.slug,
  className,
  priority,
}: {
  event: Pick<Event, "slug" | "coverImageUrl">;
  seed?: string;
  className?: string;
  priority?: boolean;
}) {
  if (event.coverImageUrl) return <Image src={event.coverImageUrl} alt="" fill unoptimized priority={priority} className={cn("object-cover", className)} />;
  return (
    <div className={cn("absolute inset-0", className)}>
      <Skyline variant="auto" size="card" seed={seed} className={cn("absolute inset-0", seeded(event.slug)() < 0.5 && "-scale-x-100")} />
    </div>
  );
}

const tabSizes = {
  sm: ["rounded-lg px-[7px] py-1", "text-[8px]", "text-base"],
  md: ["rounded-[10px] px-[9px] py-[5px]", "text-[9px]", "text-xl"],
  lg: ["rounded-xl px-2.5 py-1.5", "text-[9px]", "text-[22px]"],
  xl: ["rounded-[14px] px-3 py-2", "text-[10px]", "text-[28px]"],
} as const;

/** The "trail marker" date tab pinned to a poster's top-left corner. Decorative: the date is always in the text too. */
export function DateTab({ date, size = "md", className }: { date: Date; size?: keyof typeof tabSizes; className?: string }) {
  const [box, month, day] = tabSizes[size];
  return (
    <div aria-hidden className={cn("bg-background text-center leading-none text-foreground shadow-[0_2px_8px_rgb(0_0_0/0.2)] dark:bg-card", box, className)}>
      <div className={cn("bbc-eyebrow text-muted-foreground", month)}>{fmtDate(date, "MMM")}</div>
      <div className={cn("font-display font-extrabold", day)}>{fmtDate(date, "d")}</div>
    </div>
  );
}

/** The earliest future sales start among the tiers, for "Opens Oct 25". */
export function nextSaleStart(tiers: { salesStart: Date | null }[], now = new Date()) {
  return tiers
    .map((t) => t.salesStart)
    .filter((d): d is Date => !!d && d > now)
    .sort((a, b) => a.getTime() - b.getTime())[0];
}

/** Top-right chip on a poster. Sold out gets a stamp instead, see <PosterOverlay>. */
export function AvailabilityChip({ state, opens, className }: { state: CardState; opens?: Date; className?: string }) {
  const base = "h-auto px-2.5 py-[5px] text-xs font-bold";
  if (state === "cancelled") return <Badge className={cn(base, "bg-destructive text-white dark:text-deep-forest", className)}>Cancelled</Badge>;
  if (state === "few-left") return <Badge variant="sun" className={cn(base, className)}>Few left</Badge>;
  if (state === "not-on-sale")
    return <Badge variant="outline" className={cn(base, "bg-card", className)}>{opens ? `Opens ${fmtDate(opens, "MMM d")}` : "Sales closed"}</Badge>;
  return null;
}

/** Dims the poster and stamps it when nobody can buy in any more. Thumbs (`sm`) are too small to stamp: the row's note says it. */
function PosterOverlay({ state, size = "md" }: { state: CardState; size?: "sm" | "md" }) {
  if (state !== "sold-out" && state !== "cancelled") return null;
  return (
    <>
      <div aria-hidden className={cn("absolute inset-0 bg-midnight/50", state === "cancelled" && "backdrop-grayscale")} />
      {state === "sold-out" && size === "md" && (
        <Stamp tone="inverse" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-5 py-2 text-[15px]">
          Sold out
        </Stamp>
      )}
    </>
  );
}

/** "from ₱250" pieces: the lowest paid price, or Free when every tier is free. */
function lowestPrice(tiers: { priceCents: number }[]) {
  const paid = tiers.filter((t) => t.priceCents > 0).map((t) => t.priceCents);
  if (tiers.length === 0) return null;
  if (paid.length === 0) return { from: false, label: "Free" };
  return { from: paid.length < tiers.length || new Set(paid).size > 1, label: peso(Math.min(...paid)) };
}

/** The tear-off strip's left-hand line: what's left, when sales open, or why you can't buy. */
function stripNote(event: CardEvent, state: CardState) {
  switch (state) {
    case "past":
      return "Event has ended";
    case "cancelled":
      return "Tickets voided";
    case "sold-out":
      return "No tickets left";
    case "not-on-sale": {
      const opens = nextSaleStart(event.tiers);
      return opens ? `Tickets from ${fmtDate(opens, "MMM d")}` : "Sales closed";
    }
    default:
      if (event.remaining != null && event.capacity && (state === "few-left" || event.tiers.every((t) => t.priceCents === 0)))
        return `${event.remaining} of ${event.capacity} spots left`;
      return null;
  }
}

function metaLine(event: Event) {
  return `${fmtDate(event.startsAt, "EEE, MMM d")} · ${fmtTime(event.startsAt)} · ${event.venueName}`;
}

/**
 * The event as a ticket stub you can tap: date tab, availability chip, title on
 * two lines, and a perforated tear-off strip carrying the price. The notches sit
 * on the perforation, measured from the bottom so titles can wrap freely.
 */
export function EventCard({ event, past }: { event: CardEvent; past?: boolean }) {
  const state = cardState(event, past);
  const price = lowestPrice(event.tiers);
  const note = stripNote(event, state);
  const struck = state === "cancelled" || state === "sold-out";
  const bookable = state === "open" || state === "few-left";
  return (
    <Link
      href={`/events/${event.slug}`}
      className={cn(
        "group bbc-stub block h-full rounded-[20px] outline-none transition-transform duration-200 ease-out [--stub-notch:calc(100%-46px)] hover:-translate-y-1 focus-visible:-translate-y-1",
        past && "opacity-75",
      )}
    >
      <div className="flex h-full flex-col overflow-hidden rounded-[20px] border bg-card text-card-foreground transition-shadow duration-200 group-hover:shadow-[0_18px_40px_rgb(11_61_46/0.18)] group-focus-visible:ring-3 group-focus-visible:ring-ring/60 dark:group-hover:shadow-[0_18px_40px_rgb(0_0_0/0.45)]">
        <div className="relative h-[170px] shrink-0 overflow-hidden">
          <EventPoster event={event} className="transition-transform duration-500 ease-out group-hover:scale-[1.03]" />
          <PosterOverlay state={state} />
          <DateTab date={event.startsAt} className={cn("absolute top-2.5 left-2.5", struck && "opacity-80")} />
          <AvailabilityChip state={state} opens={nextSaleStart(event.tiers)} className="absolute top-2.5 right-2.5" />
        </div>
        <div className="flex flex-1 flex-col gap-[5px] px-3.5 pt-3 pb-2.5">
          <h3 className={cn("line-clamp-2 text-[17px] leading-[1.15] font-bold", struck && "text-muted-foreground", state === "cancelled" && "line-through")}>{event.title}</h3>
          {event.tagline && <p className="line-clamp-1 text-xs text-muted-foreground">{event.tagline}</p>}
          <p className="line-clamp-1 text-xs text-muted-foreground">{metaLine(event)}</p>
        </div>
        <div className="bbc-perforation flex h-11 shrink-0 items-center justify-between gap-3 px-3.5">
          <span className={cn("min-w-0 truncate text-xs", state === "cancelled" ? "font-semibold text-destructive" : "text-muted-foreground")}>
            {note ?? (price?.from ? "from" : event.tiers.length === 1 ? event.tiers[0].name : "")}
            {bookable && !note && price?.from && <span className="opacity-0 transition-opacity group-hover:opacity-100"> {price.label}</span>}
          </span>
          {price && state !== "past" && (
            <span className="relative flex shrink-0 items-center justify-end">
              <span
                className={cn(
                  "font-display text-[17px] font-extrabold",
                  struck ? "text-muted-foreground line-through" : "text-primary",
                  bookable && "transition-opacity group-hover:opacity-0",
                )}
              >
                {price.label}
              </span>
              {/* hover/focus: the price makes way for the action */}
              {bookable && (
                <span aria-hidden className="absolute right-0 inline-flex h-8 items-center rounded-full bg-primary px-3.5 text-[13px] font-bold whitespace-nowrap text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  Book tickets
                </span>
              )}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

/** Phone list row for "Coming up": square thumb with the date tab, title, price and what's left. */
export function EventRow({ event }: { event: CardEvent }) {
  const state = cardState(event);
  const price = lowestPrice(event.tiers);
  const note = stripNote(event, state);
  const struck = state === "cancelled" || state === "sold-out";
  return (
    <Link
      href={`/events/${event.slug}`}
      className="group flex items-center gap-3 rounded-[18px] border bg-card p-2.5 text-card-foreground outline-none transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/60"
    >
      <div className="relative size-[92px] shrink-0 overflow-hidden rounded-xl">
        <EventPoster event={event} seed={`${event.slug}-row`} />
        <PosterOverlay state={state} size="sm" />
        <DateTab date={event.startsAt} size="sm" className="absolute top-1.5 left-1.5" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <h3 className={cn("line-clamp-2 text-[17px] leading-[1.1] font-bold", struck && "text-muted-foreground", state === "cancelled" && "line-through")}>{event.title}</h3>
        <p className="line-clamp-2 text-xs text-muted-foreground">{metaLine(event)}</p>
        <div className="mt-1 flex min-w-0 items-baseline gap-2">
          {price && <span className={cn("shrink-0 font-display text-[15px] font-extrabold", struck ? "text-muted-foreground line-through" : "text-primary")}>{price.label}</span>}
          {note && <span className={cn("truncate text-[11px]", state === "cancelled" ? "font-semibold text-destructive" : state === "few-left" ? "font-semibold text-warning-foreground" : "text-muted-foreground")}>· {note}</span>}
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

/** Compact card for the past-events rail. The parent sets the opacity rule (75%). */
export function PastEventCard({ event }: { event: CardEvent }) {
  return (
    <Link
      href={`/events/${event.slug}`}
      className="group block overflow-hidden rounded-2xl border bg-card text-card-foreground outline-none transition-opacity focus-visible:ring-3 focus-visible:ring-ring/60"
    >
      <div className="relative h-20 overflow-hidden sm:h-[90px]">
        <EventPoster event={event} seed={`${event.slug}-past`} className="transition-transform duration-500 group-hover:scale-[1.03]" />
      </div>
      <div className="px-3 py-2.5">
        <h3 className="line-clamp-2 text-sm leading-[1.15] font-bold sm:text-[15px]">{event.title}</h3>
        <p className="mt-[3px] truncate text-[11px] text-muted-foreground sm:text-xs">
          {fmtDate(event.startsAt, "MMM d")} · {event.venueName}
        </p>
      </div>
    </Link>
  );
}

/**
 * Real holes for the stub notches, for a card sitting on an illustration where
 * no single `--stub-bg` colour would match what shows through. Two radial
 * gradients cut a 9px circle at each edge of the perforation; the shadow comes
 * from a drop-shadow filter on the parent so it follows the cut-outs.
 */
const notchHoles =
  "radial-gradient(circle at left calc(100% - 65px), transparent 9px, #000 9.5px), radial-gradient(circle at right calc(100% - 65px), transparent 9px, #000 9.5px)";
const notchMask: React.CSSProperties = {
  maskImage: notchHoles,
  WebkitMaskImage: notchHoles,
  maskComposite: "intersect",
  WebkitMaskComposite: "source-in",
};

/**
 * The big "Up next" stub. `section` is the phone/tablet block under the hero;
 * `hero` rides the ridge at the hero's right on desktop, so its notches are
 * real cut-outs that show the skyline through (see `notchMask`).
 */
export function UpNextCard({ event, when, variant = "section" }: { event: CardEvent; when: string; variant?: "section" | "hero" }) {
  const state = cardState(event);
  const price = lowestPrice(event.tiers);
  const bookable = state === "open" || state === "few-left";
  const struck = state === "cancelled" || state === "sold-out";
  const hero = variant === "hero";
  return (
    <Link
      href={`/events/${event.slug}`}
      className={cn(
        "group block rounded-[22px] outline-none transition-transform duration-200 ease-out hover:-translate-y-1 focus-visible:-translate-y-1",
        hero
          ? "drop-shadow-[0_24px_30px_rgb(11_61_46/0.3)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring/60 dark:drop-shadow-[0_24px_30px_rgb(0_0_0/0.5)]"
          : "bbc-stub [--stub-notch:calc(100%-65px)]",
      )}
    >
      <div
        style={hero ? notchMask : undefined}
        className={cn(
          "overflow-hidden rounded-[22px] border bg-card text-card-foreground transition-shadow",
          !hero && "group-hover:shadow-lg group-focus-visible:ring-3 group-focus-visible:ring-ring/60",
        )}
      >
        <div className="relative h-[200px] overflow-hidden">
          <EventPoster event={event} seed={`${event.slug}-${variant}`} priority className="transition-transform duration-500 ease-out group-hover:scale-[1.03]" />
          <PosterOverlay state={state} />
          <DateTab date={event.startsAt} size="lg" className="absolute top-3 left-3" />
          <AvailabilityChip state={state} opens={nextSaleStart(event.tiers)} className="absolute top-3 right-3" />
        </div>
        <div className={cn("flex flex-col px-4 pt-4 pb-3.5", hero ? "gap-1.5" : "gap-2")}>
          {hero && (
            <div className="flex items-center justify-between">
              <span className="bbc-eyebrow text-primary">Up next</span>
              <span className="text-xs font-semibold text-primary">{when}</span>
            </div>
          )}
          <h3 className={cn("leading-[1.05] font-extrabold", hero ? "text-[22px]" : "text-2xl", state === "cancelled" && "text-muted-foreground line-through")}>{event.title}</h3>
          {hero ? (
            <p className="line-clamp-1 text-[13px] text-muted-foreground">{metaLine(event)}</p>
          ) : (
            <>
              {event.tagline && <p className="text-sm text-muted-foreground">{event.tagline}</p>}
              <div className="mt-0.5 flex flex-col gap-[5px] text-[13px] text-muted-foreground">
                <span className="flex items-center gap-2">
                  <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden />
                  {fmtDate(event.startsAt, "EEE, MMM d")} · {fmtTime(event.startsAt)}
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  <MapPin className="size-4 shrink-0 text-primary" aria-hidden />
                  <span className="truncate">{event.venueName}</span>
                </span>
              </div>
            </>
          )}
        </div>
        <div className="bbc-perforation flex h-16 items-center justify-between gap-3 px-4">
          {price ? (
            <div className="flex min-w-0 items-baseline gap-1.5">
              {price.from && <span className="text-xs text-muted-foreground">from</span>}
              <span className={cn("font-display text-xl font-extrabold", struck ? "text-muted-foreground line-through" : "text-primary")}>{price.label}</span>
            </div>
          ) : (
            <span />
          )}
          <span
            className={cn(
              "inline-flex h-10 shrink-0 items-center rounded-full px-[18px] text-sm font-semibold transition-colors",
              bookable ? "bg-primary text-primary-foreground group-hover:bg-primary/85" : "border bg-background text-foreground",
            )}
          >
            {bookable ? "Book tickets" : "See details"}
          </span>
        </div>
      </div>
    </Link>
  );
}

/** "Free" when every tier is free, otherwise the lowest paid price. */
export function priceSummary(tiers: { priceCents: number }[]) {
  const paid = tiers.filter((t) => t.priceCents > 0).map((t) => t.priceCents);
  if (tiers.length === 0) return "";
  if (paid.length === 0) return "Free";
  return `from ${peso(Math.min(...paid))}`;
}
