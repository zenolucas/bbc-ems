/**
 * Response shapes for /api/v1. Dates are ISO strings, money is integer centavos.
 * Bump the route prefix (v2) rather than changing a field's meaning: installed
 * app versions keep calling the old shape for months.
 */

export type Role = "member" | "staff" | "admin";

export type BookingStatus = "pending_payment" | "under_review" | "approved" | "rejected" | "expired" | "cancelled";
export type TicketStatus = "valid" | "used" | "void";
export type Availability = "sold-out" | "few-left" | "available" | "not-on-sale";
/** Home page filters: All / Gigs / Outdoors / Free ("Free" comes from priceFromCents === 0). */
export type EventCategory = "gig" | "outdoors" | "other";
export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = { gig: "Gigs", outdoors: "Outdoors", other: "Other" };

export type ApiError = { error: string };

export type MeDTO = {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** Only from GET /api/v1/me, and only when the site offers Discord linking. */
  discord?: { linked: boolean };
};

export type EventRefDTO = {
  id: string;
  slug: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  venueName: string;
  coverImageUrl: string | null;
};

export type EventSummaryDTO = EventRefDTO & {
  tagline: string | null;
  category: EventCategory;
  status: "draft" | "published" | "cancelled" | "ended";
  /** Lowest paid price, or 0 when every tier is free; null with no tiers. */
  priceFromCents: number | null;
  /** Upcoming events only. */
  availability: Availability | null;
  remaining: number | null;
  capacity: number | null;
};

export type TierDTO = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  perOrderLimit: number;
  onSale: boolean;
  remaining: number;
  salesStart: string | null;
  salesEnd: string | null;
};

export type PaymentDetailsDTO = {
  gcashName: string | null;
  gcashNumber: string | null;
  gcashQrUrl: string | null;
  instructions: string | null;
  holdHours: number;
};

export type EventDetailDTO = EventSummaryDTO & {
  descriptionMd: string;
  venueAddress: string | null;
  mapUrl: string | null;
  tiers: TierDTO[];
  /** How long a paid booking is held while the member pays. */
  holdHours: number;
  /** Whether the organiser has added GCash/Maya details yet. */
  hasPaymentDetails: boolean;
  /** The signed-in member's live booking for this event, if any. */
  myBooking: { id: string; status: BookingStatus } | null;
  /** Signed in and waiting to hear when seats free up (only offered while sold out). */
  onWaitlist: boolean;
};

export type EventsDTO = { upcoming: EventSummaryDTO[]; past: EventSummaryDTO[] };

export type TicketDTO = {
  id: string;
  bookingId: string;
  shortCode: string;
  holderName: string;
  tierName: string;
  status: TicketStatus;
  checkedInAt: string | null;
  /** What the QR encodes: the full /t/<token> URL. */
  qrUrl: string;
  token: string;
  /** Path of the rendered PNG; add ?theme=dark for the night render. */
  pngPath: string;
  /** The event's ticket design. "trail-pass" is landscape, so its QR is small on phones. */
  ticketStyle: string;
  event: EventRefDTO;
};

export type BookingDTO = {
  id: string;
  /** Effective status: overdue holds already read as "expired". */
  status: BookingStatus;
  totalCents: number;
  expiresAt: string | null;
  paymentRef: string | null;
  paymentProofUrl: string | null;
  submittedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  event: EventRefDTO & { status: EventSummaryDTO["status"] };
  payment: PaymentDetailsDTO;
  items: { tierId: string; tierName: string; quantity: number; unitPriceCents: number }[];
  tickets: TicketDTO[];
};

export type DoorEventDTO = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  venue: string;
  total: number;
  used: number;
  live: boolean;
  ended: boolean;
};
