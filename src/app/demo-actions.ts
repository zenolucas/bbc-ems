"use server";
import { type DemoPersonaKey, DEMO_PERSONAS } from "@bbc/shared/demo";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { ActionResult } from "@/lib/action-result";
import { BookingError } from "@/lib/bookings";
import { getDemoState } from "@/lib/demo/flag";
import { demoSignIn } from "@/lib/demo/sign-in";
import { expireHoldNow } from "@/lib/demo/tools";
import { requireUser, safeNext } from "@/lib/session";

const OFF = { error: "Demo mode is off" } as const;

/**
 * One-tap persona sign-in for the web: sets the session cookie and says where to go
 * (`next`, or the persona's home). The caller does a full page load there: everything
 * on screen belonged to the previous person, and an in-app redirect would re-render the
 * root layout on the client, which next-themes' inline script doesn't survive.
 */
export async function signInAsPersonaAction(persona: DemoPersonaKey, next?: string): Promise<ActionResult<{ href: string }>> {
  if (!(await getDemoState()).enabled) return OFF;
  if (!DEMO_PERSONAS.includes(persona)) return { error: "Unknown persona" };
  const { persona: p } = await demoSignIn(persona, await headers());
  return { ok: true, href: next && next !== "/" ? safeNext(next, p.home) : p.home };
}

export async function expireHoldAction(bookingId: string): Promise<ActionResult> {
  if (!(await getDemoState()).enabled) return OFF;
  const user = await requireUser();
  try {
    const { eventId } = await expireHoldNow(user, bookingId);
    revalidatePath(`/bookings/${bookingId}`);
    revalidatePath(`/admin/events/${eventId}`, "layout");
    revalidatePath("/me");
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    throw e;
  }
  return { ok: true };
}
