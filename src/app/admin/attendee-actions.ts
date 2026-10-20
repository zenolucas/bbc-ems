"use server";
import { revalidatePath } from "next/cache";
import { checkinByCode, undoCheckin } from "@/lib/checkins";
import { requireAdmin } from "@/lib/session";
import { normalizeShortCode } from "@/lib/tickets/shortcode";

export async function manualCheckinAction(eventId: string, code: string) {
  const admin = await requireAdmin();
  const normalized = normalizeShortCode(code);
  if (!normalized) return { error: "Codes look like BBC-XXXX-XXXX" };
  const r = await checkinByCode(eventId, admin.id, normalized);
  revalidatePath(`/admin/events/${eventId}/attendees`);
  if (r.result === "invalid") return { error: `No ticket ${normalized} for this event` };
  if (r.result === "void") return { error: `${normalized} is voided` };
  if (r.result === "duplicate") return { error: `${r.holder} was already checked in${r.checkedInAt ? ` at ${new Date(r.checkedInAt).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila" })}` : ""}` };
  return { ok: `${r.holder} checked in` };
}

export async function undoCheckinAction(eventId: string, ticketId: string) {
  await requireAdmin();
  await undoCheckin(ticketId);
  revalidatePath(`/admin/events/${eventId}/attendees`);
  return null;
}
