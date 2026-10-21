import { type DemoSignInDTO, demoSignInSchema } from "@bbc/shared/demo";
import { NextResponse } from "next/server";
import { meDTO } from "@/lib/api/dto";
import { body, handle } from "@/lib/api/respond";
import { requireDemoMode } from "@/lib/demo/guard";
import { demoSignIn } from "@/lib/demo/sign-in";

/**
 * One-tap persona sign-in. The app stores `token` like the email-code sign-in's
 * set-auth-token; a browser gets the session cookie. Ends the caller's previous session.
 */
export const POST = handle(async (req: Request) => {
  await requireDemoMode();
  const { persona } = await body(req, demoSignInSchema);
  // The browser's cookie is set by better-auth's nextCookies plugin
  const { token, persona: p } = await demoSignIn(persona, req.headers);
  const res = NextResponse.json({ token, me: meDTO(p), home: p.home } satisfies DemoSignInDTO, { headers: { "cache-control": "private, no-store" } });
  if (token) res.headers.set("set-auth-token", token);
  return res;
});
