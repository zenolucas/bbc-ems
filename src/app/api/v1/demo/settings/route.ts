import { type DemoStateDTO, demoSettingsSchema } from "@bbc/shared/demo";
import { revalidatePath } from "next/cache";
import { requireApiAdmin } from "@/lib/api/auth";
import { body, handle } from "@/lib/api/respond";
import { getDemoState, setDemoSetting } from "@/lib/demo/flag";
import { requireDemoSite } from "@/lib/demo/guard";

/** The /admin/demo switches, for the app's Demo tools. Works while demo mode is off, so it can be turned back on. */
export const POST = handle(async (req: Request): Promise<DemoStateDTO> => {
  await requireDemoSite();
  await requireApiAdmin(req);
  const input = await body(req, demoSettingsSchema);
  if (input.enabled !== undefined) await setDemoSetting("enabled", input.enabled);
  if (input.autoApprove !== undefined) await setDemoSetting("autoApprove", input.autoApprove);
  revalidatePath("/admin/demo");
  const { enabled, autoApprove } = await getDemoState();
  return { enabled, autoApprove };
});
