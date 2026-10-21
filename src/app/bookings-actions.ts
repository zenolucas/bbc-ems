"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { paySchema } from "@bbc/shared/schemas";
import { BookingError } from "@/lib/bookings";
import { bookFlow, cancelBookingFlow, renameTicketFlow, submitPaymentFlow } from "@/lib/flows/bookings";
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
    result = await bookFlow(user.id, { eventId, items });
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/events/${slug}`);
  revalidatePath("/me");
  redirect(`/bookings/${result.id}?${result.free ? "confirmed=1" : "reserved=1"}`);
}

export async function submitPaymentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const bookingId = String(formData.get("bookingId") ?? "");
  const parsed = paySchema.safeParse(Object.fromEntries(formData));
  if (!bookingId) return { error: "Booking not found" };
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await submitPaymentFlow(user.id, bookingId, parsed.data);
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/me");
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function cancelBookingAction(bookingId: string): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await cancelBookingFlow(user.id, bookingId);
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/me");
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function renameTicketAction(ticketId: string, name: string): Promise<ActionResult> {
  const user = await requireUser();
  try {
    const { bookingId } = await renameTicketFlow(user.id, ticketId, name);
    revalidatePath(`/bookings/${bookingId}`);
    revalidatePath(`/tickets/${ticketId}`);
    revalidatePath("/me");
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    throw e;
  }
  return { ok: true };
}
