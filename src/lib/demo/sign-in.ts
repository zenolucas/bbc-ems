import "server-only";
import type { DemoPersonaKey } from "@bbc/shared/demo";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { sessions, verifications } from "@/db/schema";
import { auth } from "@/lib/auth";
import { PERSONAS, upsertPersonas } from "./personas";

/**
 * Signs in as a persona through better-auth's own email-code sign-in, minus the email:
 * createVerificationOTP is server-only and hands the code back instead of sending it.
 * So the session, cookies (nextCookies) and bearer token (set-auth-token) all come out
 * of the normal path. The caller's previous session is ended, so switching persona
 * really switches.
 */
export async function demoSignIn(key: DemoPersonaKey, previous?: Headers) {
  const p = PERSONAS[key];
  const old = previous ? await auth.api.getSession({ headers: previous }).catch(() => null) : null;
  await upsertPersonas();

  const attempt = async () => {
    // Stale codes for this address would make the newest one lose, e.g. two presenters tapping at once
    await db.delete(verifications).where(eq(verifications.identifier, `sign-in-otp-${p.email}`));
    const otp = await auth.api.createVerificationOTP({ body: { email: p.email, type: "sign-in" } });
    return auth.api.signInEmailOTP({ body: { email: p.email, otp }, headers: new Headers(), returnHeaders: true });
  };
  const { headers, response } = await attempt().catch(() => attempt());

  if (old?.session) await db.delete(sessions).where(eq(sessions.id, old.session.id));
  return { token: headers.get("set-auth-token") ?? response.token, persona: p };
}
