"use client";
import { toast } from "sonner";
import type { ActionResult } from "./action-result";

/** Runs a server action and toasts the outcome. Returns true on success. */
export async function runAction<T extends object>(
  fn: () => Promise<ActionResult<T> | null | undefined | void>,
  opts: { success?: string | ((r: T) => string) } = {},
): Promise<boolean> {
  try {
    const r = await fn();
    if (r && r.error) {
      toast.error(r.error);
      return false;
    }
    const msg = typeof opts.success === "function" ? opts.success(r as T) : opts.success;
    if (msg) toast.success(msg);
    return true;
  } catch (e) {
    // redirect() inside an action surfaces as a thrown control-flow error; let Next handle it
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
    toast.error("Something went wrong. Please try again.");
    return false;
  }
}
