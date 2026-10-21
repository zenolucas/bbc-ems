import "server-only";
import type { BookingDTO, EventDetailDTO, EventRefDTO, EventSummaryDTO, MeDTO, Role, TicketDTO, TierDTO } from "@bbc/shared/api-types";
import type { bookings, events, ticketTiers, tickets, users } from "@/db/schema";
import { effectiveStatus } from "@/lib/bookings";
import { tierIsOnSale } from "@/lib/events";
import { tokenFor, urlFor } from "@/lib/tickets/server";
import { iso } from "./respond";

type Event = typeof events.$inferSelect;
type Tier = typeof ticketTiers.$inferSelect;
type Ticket = typeof tickets.$inferSelect;
type Booking = typeof bookings.$inferSelect;

export function meDTO(u: Pick<typeof users.$inferSelect, "id" | "email" | "name"> & { role?: string | null }): MeDTO {
  return { id: u.id, email: u.email, name: u.name, role: (u.role ?? "member") as Role };
}

export function eventRefDTO(e: Event): EventRefDTO {
  return {
    id: e.id,
    slug: e.slug,
    title: e.title,
    startsAt: e.startsAt.toISOString(),
    endsAt: iso(e.endsAt),
    venueName: e.venueName,
    coverImageUrl: e.coverImageUrl,
  };
}

function priceFrom(tiers: Pick<Tier, "priceCents">[]) {
  if (tiers.length === 0) return null;
  const paid = tiers.filter((t) => t.priceCents > 0).map((t) => t.priceCents);
  return paid.length ? Math.min(...paid) : 0;
}

export function eventSummaryDTO(
  e: Event & { tiers: Tier[]; availability?: EventSummaryDTO["availability"]; remaining?: number; capacity?: number },
): EventSummaryDTO {
  return {
    ...eventRefDTO(e),
    tagline: e.tagline,
    category: e.category,
    status: e.status,
    priceFromCents: priceFrom(e.tiers),
    availability: e.availability ?? null,
    remaining: e.remaining ?? null,
    capacity: e.capacity ?? null,
  };
}

export function tierDTO(t: Tier, remaining: number, now = new Date()): TierDTO {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    priceCents: t.priceCents,
    perOrderLimit: t.perOrderLimit,
    onSale: tierIsOnSale(t, now),
    remaining,
    salesStart: iso(t.salesStart),
    salesEnd: iso(t.salesEnd),
  };
}

export function eventDetailDTO(
  e: Event & { tiers: Tier[] },
  avail: (t: Tier) => { remaining: number },
  myBooking: Pick<Booking, "id" | "status" | "expiresAt"> | null,
  onWaitlist = false,
): EventDetailDTO {
  const now = new Date();
  const tiers = e.tiers.map((t) => tierDTO(t, avail(t).remaining, now));
  const open = tiers.filter((t) => t.onSale);
  const remaining = open.reduce((n, t) => n + t.remaining, 0);
  return {
    ...eventSummaryDTO(e),
    availability: tiers.length > 0 && open.length === 0 ? "not-on-sale" : remaining === 0 ? "sold-out" : remaining <= 10 ? "few-left" : "available",
    remaining,
    capacity: e.tiers.filter((t) => tierIsOnSale(t, now)).reduce((n, t) => n + t.quantity, 0),
    descriptionMd: e.descriptionMd,
    venueAddress: e.venueAddress,
    mapUrl: e.mapUrl,
    tiers,
    holdHours: e.bookingHoldHours,
    hasPaymentDetails: Boolean(e.gcashNumber || e.gcashQrUrl),
    myBooking: myBooking ? { id: myBooking.id, status: effectiveStatus(myBooking) } : null,
    onWaitlist,
  };
}

export function ticketDTO(t: Ticket & { tier: Tier }, event: Event): TicketDTO {
  return {
    id: t.id,
    bookingId: t.bookingId,
    shortCode: t.shortCode,
    holderName: t.holderName,
    tierName: t.tier.name,
    status: t.status,
    checkedInAt: iso(t.checkedInAt),
    qrUrl: urlFor(t),
    token: tokenFor(t),
    pngPath: `/api/tickets/${t.id}/png`,
    ticketStyle: event.ticketStyle,
    event: eventRefDTO(event),
  };
}

export function bookingDTO(b: Booking & { event: Event; items: { tierId: string; quantity: number; unitPriceCents: number; tier: Tier }[]; tickets: (Ticket & { tier: Tier })[] }): BookingDTO {
  return {
    id: b.id,
    status: effectiveStatus(b),
    totalCents: b.totalCents,
    expiresAt: iso(b.expiresAt),
    paymentRef: b.paymentRef,
    paymentProofUrl: b.paymentProofUrl,
    submittedAt: iso(b.submittedAt),
    reviewNote: b.reviewNote,
    createdAt: b.createdAt.toISOString(),
    event: { ...eventRefDTO(b.event), status: b.event.status },
    payment: {
      gcashName: b.event.gcashName,
      gcashNumber: b.event.gcashNumber,
      gcashQrUrl: b.event.gcashQrUrl,
      instructions: b.event.paymentInstructions,
      holdHours: b.event.bookingHoldHours,
    },
    items: b.items.map((i) => ({ tierId: i.tierId, tierName: i.tier.name, quantity: i.quantity, unitPriceCents: i.unitPriceCents })),
    tickets: b.tickets.map((t) => ticketDTO(t, b.event)),
  };
}
