import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { rejectSchema } from "@bbc/shared/admin-schemas";
import { db } from "@/db/client";
import { bookings } from "@/db/schema";
import { requireApiAdmin } from "@/lib/api/auth";
import { ApiError, body, handle } from "@/lib/api/respond";
import { rejectBookingFlow } from "@/lib/flows/admin-bookings";

/** Same as the web's rejectAction: the note is required and emailed to the member, who gets a fresh hold to resubmit. */
export const POST = handle(async (req: Request, { params }: RouteContext<"/api/v1/admin/bookings/[id]/reject">) => {
  const admin = await requireApiAdmin(req);
  const { id } = await params;
  const { note } = await body(req, rejectSchema);
  const b = await db.query.bookings.findFirst({ where: eq(bookings.id, id), columns: { eventId: true } });
  if (!b) throw new ApiError(404, "Booking not found");
  await rejectBookingFlow(admin.id, id, note);
  revalidatePath("/admin", "layout");
  revalidatePath(`/admin/events/${b.eventId}`, "layout");
  revalidatePath(`/bookings/${id}`);
  return { ok: true };
});
