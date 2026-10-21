import { apiUser } from "@/lib/api/auth";
import { eventDetailDTO } from "@/lib/api/dto";
import { ApiError, handle } from "@/lib/api/respond";
import { activeBookingFor, getEventBySlug, tierAvailability } from "@/lib/events";

/** Public; signed-in members also get their live booking for the event. */
export const GET = handle(async (req: Request, { params }: RouteContext<"/api/v1/events/[slug]">) => {
  const { slug } = await params;
  const user = await apiUser(req);
  const event = await getEventBySlug(slug);
  if (!event || (event.status === "draft" && user?.role !== "admin")) throw new ApiError(404, "Event not found");
  const [avail, mine] = await Promise.all([tierAvailability(event.id), user ? activeBookingFor(user.id, event.id) : null]);
  return eventDetailDTO(event, avail, mine);
});
