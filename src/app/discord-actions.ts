"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { auth } from "@/lib/auth";
import { getDiscordAccount } from "@/lib/discord/members";
import { removeManagedRoles } from "@/lib/discord/roles";
import { requireUser } from "@/lib/session";

/** Unlinks Discord and takes back the roles the EMS gave them; they keep their place in the server. */
export async function unlinkDiscordAction(): Promise<ActionResult> {
  const user = await requireUser("/me/profile");
  const account = await getDiscordAccount(user.id);
  if (!account) return { error: "No Discord account is linked" };
  try {
    await removeManagedRoles(account.accountId);
  } catch (e) {
    console.error("[discord] unlink roles", e);
  }
  await auth.api.unlinkAccount({ body: { accountId: account.id }, headers: await headers() });
  revalidatePath("/me", "layout");
  return { ok: true };
}
