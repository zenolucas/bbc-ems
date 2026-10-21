import type { ScanSample } from "@bbc/shared/demo";
import { requireApiStaff } from "@/lib/api/auth";
import { ApiError, handle } from "@/lib/api/respond";
import { requireDemoMode } from "@/lib/demo/guard";
import { scanSamples } from "@/lib/demo/scan-samples";

export const GET = handle(async (req: Request): Promise<{ samples: ScanSample[] }> => {
  await requireDemoMode();
  await requireApiStaff(req);
  const eventId = new URL(req.url).searchParams.get("eventId");
  if (!eventId) throw new ApiError(422, "eventId is required");
  return { samples: await scanSamples(eventId) };
});
