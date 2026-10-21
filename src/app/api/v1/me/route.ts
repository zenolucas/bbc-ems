import { profileSchema } from "@bbc/shared/schemas";
import { auth } from "@/lib/auth";
import { requireApiUser } from "@/lib/api/auth";
import { meDTO } from "@/lib/api/dto";
import { body, handle } from "@/lib/api/respond";

export const GET = handle(async (req: Request) => meDTO(await requireApiUser(req)));

/** Name on tickets. Same better-auth call the web profile form makes. */
export const PATCH = handle(async (req: Request) => {
  const user = await requireApiUser(req);
  const { name } = await body(req, profileSchema);
  await auth.api.updateUser({ body: { name }, headers: req.headers });
  return meDTO({ ...user, name });
});
