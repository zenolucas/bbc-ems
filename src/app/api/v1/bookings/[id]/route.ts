import { requireApiUser } from "@/lib/api/auth";
import { bookingDTO } from "@/lib/api/dto";
import { ApiError, handle } from "@/lib/api/respond";
import { getBookingForUser } from "@/lib/bookings";

export const GET = handle(async (req: Request, { params }: RouteContext<"/api/v1/bookings/[id]">) => {
  const user = await requireApiUser(req);
  const { id } = await params;
  const b = await getBookingForUser(id, user.id);
  if (!b) throw new ApiError(404, "Booking not found");
  return bookingDTO(b);
});
