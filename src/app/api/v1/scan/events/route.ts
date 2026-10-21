import type { DoorEventDTO } from "@bbc/shared/api-types";
import { requireApiStaff } from "@/lib/api/auth";
import { handle } from "@/lib/api/respond";
import { listDoorEvents } from "@/lib/checkins";

/** The app's "Which door are you on?" list. Same events as /admin/scan. */
export const GET = handle(async (req: Request) => {
  await requireApiStaff(req);
  const rows = await listDoorEvents();
  return rows.map(
    (e): DoorEventDTO => ({
      id: e.id,
      title: e.title,
      startsAt: e.startsAt.toISOString(),
      endsAt: e.endsAt.toISOString(),
      venue: e.venue,
      total: e.total,
      used: e.used,
      live: e.live,
      ended: e.ended,
    }),
  );
});
