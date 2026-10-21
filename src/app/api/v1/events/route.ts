import { eventSummaryDTO } from "@/lib/api/dto";
import { handle } from "@/lib/api/respond";
import { listPublishedEvents } from "@/lib/events";

export const GET = handle(async () => {
  const { upcoming, past } = await listPublishedEvents();
  return { upcoming: upcoming.map(eventSummaryDTO), past: past.map((e) => eventSummaryDTO(e)) };
});
