"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { BookingError, cancelBooking, createBooking, submitPayment } from "@/lib/bookings";
import { notifyPaymentSubmitted } from "@/lib/notifications";
import { requireUser } from "@/lib/session";

export type ActionState = { error?: string } | null;

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
  revalidatePath(`/events/${slug}`);
  redirect(`/bookings/${result.id}${result.free ? "?confirmed=1" : ""}`);
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
  notifyPaymentSubmitted(parsed.data.bookingId).catch((e) => console.error("[email] payment submitted", e));
  revalidatePath(`/bookings/${parsed.data.bookingId}`);
  revalidatePath("/admin");
  return null;
}

export async function cancelBookingAction(bookingId: string) {
  const user = await requireUser();
  try {
    await cancelBooking(user.id, bookingId);
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/me");
  return null;
}
