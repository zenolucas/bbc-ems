"use server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { runCronJobs } from "@/lib/cron";
import { type DemoSetting, getDemoState, setDemoSetting } from "@/lib/demo/flag";
import { clearOutbox } from "@/lib/demo/outbox";
import { resetDemo } from "@/lib/demo/seed";
import { requireAdmin } from "@/lib/session";

const NOT_DEMO = { error: "This isn't the demo site" } as const;

/** Not the root layout: re-rendering it on the client trips next-themes' inline script. */
function revalidateEverything() {
  revalidatePath("/");
  revalidatePath("/admin", "layout");
  revalidatePath("/me");
}

async function guard() {
  await requireAdmin();
  return (await getDemoState()).site;
}

export async function setDemoSettingAction(key: DemoSetting, value: boolean): Promise<ActionResult> {
  if (!(await guard())) return NOT_DEMO;
  await setDemoSetting(key, value);
  revalidatePath("/admin/demo");
  return { ok: true };
}

export async function resetDemoAction(): Promise<ActionResult<{ bookings: number; tickets: number }>> {
  if (!(await guard())) return NOT_DEMO;
  const counts = await resetDemo();
  revalidateEverything();
  return { ok: true, bookings: counts.bookings, tickets: counts.tickets };
}

export async function runCronAction(): Promise<ActionResult<{ expired: number; reminded: number; waitlisted: number }>> {
  if (!(await guard())) return NOT_DEMO;
  const result = await runCronJobs();
  revalidateEverything();
  return { ok: true, ...result };
}

export async function clearOutboxAction(): Promise<ActionResult> {
  if (!(await guard())) return NOT_DEMO;
  await clearOutbox();
  revalidatePath("/admin/demo");
  return { ok: true };
}
