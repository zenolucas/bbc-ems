import { revalidatePath } from "next/cache";
import { requireApiAdmin } from "@/lib/api/auth";
import { handle } from "@/lib/api/respond";
import { runCronJobs } from "@/lib/cron";
import { requireDemoMode } from "@/lib/demo/guard";

/** "Run cron now": the 15-minute sweep on demand (expire holds, reminders, waitlists). */
export const POST = handle(async (req: Request) => {
  await requireDemoMode();
  await requireApiAdmin(req);
  const result = await runCronJobs();
  revalidatePath("/");
  revalidatePath("/admin", "layout");
  revalidatePath("/me");
  return result;
});
