import "server-only";
import { approveBooking, rejectBooking } from "@/lib/bookings";
import { notifyApproved, notifyLater, notifyRejected, trySend } from "@/lib/notifications";

/**
 * Organiser review steps with their side effects. The web's Server Actions and the
 * app's /api/v1/admin routes both call these; each caller adds only its own auth
 * and cache revalidation.
 */

/** Approves and sends the tickets, waiting for the email so the organiser knows whether it went out. */
export async function approveBookingFlow(adminId: string, bookingId: string) {
  const { changed } = await approveBooking(adminId, bookingId);
  // Approving twice must not email the tickets twice; "Resend tickets" is the way to send them again
  if (!changed) return { emailSent: true, alreadyApproved: true };
  const emailSent = await trySend("approved", notifyApproved(bookingId));
  return { emailSent, alreadyApproved: false };
}

/** Rejects with a note the member is emailed; their seats stay held for a fresh window. */
export async function rejectBookingFlow(adminId: string, bookingId: string, note: string) {
  await rejectBooking(adminId, bookingId, note);
  notifyLater("rejected", () => notifyRejected(bookingId));
}
