import { revalidatePath } from "next/cache";
import { requireApiUser } from "@/lib/api/auth";
import { handle } from "@/lib/api/respond";
import { cancelBookingFlow } from "@/lib/flows/bookings";

export const POST = handle(async (req: Request, { params }: RouteContext<"/api/v1/bookings/[id]/cancel">) => {
  const user = await requireApiUser(req);
  const { id } = await params;
  await cancelBookingFlow(user.id, id);
  revalidatePath(`/bookings/${id}`);
  revalidatePath("/admin", "layout");
  return { ok: true };
});
