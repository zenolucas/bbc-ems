import { pushUnregisterSchema } from "@bbc/shared/schemas";
import { requireApiUser } from "@/lib/api/auth";
import { body, handle } from "@/lib/api/respond";
import { unregisterPushToken } from "@/lib/push";

/** Called on sign-out, before the app drops its session token. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(req);
  await unregisterPushToken(user.id, (await body(req, pushUnregisterSchema)).token);
  return { ok: true };
});
