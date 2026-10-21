"use server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { getEventById } from "@/lib/events";
import { requireUser } from "@/lib/session";
import { joinWaitlist, leaveWaitlist } from "@/lib/waitlist";

/** "Notify me" on a sold-out event. Same rules as POST /api/v1/events/[slug]/waitlist. */
export async function joinWaitlistAction(eventId: string): Promise<ActionResult> {
  const event = await getEventById(eventId);
  if (!event || event.status !== "published") return { error: "This event isn't open" };
  const user = await requireUser(`/events/${event.slug}`);
  await joinWaitlist(user.id, event.id);
  revalidatePath(`/events/${event.slug}`);
  return { ok: true };
}

export async function leaveWaitlistAction(eventId: string): Promise<ActionResult> {
  const event = await getEventById(eventId);
  if (!event) return { error: "Event not found" };
  const user = await requireUser(`/events/${event.slug}`);
  await leaveWaitlist(user.id, event.id);
  revalidatePath(`/events/${event.slug}`);
  return { ok: true };
}
