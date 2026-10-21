import { revalidatePath } from "next/cache";
import { renameSchema } from "@bbc/shared/schemas";
import { requireApiUser } from "@/lib/api/auth";
import { ticketDTO } from "@/lib/api/dto";
import { ApiError, body, handle } from "@/lib/api/respond";
import { getTicketForUser } from "@/lib/bookings";
import { renameTicketFlow } from "@/lib/flows/bookings";

export const GET = handle(async (req: Request, { params }: RouteContext<"/api/v1/tickets/[id]">) => {
  const user = await requireApiUser(req);
  const { id } = await params;
  const t = await getTicketForUser(id, user.id);
  if (!t) throw new ApiError(404, "Ticket not found");
  return ticketDTO(t, t.event);
});

/** Put a guest's name on the ticket. */
export const PATCH = handle(async (req: Request, { params }: RouteContext<"/api/v1/tickets/[id]">) => {
  const user = await requireApiUser(req);
  const { id } = await params;
  const { holderName } = await body(req, renameSchema);
  const { bookingId } = await renameTicketFlow(user.id, id, holderName);
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath(`/tickets/${id}`);
  const t = await getTicketForUser(id, user.id);
  if (!t) throw new ApiError(404, "Ticket not found");
  return ticketDTO(t, t.event);
});
