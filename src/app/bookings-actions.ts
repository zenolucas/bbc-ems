"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { BookingError, cancelBooking, createBooking, renameTicket, submitPayment } from "@/lib/bookings";
import { notifyApproved, notifyBookingCancelled, notifyLater, notifyPaymentSubmitted, notifyReserved } from "@/lib/notifications";
import { requireUser } from "@/lib/session";
import type { ActionResult } from "@/lib/action-result";

export type ActionState = { error?: string; ok?: boolean } | null;

export async function bookAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const user = await requireUser(`/events/${slug}/book`);
  const items: { tierId: string; quantity: number }[] = [];
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("qty:")) items.push({ tierId: k.slice(4), quantity: Number(v) || 0 });
  }
  let result: { id: string; free: boolean };
  try {
    result = await createBooking(user.id, { eventId, items });
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    throw e;
  }
  // Free: tickets are issued now, so send them. Paid: send the hold + payment details,
  // so a member who closes the tab still has the link and the deadline.
  const bookingId = result.id;
  if (result.free) notifyLater("approved (free)", () => notifyApproved(bookingId));
  else notifyLater("reserved", () => notifyReserved(bookingId));
  revalidatePath(`/events/${slug}`);
  revalidatePath("/me");
  redirect(`/bookings/${result.id}?${result.free ? "confirmed=1" : "reserved=1"}`);
}

const paySchema = z.object({
  bookingId: z.string().min(1),
  paymentRef: z.string().trim().min(4, "Enter the reference number from your GCash/Maya receipt"),
  paymentProofUrl: z.string().min(1, "Upload a screenshot of your receipt"),
});

export async function submitPaymentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = paySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await submitPayment(user.id, parsed.data.bookingId, parsed.data);
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    throw e;
  }
  const bookingId = parsed.data.bookingId;
  notifyLater("payment submitted", () => notifyPaymentSubmitted(bookingId));
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/me");
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function cancelBookingAction(bookingId: string): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await cancelBooking(user.id, bookingId);
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    throw e;
  }
  notifyLater("cancelled by member", () => notifyBookingCancelled(bookingId, { byOrganiser: false }));
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/me");
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function renameTicketAction(ticketId: string, name: string): Promise<ActionResult> {
  const user = await requireUser();
  try {
    const { bookingId } = await renameTicket(user.id, ticketId, name);
    revalidatePath(`/bookings/${bookingId}`);
    revalidatePath(`/tickets/${ticketId}`);
    revalidatePath("/me");
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    throw e;
  }
  return { ok: true };
}
