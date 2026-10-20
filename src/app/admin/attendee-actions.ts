"use server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { checkinByCode, undoCheckin } from "@/lib/checkins";
import { fmtTime } from "@/lib/format";
import { requireStaff } from "@/lib/session";
import { normalizeShortCode } from "@/lib/tickets/shortcode";

function revalidate(eventId: string) {
  revalidatePath(`/admin/events/${eventId}`, "layout");
  revalidatePath("/admin", "layout");
}

export async function manualCheckinAction(eventId: string, code: string): Promise<ActionResult<{ message: string }>> {
  const user = await requireStaff();
  const normalized = normalizeShortCode(code);
  if (!normalized) return { error: "Codes look like BBC-XXXX-XXXX" };
  const r = await checkinByCode(eventId, user.id, normalized);
  revalidate(eventId);
  if (r.result === "invalid") return { error: `No ticket ${normalized} for this event` };
  if (r.result === "void") return { error: `${normalized} is voided` };
  if (r.result === "duplicate") return { error: `${r.holder} was already checked in${r.checkedInAt ? ` at ${fmtTime(r.checkedInAt)}` : ""}` };
  return { ok: true, message: `${r.holder} checked in` };
}

export async function undoCheckinAction(eventId: string, ticketId: string): Promise<ActionResult> {
  await requireStaff();
  await undoCheckin(ticketId);
  revalidate(eventId);
  return { ok: true };
}
