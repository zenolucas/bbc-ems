import { revalidatePath } from "next/cache";
import { paySchema } from "@bbc/shared/schemas";
import { requireApiUser } from "@/lib/api/auth";
import { body, handle } from "@/lib/api/respond";
import { submitPaymentFlow } from "@/lib/flows/bookings";

/** Upload the receipt to /api/upload (folder=payments) first, then send its URL here. */
export const POST = handle(async (req: Request, { params }: RouteContext<"/api/v1/bookings/[id]/payment">) => {
  const user = await requireApiUser(req);
  const { id } = await params;
  await submitPaymentFlow(user.id, id, await body(req, paySchema));
  revalidatePath(`/bookings/${id}`);
  revalidatePath("/admin", "layout");
  return { ok: true };
});
