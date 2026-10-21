import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { undoSchema } from "@bbc/shared/schemas";
import { db } from "@/db/client";
import { tickets } from "@/db/schema";
import { requireApiStaff } from "@/lib/api/auth";
import { ApiError, body, handle } from "@/lib/api/respond";
import { undoCheckin } from "@/lib/checkins";

/** The door's two-tap "Undo that check-in". */
export const POST = handle(async (req: Request) => {
  await requireApiStaff(req);
  const { eventId, ticketId } = await body(req, undoSchema);
  const t = await db.query.tickets.findFirst({ where: and(eq(tickets.id, ticketId), eq(tickets.eventId, eventId)) });
  if (!t) throw new ApiError(404, "Ticket not found");
  await undoCheckin(ticketId);
  revalidatePath(`/admin/events/${eventId}`, "layout");
  return { ok: true };
});
