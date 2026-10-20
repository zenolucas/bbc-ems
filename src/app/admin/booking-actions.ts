"use server";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { bookings, tickets } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { BookingError, approveBooking, rejectBooking, voidTicket } from "@/lib/bookings";
import { notifyApproved, notifyBookingCancelled, notifyLater, notifyRejected, trySend } from "@/lib/notifications";
import { requireAdmin } from "@/lib/session";

function revalidateEventAdmin(eventId: string) {
  revalidatePath("/admin", "layout");
  revalidatePath(`/admin/events/${eventId}`, "layout");
}

/** Approves and sends tickets, waiting for the email so the admin knows whether it went out. */
export async function approveAction(bookingId: string, eventId: string): Promise<ActionResult<{ emailSent: boolean }>> {
  const admin = await requireAdmin();
  try {
    await approveBooking(admin.id, bookingId);
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    throw e;
  }
  const emailSent = await trySend("approved", notifyApproved(bookingId));
  revalidateEventAdmin(eventId);
  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true, emailSent };
}

export async function rejectAction(bookingId: string, eventId: string, note: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  try {
    await rejectBooking(admin.id, bookingId, note);
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    throw e;
  }
  notifyLater("rejected", () => notifyRejected(bookingId));
  revalidateEventAdmin(eventId);
  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true };
}

export async function resendTicketsAction(bookingId: string): Promise<ActionResult> {
  await requireAdmin();
  const b = await db.query.bookings.findFirst({ where: eq(bookings.id, bookingId) });
  if (!b || b.status !== "approved") return { error: "Only confirmed bookings have tickets to send" };
  const ok = await trySend("resend", notifyApproved(bookingId));
  return ok ? { ok: true } : { error: "The email didn't send. Check the email provider settings and try again." };
}

/** Organiser-side cancel: voids the booking's tickets and tells the member. */
export async function adminCancelBookingAction(bookingId: string, eventId: string, reason: string): Promise<ActionResult> {
  await requireAdmin();
  const b = await db.query.bookings.findFirst({ where: and(eq(bookings.id, bookingId), eq(bookings.eventId, eventId)) });
  if (!b) return { error: "Booking not found" };
  if (b.status === "cancelled" || b.status === "expired") return { error: "Already inactive" };
  await db.transaction(async (tx) => {
    await tx.update(bookings).set({ status: "cancelled", reviewNote: reason.trim() || null, updatedAt: new Date() }).where(eq(bookings.id, bookingId));
    await tx.update(tickets).set({ status: "void" }).where(and(eq(tickets.bookingId, bookingId), inArray(tickets.status, ["valid"])));
  });
  notifyLater("cancelled by organiser", () => notifyBookingCancelled(bookingId, { byOrganiser: true, reason }));
  revalidateEventAdmin(eventId);
  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true };
}

export async function voidTicketAction(ticketId: string, eventId: string): Promise<ActionResult> {
  await requireAdmin();
  await voidTicket(ticketId);
  revalidateEventAdmin(eventId);
  return { ok: true };
}
