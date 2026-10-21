import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import type { ApproveResultDTO } from "@bbc/shared/admin-types";
import { db } from "@/db/client";
import { bookings } from "@/db/schema";
import { requireApiAdmin } from "@/lib/api/auth";
import { ApiError, handle } from "@/lib/api/respond";
import { approveBookingFlow } from "@/lib/flows/admin-bookings";

/** Same as the web's approveAction: tickets are issued and emailed; emailSent says whether the email went out. */
export const POST = handle(async (req: Request, { params }: RouteContext<"/api/v1/admin/bookings/[id]/approve">): Promise<ApproveResultDTO> => {
  const admin = await requireApiAdmin(req);
  const { id } = await params;
  const b = await db.query.bookings.findFirst({ where: eq(bookings.id, id), columns: { eventId: true } });
  if (!b) throw new ApiError(404, "Booking not found");
  const { emailSent } = await approveBookingFlow(admin.id, id);
  revalidatePath("/admin", "layout");
  revalidatePath(`/admin/events/${b.eventId}`, "layout");
  revalidatePath(`/bookings/${id}`);
  return { ok: true, emailSent };
});
