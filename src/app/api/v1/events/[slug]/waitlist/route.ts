import { requireApiUser } from "@/lib/api/auth";
import { ApiError, handle } from "@/lib/api/respond";
import { getEventBySlug } from "@/lib/events";
import { joinWaitlist, leaveWaitlist } from "@/lib/waitlist";

async function eventFor(slug: string) {
  const event = await getEventBySlug(slug);
  if (!event || event.status !== "published") throw new ApiError(404, "Event not found");
  return event;
}

/** "Notify me when tickets free up". */
export const POST = handle(async (req: Request, { params }: RouteContext<"/api/v1/events/[slug]/waitlist">) => {
  const user = await requireApiUser(req);
  const event = await eventFor((await params).slug);
  await joinWaitlist(user.id, event.id);
  return { onWaitlist: true };
});

export const DELETE = handle(async (req: Request, { params }: RouteContext<"/api/v1/events/[slug]/waitlist">) => {
  const user = await requireApiUser(req);
  const event = await eventFor((await params).slug);
  await leaveWaitlist(user.id, event.id);
  return { onWaitlist: false };
});
