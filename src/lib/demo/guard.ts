import "server-only";
import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api/respond";
import { getDemoState } from "./flag";

/** Demo shortcuts: 404 unless this is the demo deployment and the switch is on. */
export async function requireDemoMode() {
  const state = await getDemoState();
  if (!state.enabled) throw new ApiError(404, "Not found");
  return state;
}

/** Demo deployment only (the switch may be off), e.g. the admin page that holds the switch. */
export async function requireDemoSite() {
  const state = await getDemoState();
  if (!state.site) throw new ApiError(404, "Not found");
  return state;
}

export async function demoSiteOr404() {
  const state = await getDemoState();
  if (!state.site) notFound();
  return state;
}

export async function demoModeOr404() {
  const state = await getDemoState();
  if (!state.enabled) notFound();
  return state;
}
