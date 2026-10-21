import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { safeNext } from "@/lib/session";

/**
 * The mobile app's way into the web admin. The app holds a bearer token, not a
 * cookie, so it asks better-auth for a one-time token (GET /api/auth/one-time-token/generate,
 * 3 minutes, single use) and opens its WebView here. We swap the token for the
 * session cookie and send the WebView on to `next`.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("ott") ?? "";
  const next = safeNext(url.searchParams.get("next"), "/admin");
  try {
    const { headers } = await auth.api.verifyOneTimeToken({ body: { token }, headers: req.headers, returnHeaders: true });
    const res = NextResponse.redirect(new URL(next, url));
    for (const c of headers.getSetCookie()) res.headers.append("set-cookie", c);
    res.headers.set("cache-control", "no-store");
    return res;
  } catch {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, url));
  }
}
