import "server-only";
import { inArray, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db/client";
import { appSettings } from "@/db/schema";

/**
 * Demo mode has three locks, all of which must be open:
 *  1. DEMO_MODE=1 on the deployment (DEMO_ENV). Production never sets it.
 *  2. The database carries the `demo.database` marker, written only by
 *     `pnpm demo:seed --init`, which refuses a database with real users or bookings.
 *     So DEMO_MODE pointed at the production database still does nothing.
 *  3. The organiser's switch on /admin/demo (`demo.enabled`), live, no redeploy.
 *
 * 1+2 make a "demo deployment": its email goes to the outbox and /admin/demo exists.
 * 3 turns on the shortcuts (persona sign-in, sample receipts, time and scanner helpers).
 */
export const DEMO_ENV = process.env.DEMO_MODE === "1";

export const MARKER_KEY = "demo.database";
export type DemoMarker = { createdAt: string; keyFingerprint: string };
export type DemoState = { site: boolean; enabled: boolean; autoApprove: boolean };
export type DemoSetting = "enabled" | "autoApprove";

const OFF: DemoState = { site: false, enabled: false, autoApprove: false };

// The marker is never removed from a live demo database, so a positive answer can be kept for the process.
let markerSeen = false;

export async function isDemoDeployment() {
  if (!DEMO_ENV) return false;
  if (markerSeen) return true;
  const [row] = await db.select({ key: appSettings.key }).from(appSettings).where(inArray(appSettings.key, [MARKER_KEY]));
  markerSeen = Boolean(row);
  return markerSeen;
}

/** One query per render (React cache); route handlers and actions read it fresh each call. */
export const getDemoState = cache(async (): Promise<DemoState> => {
  if (!(await isDemoDeployment())) return OFF;
  const rows = await db
    .select()
    .from(appSettings)
    .where(inArray(appSettings.key, ["demo.enabled", "demo.autoApprove"]));
  const get = (k: string) => rows.find((r) => r.key === k)?.value === true;
  return { site: true, enabled: get("demo.enabled"), autoApprove: get("demo.autoApprove") };
});

export async function isDemoMode() {
  return (await getDemoState()).enabled;
}

export async function setDemoSetting(key: DemoSetting, value: boolean) {
  await db
    .insert(appSettings)
    .values({ key: `demo.${key}`, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: sql`now()` } });
}

export async function getDemoMarker() {
  const row = await db.query.appSettings.findFirst({ where: (s, { eq }) => eq(s.key, MARKER_KEY) });
  return (row?.value as DemoMarker | undefined) ?? null;
}
