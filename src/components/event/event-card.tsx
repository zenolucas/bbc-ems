import Image from "next/image";
import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { Skyline } from "@/components/brand/skyline";
import type { Event, TicketTier } from "@/db/schema";
import { fmtDate, fmtTime, peso } from "@/lib/format";
import { cn } from "@/lib/utils";

type Availability = "sold-out" | "few-left" | "available" | "not-on-sale";

const availabilityChip: Partial<Record<Availability, { label: string; cls: string }>> = {
  "sold-out": { label: "Sold out", cls: "bg-foreground/85 text-background" },
  "few-left": { label: "Few left", cls: "bg-sun text-deep-forest" },
  "not-on-sale": { label: "Sales not open", cls: "bg-background/90 text-foreground" },
};

export function EventCard({ event, past }: { event: Event & { tiers: TicketTier[]; availability?: Availability }; past?: boolean }) {
  const priceLabel = priceSummary(event.tiers);
  const chip = !past && event.status !== "cancelled" && event.availability ? availabilityChip[event.availability] : undefined;
  return (
    <Link href={`/events/${event.slug}`} className={cn("group overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-lg", past && "opacity-75")}>
      <div className="relative aspect-[4/3] overflow-hidden">
        {event.coverImageUrl ? (
          <Image src={event.coverImageUrl} alt="" fill unoptimized className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <Skyline variant="auto" size="card" seed={event.slug} className="absolute inset-0" />
        )}
        <div className="absolute left-3 top-3 rounded-lg bg-background/90 px-2.5 py-1.5 text-center shadow backdrop-blur">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{fmtDate(event.startsAt, "MMM")}</div>
          <div className="-mt-0.5 text-lg font-bold leading-none">{fmtDate(event.startsAt, "d")}</div>
        </div>
        {event.status === "cancelled" && <span className="absolute right-3 top-3 rounded-md bg-destructive px-2 py-1 text-xs font-semibold text-white">Cancelled</span>}
        {chip && <span className={cn("absolute right-3 top-3 rounded-md px-2 py-1 text-xs font-semibold shadow", chip.cls)}>{chip.label}</span>}
      </div>
      <div className="space-y-2 p-4">
        <h3 className="line-clamp-2 text-lg font-semibold leading-tight tracking-tight">{event.title}</h3>
        {event.tagline && <p className="line-clamp-1 text-sm text-muted-foreground">{event.tagline}</p>}
        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5"><CalendarDays className="size-4" />{fmtDate(event.startsAt, "EEE, MMM d")} · {fmtTime(event.startsAt)}</span>
          <span className="flex items-center gap-1.5"><MapPin className="size-4" />{event.venueName}</span>
        </div>
        <div className="pt-1 text-sm font-medium text-primary">{priceLabel}</div>
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
