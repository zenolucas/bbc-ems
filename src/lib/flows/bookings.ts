import "server-only";
import { isDemoReceipt } from "@bbc/shared/demo";
import type { BookInput, PayInput } from "@bbc/shared/schemas";
import { approveBooking, BookingError, cancelBooking, createBooking, getBookingForUser, renameTicket, submitPayment } from "@/lib/bookings";
import { getDemoState } from "@/lib/demo/flag";
import { PERSONAS } from "@/lib/demo/personas";
import { notifyApproved, notifyBookingCancelled, notifyLater, notifyPaymentSubmitted, notifyReserved } from "@/lib/notifications";
import { notifyWaitlist } from "@/lib/waitlist";

/**
 * Member booking steps with their side effects (emails, pushes). The web's
 * Server Actions and the app's /api/v1 routes both call these, so the two can't
 * drift: each caller only adds its own input parsing and cache revalidation.
 */

export async function bookFlow(userId: string, input: BookInput) {
  const result = await createBooking(userId, input);
  // Free: tickets are issued now, so send them. Paid: send the hold + payment details,
  // so a member who closes the tab still has the link and the deadline.
  const bookingId = result.id;
  if (result.free) notifyLater("approved (free)", () => notifyApproved(bookingId));
  else notifyLater("reserved", () => notifyReserved(bookingId));
  return result;
}

/** `autoApproved`: demo mode's auto-approve switch confirmed it on the spot, tickets and all. */
export async function submitPaymentFlow(userId: string, bookingId: string, input: PayInput) {
  const demo = await getDemoState();
  // The bundled sample receipts are a demo shortcut; anywhere else a real screenshot is required
  if (isDemoReceipt(input.paymentProofUrl) && !demo.enabled) throw new BookingError("Upload a screenshot of your receipt");
  await submitPayment(userId, bookingId, input);
  notifyLater("payment submitted", () => notifyPaymentSubmitted(bookingId));
  if (demo.enabled && demo.autoApprove) {
    // Synchronous so the page the member lands on already says confirmed
    const { changed } = await approveBooking(PERSONAS.organiser.id, bookingId);
    if (changed) notifyLater("approved (demo auto-approve)", () => notifyApproved(bookingId));
    return { autoApproved: true };
  }
  return { autoApproved: false };
}

export async function cancelBookingFlow(userId: string, bookingId: string) {
  await cancelBooking(userId, bookingId);
  notifyLater("cancelled by member", () => notifyBookingCancelled(bookingId, { byOrganiser: false }));
  // Those seats are free now: tell the waitlist straight away rather than at the next cron
  const b = await getBookingForUser(bookingId, userId);
  if (b) notifyLater("waitlist", () => notifyWaitlist(b.eventId));
}

export async function renameTicketFlow(userId: string, ticketId: string, name: string) {
  return renameTicket(userId, ticketId, name);
}
