import "server-only";
import { nanoid } from "nanoid";
import { env } from "@/lib/env";
import { encodeToken, importPrivateKey, importPublicKey, parseToken, signTicket, ticketUrl, verifyTicketSignature } from "./token";

let privateKeyPromise: Promise<CryptoKey> | null = null;
let publicKeyPromise: Promise<CryptoKey> | null = null;

function privateKey() {
  if (!env.signingPrivateKey) throw new Error("TICKET_SIGNING_PRIVATE_KEY is not set");
  return (privateKeyPromise ??= importPrivateKey(env.signingPrivateKey));
}
function publicKey() {
  if (!env.signingPublicKey) throw new Error("TICKET_SIGNING_PUBLIC_KEY is not set");
  return (publicKeyPromise ??= importPublicKey(env.signingPublicKey));
}

/** Short, URL-safe ids keep the QR small. 16 chars of nanoid ≈ 95 bits. */
export function newTicketId() {
  return nanoid(16);
}

export async function issueSignature(ticketId: string, eventId: string) {
  return signTicket(await privateKey(), ticketId, eventId);
}

export function tokenFor(t: { id: string; eventId: string; signature: string }) {
  return encodeToken({ ticketId: t.id, eventId: t.eventId, signature: t.signature });
}

export function urlFor(t: { id: string; eventId: string; signature: string }) {
  return ticketUrl(env.appUrl, tokenFor(t));
}

export async function verifyToken(input: string) {
  const parts = parseToken(input);
  if (!parts) return { ok: false as const, reason: "malformed" as const };
  const valid = await verifyTicketSignature(await publicKey(), parts);
  if (!valid) return { ok: false as const, reason: "bad-signature" as const, parts };
  return { ok: true as const, parts };
}

export function publicKeyJwkB64() {
  return env.signingPublicKey;
}
