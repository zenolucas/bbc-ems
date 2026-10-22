import { revalidatePath } from "next/cache";
import { requireApiAdmin } from "@/lib/api/auth";
import { handle } from "@/lib/api/respond";
import { requireDemoSite } from "@/lib/demo/guard";
import { resetDemo } from "@/lib/demo/seed";

export const POST = handle(async (req: Request) => {
  await requireDemoSite();
  await requireApiAdmin(req);
  const counts = await resetDemo();
  revalidatePath("/");
  revalidatePath("/admin", "layout");
  revalidatePath("/me");
  return { ok: true, counts };
});
