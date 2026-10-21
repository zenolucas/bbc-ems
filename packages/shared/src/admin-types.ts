import { peso } from "./format";
import type { EventRefDTO } from "./api-types";

/** Organiser-only shapes for /api/v1/admin. Same conventions as api-types.ts. */

export type ReviewHintsDTO = {
  /** "First booking with us" / "3rd booking with us". */
  history: string;
  /** null when there's no reference; ok:false means the same reference is on another booking. */
  refCheck: { ok: boolean; text: string } | null;
};

export type ReviewItemDTO = {
  id: string;
  event: EventRefDTO;
  userName: string;
  userEmail: string;
  items: { tierName: string; quantity: number; unitPriceCents: number }[];
  totalCents: number;
  paymentRef: string | null;
  paymentProofUrl: string | null;
  submittedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
  hints: ReviewHintsDTO;
  /** Other bookings by the same member (not counting expired ones). */
  otherBookings: number;
};

export type ReviewQueueDTO = { items: ReviewItemDTO[] };

export type ApproveResultDTO = { ok: true; emailSent: boolean };

/** Quick reject notes, shared by the web review list and the app so the wording matches. */
export const REJECT_REASONS: { label: string; short: string; text: (totalCents: number) => string }[] = [
  { label: "Wrong amount", short: "Wrong amount", text: (cents) => `The amount received doesn't match ${peso(cents)}. Please send the difference and upload the new receipt.` },
  { label: "Unreadable receipt", short: "Unreadable", text: () => "We can't read the receipt. Please upload a clearer screenshot that shows the amount and reference number." },
  { label: "Reference not found", short: "Ref not found", text: () => "We couldn't find this reference number in our GCash/Maya history. Please double-check it and resubmit." },
  { label: "Duplicate", short: "Duplicate", text: () => "This receipt was already used for another booking. Please upload the receipt for this payment." },
];
