import "server-only";
import { auth } from "@/lib/auth";
import { isStaffRole } from "@/lib/session";
import { ApiError } from "./respond";

/**
 * Session for /api/v1 routes. Works with the web's cookie and with the app's
 * `Authorization: Bearer` header (the bearer plugin turns it into the cookie).
 * Unlike requireUser() it never redirects: the app needs a 401 it can act on.
 */
export async function apiUser(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  return session?.user ?? null;
}

export async function requireApiUser(req: Request) {
  const user = await apiUser(req);
  if (!user) throw new ApiError(401, "Sign in first");
  return user;
}

export async function requireApiStaff(req: Request) {
  const user = await requireApiUser(req);
  if (!isStaffRole(user.role)) throw new ApiError(403, "Door access only");
  return user;
}

/** Organisers only (door crew get 403, like requireAdmin() sends them to the scanner). */
export async function requireApiAdmin(req: Request) {
  const user = await requireApiUser(req);
  if (user.role !== "admin") throw new ApiError(403, "Organisers only");
  return user;
}
