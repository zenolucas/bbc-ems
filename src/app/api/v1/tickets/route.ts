import { requireApiUser } from "@/lib/api/auth";
import { ticketDTO } from "@/lib/api/dto";
import { handle } from "@/lib/api/respond";
import { listUserTickets } from "@/lib/bookings";

/** Everything the app caches for offline use: each ticket's QR URL, token and code. */
export const GET = handle(async (req: Request) => {
  const user = await requireApiUser(req);
  return (await listUserTickets(user.id)).map((t) => ticketDTO(t, t.event));
});
