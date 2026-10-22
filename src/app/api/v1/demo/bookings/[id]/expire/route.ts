import { revalidatePath } from "next/cache";
import { requireApiUser } from "@/lib/api/auth";
import { handle } from "@/lib/api/respond";
import { requireDemoMode } from "@/lib/demo/guard";
import { expireHoldNow } from "@/lib/demo/tools";

export const POST = handle(async (req: Request, { params }: RouteContext<"/api/v1/demo/bookings/[id]/expire">) => {
  await requireDemoMode();
  const user = await requireApiUser(req);
  const { id } = await params;
  const { status, eventId } = await expireHoldNow(user, id);
  revalidatePath(`/bookings/${id}`);
  revalidatePath(`/admin/events/${eventId}`, "layout");
  return { ok: true, status };
});
