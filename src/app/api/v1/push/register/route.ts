import { pushRegisterSchema } from "@bbc/shared/schemas";
import { requireApiUser } from "@/lib/api/auth";
import { ApiError, body, handle } from "@/lib/api/respond";
import { registerPushToken } from "@/lib/push";

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(req);
  const { token, platform, deviceId } = await body(req, pushRegisterSchema);
  try {
    await registerPushToken(user.id, token, platform, deviceId);
  } catch {
    throw new ApiError(422, "Not an Expo push token");
  }
  return { ok: true };
});
