import { getSessionCookie } from "better-auth/cookies";
import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { events } from "@/db/schema";

/**
 * Two jobs, both before the page renders:
 *
 * 1. Missing events get a real 404. The (public) loading skeleton starts streaming
 *    with a 200 before the page can call notFound(), so the check happens here,
 *    where the status can still be set. Unmatched paths render app/not-found.tsx
 *    with a 404, so a rewrite to one gives the same page.
 *
 * 2. Optimistic auth gate. Only checks that a session cookie exists so signed-out
 *    visitors are sent to /login with a `next` back to where they were. Real
 *    session and role checks stay in the server layouts and pages. Also forwards
 *    the path as `x-pathname` so server helpers like requireUser() can build the
 *    same `next` when a cookie is present but the session is stale.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const event = pathname.match(/^\/events\/([^/]+)(?:\/book)?\/?$/);
  if (event) {
    const slug = decodeURIComponent(event[1]);
    const [row] = await db.select({ id: events.id }).from(events).where(eq(events.slug, slug)).limit(1);
    if (!row) return NextResponse.rewrite(new URL("/_event-not-found", request.url));
    return NextResponse.next();
  }

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
  matcher: ["/admin/:path*", "/me/:path*", "/bookings/:path*", "/tickets/:path*", "/events/:slug", "/events/:slug/book"],
};
