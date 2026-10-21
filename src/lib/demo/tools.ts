import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { bookings } from "@/db/schema";
import { BookingError, expireOverdueBookings } from "@/lib/bookings";
import { notifyLater } from "@/lib/notifications";
import { notifyWaitlist } from "@/lib/waitlist";

/** "Expire hold now": skips the wait for an unpaid hold to lapse, then sweeps it like the cron would. */
export async function expireHoldNow(actor: { id: string; role?: string | null }, bookingId: string) {
  const b = await db.query.bookings.findFirst({ where: eq(bookings.id, bookingId) });
  if (!b || (b.userId !== actor.id && actor.role !== "admin")) throw new BookingError("Booking not found");
  if (b.status !== "pending_payment" && b.status !== "rejected") throw new BookingError("Only unpaid or rejected holds can expire");
  await db.update(bookings).set({ expiresAt: new Date(Date.now() - 1000), updatedAt: new Date() }).where(eq(bookings.id, bookingId));
  await expireOverdueBookings();
  // The seats are free now: the waitlist hears straight away, as after a cancellation
  notifyLater("waitlist (demo expire)", () => notifyWaitlist(b.eventId));
  return { ok: true as const, status: "expired" as const, eventId: b.eventId };
}
