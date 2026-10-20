import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";

export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user ?? null;
}

/** Same-origin relative path only, so `next` can never redirect off-site. */
export function safeNext(v: unknown, fallback = "/") {
  return typeof v === "string" && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : fallback;
}

export async function requireUser(next?: string) {
  const user = await getCurrentUser();
  if (!user) {
    // proxy.ts forwards the current path, so layouts that don't know their URL still round-trip
    const target = next ?? (await headers()).get("x-pathname") ?? undefined;
    redirect(`/login${target ? `?next=${encodeURIComponent(target)}` : ""}`);
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role === "staff") redirect("/admin/scan");
  if (user.role !== "admin") redirect("/no-access");
  return user;
}

/** Admins and door staff. Staff can scan and check people in, nothing else. */
export async function requireStaff() {
  const user = await requireUser();
  if (user.role !== "admin" && user.role !== "staff") redirect("/no-access");
  return user;
}

export function isStaffRole(role: string | null | undefined) {
  return role === "admin" || role === "staff";
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
