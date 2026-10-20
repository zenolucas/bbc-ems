"use server";
import { revalidatePath } from "next/cache";
import { BookingError, approveBooking, rejectBooking, voidTicket } from "@/lib/bookings";
import { notifyApproved, notifyRejected } from "@/lib/notifications";
import { requireAdmin } from "@/lib/session";

export async function approveAction(bookingId: string, eventId: string) {
  const admin = await requireAdmin();
  try {
    await approveBooking(admin.id, bookingId);
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    throw e;
  }
  notifyApproved(bookingId).catch((e) => console.error("[email] approved", e));
  revalidatePath(`/admin/events/${eventId}/bookings`);
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/admin");
  return null;
}

export async function rejectAction(bookingId: string, eventId: string, note: string) {
  const admin = await requireAdmin();
  try {
    await rejectBooking(admin.id, bookingId, note);
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    throw e;
  }
  notifyRejected(bookingId).catch((e) => console.error("[email] rejected", e));
  revalidatePath(`/admin/events/${eventId}/bookings`);
  revalidatePath("/admin");
  return null;
}

export async function voidTicketAction(ticketId: string, eventId: string) {
  await requireAdmin();
  await voidTicket(ticketId);
  revalidatePath(`/admin/events/${eventId}/attendees`);
  return null;
}
