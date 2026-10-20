import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic auth gate. Only checks that a session cookie exists so signed-out
 * visitors are sent to /login with a `next` back to where they were. Real
 * session and role checks stay in the server layouts and pages.
 *
 * Also forwards the path as `x-pathname` so server helpers like requireUser()
 * can build the same `next` when a cookie is present but the session is stale.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const here = pathname + search;
  if (!getSessionCookie(request)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", here);
    return NextResponse.redirect(url);
  }
  const headers = new Headers(request.headers);
  headers.set("x-pathname", here);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/admin/:path*", "/me/:path*", "/bookings/:path*", "/tickets/:path*"],
};
